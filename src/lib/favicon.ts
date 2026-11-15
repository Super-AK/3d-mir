import fs from 'node:fs';
import sharp from 'sharp';
import { config } from '../config.js';
import { mediaFile } from './product-images.js';
import { SITE_MEDIA_PREFIX, siteMediaFile } from './site-media.js';

/**
 * Erzeugt aus dem hinterlegten Favicon ein browserfreundliches PNG.
 *
 * Die Stammdaten speichern Favicons als `upload:site/...` (JPEG-/WebP-
 * Varianten). Für `<link rel="icon">` und `/favicon.ico` wird daraus ein
 * quadratisches PNG erzeugt. Das vermeidet Probleme mit Browsern, die keine
 * JPEG-Favicons anzeigen.
 */
export async function faviconPng(): Promise<Buffer | null> {
  const stored = config.site.images.favicon;
  if (!stored) return null;

  let source: string | null = null;
  if (stored.startsWith('upload:')) {
    const key = stored.slice('upload:'.length);
    const base = mediaFile(key);
    if (base) {
      try {
        const info = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) as {
          variants?: { width: number }[];
        };
        const variant = [...(info.variants ?? [])].sort((a, b) => b.width - a.width)[0];
        if (variant) source = `${base}-${variant.width}.jpg`;
      } catch {
        source = null;
      }
    }
  } else if (stored.startsWith(SITE_MEDIA_PREFIX)) {
    source = siteMediaFile(stored.slice(SITE_MEDIA_PREFIX.length));
  }

  if (!source || !fs.existsSync(source)) return null;

  try {
    return await sharp(source)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
