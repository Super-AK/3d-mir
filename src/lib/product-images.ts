import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { UPLOAD_PREFIX, imageSourceFile } from './render.js';

/**
 * Speicherung und Verarbeitung von Produktbildern.
 *
 * Die Bilder werden als AVIF/WebP/JPEG in mehreren Breiten abgelegt und über
 * einen Schlüssel in der Datenbank referenziert. Zusätzlich wird das
 * metadatenfreie, gedrehte Original abgelegt, damit sich Bilder später ohne
 * Qualitätsverlust zuschneiden lassen. Die Funktionen werden sowohl vom
 * Admin-Bereich als auch von Import-Skripten verwendet.
 */
export const PRODUCT_IMAGE_WIDTHS = [240, 480, 800, 1200];
export const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 12;
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export type UploadedImage = { buffer: Buffer; filename: string; mimetype: string };

/** Normalisierter Ausschnitt; 0..1 bezogen auf die Bildbreite bzw. -höhe. */
export type CropRect = { x: number; y: number; width: number; height: number };

/** Fehler mit einer für den Benutzer lesbaren Meldung. */
export class ProductImageError extends Error {}

function mediaRoot(): string {
  return path.resolve(config.uploadDir, 'media');
}

export function mediaFile(key: string): string | null {
  const root = mediaRoot();
  const file = path.resolve(root, key);
  if (!file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

/** Legt Varianten und das Original für ein bereits aufbereitetes Bild ab. */
async function storePreparedImage(key: string, buffer: Buffer): Promise<string> {
  let width: number;
  let height: number;
  try {
    const meta = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) throw new Error('keine Bildmaße');
    width = meta.width;
    height = meta.height;
  } catch {
    throw new ProductImageError('Die Datei konnte nicht als Bild gelesen werden.');
  }
  if (width * height > 40_000_000) {
    throw new ProductImageError('Das Bild hat zu viele Pixel. Bitte auf maximal 40 Megapixel verkleinern.');
  }

  const file = mediaFile(key);
  if (!file) throw new ProductImageError('Das Bild konnte nicht gespeichert werden.');

  const usedWidths = PRODUCT_IMAGE_WIDTHS.filter((item) => item <= width);
  if (usedWidths.length === 0) usedWidths.push(width);
  const variants: { width: number; height: number }[] = [];

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 });
    for (const variantWidth of [...new Set(usedWidths)]) {
      const variantHeight = Math.round((height * variantWidth) / width);
      const pipeline = () => sharp(buffer).resize({ width: variantWidth, withoutEnlargement: true });
      await Promise.all([
        pipeline().avif({ quality: 55, effort: 4 }).toFile(`${file}-${variantWidth}.avif`),
        pipeline().webp({ quality: 78 }).toFile(`${file}-${variantWidth}.webp`),
        pipeline().jpeg({ quality: 82, mozjpeg: true }).toFile(`${file}-${variantWidth}.jpg`),
      ]);
      for (const extension of ['avif', 'webp', 'jpg']) {
        fs.chmodSync(`${file}-${variantWidth}.${extension}`, 0o644);
      }
      variants.push({ width: variantWidth, height: variantHeight });
    }
    fs.writeFileSync(`${file}.source`, buffer, { mode: 0o600 });
    fs.chmodSync(`${file}.source`, 0o600);
    fs.writeFileSync(`${file}.json`, JSON.stringify({ width, height, variants }), { mode: 0o644 });
    fs.chmodSync(`${file}.json`, 0o644);
  } catch (error) {
    deleteProductImageFiles(`${UPLOAD_PREFIX}${key}`);
    throw error;
  }

  return `${UPLOAD_PREFIX}${key}`;
}

/** Verkleinert ein Bild, entfernt Metadaten und legt AVIF/WebP/JPG-Varianten ab. */
async function storeImageAtKey(key: string, upload: UploadedImage): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(upload.mimetype)) {
    throw new ProductImageError('Bitte eine Bilddatei im Format JPG, PNG, WebP oder AVIF auswählen.');
  }
  if (upload.buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageError('Das Bild ist zu groß. Erlaubt sind bis zu 12 MB.');
  }

  let prepared: Buffer;
  try {
    // rotate() ohne Winkel richtet das Bild anhand der EXIF-Orientierung aus;
    // dabei werden Metadaten entfernt. Das Ergebnis ist die spätere Quelldatei.
    prepared = await sharp(upload.buffer, { failOn: 'error' }).rotate().toBuffer();
  } catch {
    throw new ProductImageError('Die Datei konnte nicht als Bild gelesen werden.');
  }

  return storePreparedImage(key, prepared);
}

export function storeProductImage(productId: number, upload: UploadedImage): Promise<string> {
  return storeImageAtKey(`products/${productId}/${crypto.randomBytes(12).toString('hex')}`, upload);
}

/** Speichert ein Stammdaten-Bild (Hero, Service, Galerie) mit Responsive-Varianten. */
export function storeSiteImage(slot: string, upload: UploadedImage): Promise<string> {
  const safeSlot = slot.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'bild';
  return storeImageAtKey(`site/${safeSlot}-${crypto.randomBytes(8).toString('hex')}`, upload);
}

/**
 * Schneidet ein Produktbild auf den gewählten Ausschnitt zu und speichert das
 * Ergebnis unter einem neuen Schlüssel. So bleibt die Vorschau nicht im
 * Browser-Cache hängen; der alte Datensatz wird von der Route entfernt.
 */
export async function cropProductImage(
  productId: number,
  fileValue: string,
  rect: CropRect,
): Promise<string> {
  const sourceFile = imageSourceFile(fileValue);
  if (!sourceFile) throw new ProductImageError('Für dieses Bild ist kein Zuschnitt möglich.');

  let width: number;
  let height: number;
  try {
    const meta = await sharp(sourceFile, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) throw new Error('keine Bildmaße');
    width = meta.width;
    height = meta.height;
  } catch {
    throw new ProductImageError('Die Quelldatei konnte nicht gelesen werden.');
  }

  const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
  const left = clamp(Math.round(rect.x * width), 0, width - 1);
  const top = clamp(Math.round(rect.y * height), 0, height - 1);
  const cropWidth = clamp(Math.round(rect.width * width), 1, width - left);
  const cropHeight = clamp(Math.round(rect.height * height), 1, height - top);

  let cropped: Buffer;
  try {
    cropped = await sharp(sourceFile)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toBuffer();
  } catch {
    throw new ProductImageError('Der Ausschnitt konnte nicht erzeugt werden.');
  }

  const key = `products/${productId}/${crypto.randomBytes(12).toString('hex')}`;
  return storePreparedImage(key, cropped);
}

/** Entfernt alle Varianten eines hochgeladenen Produktbilds. */
export function deleteProductImageFiles(fileValue: string): void {
  if (!fileValue.startsWith(UPLOAD_PREFIX)) return;
  const key = fileValue.slice(UPLOAD_PREFIX.length);
  const file = mediaFile(key);
  if (!file) return;

  try {
    if (fs.existsSync(`${file}.json`)) {
      const meta = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8')) as {
        variants?: { width?: number }[];
      };
      for (const variant of meta.variants ?? []) {
        if (!Number.isFinite(variant.width)) continue;
        for (const extension of ['avif', 'webp', 'jpg']) {
          const target = `${file}-${variant.width}.${extension}`;
          if (fs.existsSync(target)) fs.unlinkSync(target);
        }
      }
    }
    for (const suffix of ['.source', '.json']) {
      const target = `${file}${suffix}`;
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  } catch {
    // Dateien sind nicht kritisch; der Datenbankeintrag wird trotzdem entfernt.
  }
}
