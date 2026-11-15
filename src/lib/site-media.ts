import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

/**
 * Einfache Ablage für Stammdaten-Bilder (aktuell das Logo).
 *
 * Anders als Produktbilder werden diese Dateien nicht in Responsive-Varianten
 * umgewandelt: Logos sollen transparent bleiben und ihre Proportionen behalten.
 */
export const SITE_MEDIA_PREFIX = '/site-media/';
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function siteMediaDir(): string {
  return path.join(config.uploadDir, 'site');
}

export function siteMediaFile(name: string): string | null {
  if (!/^[a-z0-9-]+\.(png|jpg|jpeg|webp)$/i.test(name)) return null;
  const root = path.resolve(siteMediaDir());
  const file = path.resolve(root, name);
  if (!file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

/** Speichert ein Favicon als transparentes PNG und liefert die öffentliche URL. */
export async function storeSiteFavicon(buffer: Buffer, mimetype: string): Promise<string> {
  if (!LOGO_TYPES[mimetype]) {
    throw new Error('Bitte eine Bilddatei im Format PNG, JPG oder WebP auswählen.');
  }
  if (buffer.length === 0) throw new Error('Die Datei ist leer.');
  if (buffer.length > MAX_LOGO_BYTES) throw new Error('Das Favicon ist zu groß. Erlaubt sind bis zu 5 MB.');

  let png: Buffer;
  try {
    png = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    throw new Error('Die Datei konnte nicht als Bild gelesen werden.');
  }

  const dir = siteMediaDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const name = `favicon-${crypto.randomBytes(12).toString('hex')}.png`;
  const file = siteMediaFile(name);
  if (!file) throw new Error('Das Favicon konnte nicht gespeichert werden.');
  fs.writeFileSync(file, png, { mode: 0o644 });
  return `${SITE_MEDIA_PREFIX}${name}`;
}

/** Speichert ein Logo und liefert die öffentliche URL. */
export function storeSiteLogo(buffer: Buffer, mimetype: string): string {
  const extension = LOGO_TYPES[mimetype];
  if (!extension) throw new Error('Bitte eine Bilddatei im Format PNG, JPG oder WebP auswählen.');
  if (buffer.length === 0) throw new Error('Die Datei ist leer.');
  if (buffer.length > MAX_LOGO_BYTES) throw new Error('Das Logo ist zu groß. Erlaubt sind bis zu 5 MB.');

  const dir = siteMediaDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const name = `logo-${crypto.randomBytes(12).toString('hex')}.${extension}`;
  const file = siteMediaFile(name);
  if (!file) throw new Error('Das Logo konnte nicht gespeichert werden.');
  fs.writeFileSync(file, buffer, { mode: 0o644 });
  return `${SITE_MEDIA_PREFIX}${name}`;
}

/** Entfernt ein zuvor gespeichertes Logo, sofern es aus dem Upload-Verzeichnis stammt. */
export function deleteSiteLogo(url: string): void {
  if (!url.startsWith(SITE_MEDIA_PREFIX)) return;
  const file = siteMediaFile(url.slice(SITE_MEDIA_PREFIX.length));
  if (!file) return;
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // Das Entfernen ist nicht kritisch.
  }
}
