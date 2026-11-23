import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { SITE_MEDIA_PREFIX, siteMediaFile } from './site-media.js';

/**
 * Stellt den in den Stammdaten hinterlegten Favicon für alle Browser und
 * Betriebssysteme bereit.
 *
 * - `/favicon.ico` ist ein echtes ICO mit 16/32/48 px (BMP-Rahmen) für Windows,
 *   Internet Explorer und Legacy-Browser.
 * - `/favicon.png`, `/apple-touch-icon.png`, `/favicon-192.png` und
 *   `/favicon-512.png` liefern PNG in den passenden Größen für moderne Browser,
 *   iOS und Android/PWA.
 * - `/site.webmanifest` verweist auf die dynamischen Symbole, damit auch der
 *   Startbildschirm den hinterlegten Favicon verwendet.
 *
 * Ohne hinterlegten Favicon dienen die mitgelieferten Bilder als Fallback.
 */

const STATIC_IMG_DIR = path.join(config.root, 'web', 'static', 'img');
const ICO_SIZES = [16, 32, 48] as const;
const cache = new Map<string, Buffer>();
let cachedStored = '';

/** Cache-Busting-Wert, abgeleitet aus dem Dateinamen des hinterlegten Favicons. */
export function faviconVersion(): string {
  const stored = config.site.images.favicon;
  return stored ? path.basename(stored).replace(/[^a-zA-Z0-9.-]/g, '') : '';
}

function mediaFile(key: string): string | null {
  const root = path.resolve(config.uploadDir, 'media');
  const file = path.resolve(root, key);
  return file.startsWith(`${root}${path.sep}`) ? file : null;
}

function storedSource(): string | null {
  const stored = config.site.images.favicon;
  if (!stored) return null;
  if (stored.startsWith('upload:')) {
    const base = mediaFile(stored.slice('upload:'.length));
    if (!base) return null;
    try {
      const info = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) as {
        variants?: { width: number }[];
      };
      const variant = [...(info.variants ?? [])].sort((a, b) => b.width - a.width)[0];
      return variant ? `${base}-${variant.width}.jpg` : null;
    } catch {
      return null;
    }
  }
  if (stored.startsWith(SITE_MEDIA_PREFIX)) {
    return siteMediaFile(stored.slice(SITE_MEDIA_PREFIX.length));
  }
  return null;
}

function fallbackSource(size: number): string | null {
  const name = size >= 512 ? 'icon-512.png' : size >= 192 ? 'icon-192.png' : 'favicon-32.png';
  const file = path.join(STATIC_IMG_DIR, name);
  return fs.existsSync(file) ? file : null;
}

function sourceFor(size: number): string | null {
  const stored = config.site.images.favicon;
  if (stored !== cachedStored) {
    cache.clear();
    cachedStored = stored;
  }
  const source = storedSource();
  return source && fs.existsSync(source) ? source : fallbackSource(size);
}

async function pngBuffer(source: string, size: number): Promise<Buffer> {
  const key = `png:${source}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const png = await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  cache.set(key, png);
  return png;
}

/** PNG in der gewünschten Größe (Standard: 180 px für Touch-Icons). */
export async function faviconPng(size = 180): Promise<Buffer | null> {
  const source = sourceFor(size);
  if (!source) return null;
  try {
    return await pngBuffer(source, size);
  } catch {
    return null;
  }
}

/** Erzeugt einen BMP-basierten ICO-Rahmen (breiteste Browser-Unterstützung). */
async function icoFrame(source: string, size: number): Promise<Buffer> {
  const { data } = await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // BITMAPINFOHEADER-Größe
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND-Maske
  header.writeUInt16LE(1, 12); // Ebenen
  header.writeUInt16LE(32, 14); // 32 bpp
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(size * size * 4, 20);

  const pixels = Buffer.alloc(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    const from = (size - 1 - row) * size * 4; // ICO speichert von unten nach oben
    const to = row * size * 4;
    for (let col = 0; col < size; col += 1) {
      const src = from + col * 4;
      const dst = to + col * 4;
      pixels[dst] = data[src + 2] ?? 0; // Blau
      pixels[dst + 1] = data[src + 1] ?? 0; // Grün
      pixels[dst + 2] = data[src] ?? 0; // Rot
      pixels[dst + 3] = data[src + 3] ?? 0; // Alpha
    }
  }
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  return Buffer.concat([header, pixels, mask]);
}

/** Echtes ICO mit 16, 32 und 48 px für Legacy-Browser und Windows. */
export async function faviconIco(): Promise<Buffer | null> {
  const source = sourceFor(32);
  if (!source) return null;
  const key = `ico:${source}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const frames = await Promise.all(ICO_SIZES.map((size) => icoFrame(source, size)));
    const header = Buffer.alloc(6 + 16 * frames.length);
    header.writeUInt16LE(0, 0); // reserviert
    header.writeUInt16LE(1, 2); // Typ: Icon
    header.writeUInt16LE(frames.length, 4);

    let offset = header.length;
    frames.forEach((frame, index) => {
      const size = ICO_SIZES[index]!;
      const at = 6 + index * 16;
      header.writeUInt8(size, at);
      header.writeUInt8(size, at + 1);
      header.writeUInt16LE(1, at + 4);
      header.writeUInt16LE(32, at + 6);
      header.writeUInt32LE(frame.length, at + 8);
      header.writeUInt32LE(offset, at + 12);
      offset += frame.length;
    });

    const ico = Buffer.concat([header, ...frames]);
    cache.set(key, ico);
    return ico;
  } catch {
    return null;
  }
}

/** Webmanifest mit dynamischen Icons aus den Stammdaten. */
export function faviconManifest(): Record<string, unknown> {
  let manifest: Record<string, unknown> = {};
  try {
    const file = path.join(config.root, 'web', 'static', 'site.webmanifest');
    manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    manifest = {
      name: '3D-MIR',
      short_name: '3D-MIR',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0a1530',
      lang: 'de',
    };
  }
  const query = faviconVersion() ? `?v=${faviconVersion()}` : '';
  return {
    ...manifest,
    icons: [
      { src: `/favicon-192.png${query}`, sizes: '192x192', type: 'image/png' },
      { src: `/favicon-512.png${query}`, sizes: '512x512', type: 'image/png' },
    ],
  };
}
