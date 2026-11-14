import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { UPLOAD_PREFIX } from './render.js';

/**
 * Speicherung und Verarbeitung von Produktbildern.
 *
 * Die Bilder werden als AVIF/WebP/JPEG in mehreren Breiten abgelegt und über
 * einen Schlüssel in der Datenbank referenziert. Die Funktionen werden sowohl
 * vom Admin-Bereich als auch von Import-Skripten verwendet.
 */
export const PRODUCT_IMAGE_WIDTHS = [480, 800, 1200];
export const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 12;
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export type UploadedImage = { buffer: Buffer; filename: string; mimetype: string };

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

/** Verkleinert ein Bild, entfernt Metadaten und legt AVIF/WebP/JPEG-Varianten ab. */
async function storeImageAtKey(key: string, upload: UploadedImage): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(upload.mimetype)) {
    throw new ProductImageError('Bitte eine Bilddatei im Format JPG, PNG, WebP oder AVIF auswählen.');
  }
  if (upload.buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageError('Das Bild ist zu groß. Erlaubt sind bis zu 12 MB.');
  }

  let width: number;
  let height: number;
  try {
    const meta = await sharp(upload.buffer, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) throw new Error('keine Bildmaße');
    width = meta.width;
    height = meta.height;
    // Hochkant-Fotos: EXIF-Orientierung 5–8 dreht um 90 Grad.
    if (meta.orientation && meta.orientation >= 5) {
      [width, height] = [height, width];
    }
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
      const pipeline = () => sharp(upload.buffer).rotate().resize({ width: variantWidth, withoutEnlargement: true });
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
    fs.writeFileSync(`${file}.json`, JSON.stringify({ width, height, variants }), { mode: 0o644 });
    fs.chmodSync(`${file}.json`, 0o644);
  } catch (error) {
    deleteProductImageFiles(`${UPLOAD_PREFIX}${key}`);
    throw error;
  }

  return `${UPLOAD_PREFIX}${key}`;
}

export function storeProductImage(productId: number, upload: UploadedImage): Promise<string> {
  return storeImageAtKey(`products/${productId}/${crypto.randomBytes(12).toString('hex')}`, upload);
}

/** Speichert ein Stammdaten-Bild (Hero, Service, Galerie) mit Responsive-Varianten. */
export function storeSiteImage(slot: string, upload: UploadedImage): Promise<string> {
  const safeSlot = slot.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'bild';
  return storeImageAtKey(`site/${safeSlot}-${crypto.randomBytes(8).toString('hex')}`, upload);
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
    if (fs.existsSync(`${file}.json`)) fs.unlinkSync(`${file}.json`);
  } catch {
    // Dateien sind nicht kritisch; der Datenbankeintrag wird trotzdem entfernt.
  }
}
