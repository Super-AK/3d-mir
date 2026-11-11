import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

type ManifestEntry = { file: string; css?: string[]; isEntry?: boolean };
type Manifest = Record<string, ManifestEntry>;

let manifest: Manifest | null = null;

function loadManifest(): Manifest {
  if (manifest) return manifest;
  const file = path.join(config.root, 'public', 'assets', '.vite', 'manifest.json');
  if (fs.existsSync(file)) {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
  } else {
    manifest = {};
  }
  return manifest;
}

/** Liefert die (gehashte) URL eines Vite-Einstiegspunkts, z. B. `ts/main.ts`. */
export function assetUrl(entry: string): string {
  const m = loadManifest();
  const found = m[entry];
  if (!found) return `/assets/${entry.replace(/^\/+/, '')}`;
  return `/assets/${found.file.replace(/^\/+/, '')}`;
}

/** Liefert alle CSS-Dateien, die zu einem Einstiegspunkt gehören. */
export function assetCss(entry: string): string[] {
  const m = loadManifest();
  const found = m[entry];
  if (!found) return [];
  const files = [...(found.css ?? [])];
  if (found.file.endsWith('.css')) files.push(found.file);
  return files.map((f) => `/assets/${f.replace(/^\/+/, '')}`);
}

/** Setzt den Manifest-Cache zurück (z. B. nach einem Build im Test). */
export function resetAssetCache(): void {
  manifest = null;
}
