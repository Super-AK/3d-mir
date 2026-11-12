/**
 * Erzeugt aus der vollständigen Inter-Variable-Datei eine kleine Subset-Datei
 * für den tatsächlich verwendeten Zeichensatz (Deutsch, ASCII, gängige Satzzeichen).
 *
 * Quelle:  web/fonts-src/inter-latin-var.woff2  (vollständige Datei, nicht ausgeliefert)
 * Ziel:    web/static/fonts/inter-latin-var.woff2 (wird von Vite nach /assets kopiert)
 *
 * Aufruf:  node scripts/prepare-fonts.mjs
 * Das Skript ist idempotent und überschreibt das Ziel bei jedem Lauf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'web', 'fonts-src', 'inter-latin-var.woff2');
const target = path.join(root, 'web', 'static', 'fonts', 'inter-latin-var.woff2');

const characters = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'ÄÖÜäöüßẞ',
  '.,;:!?"\'„“”‚‘’()[]{}',
  '–—-/–+±×÷%&@#*_=<>',
  '€$£§°²³·…→←↑↓✓',
].join('');

if (!fs.existsSync(source)) {
  console.error(`Quelldatei fehlt: ${source}`);
  process.exit(1);
}

const input = fs.readFileSync(source);
const output = await subsetFont(input, characters, { targetFormat: 'woff2' });
fs.writeFileSync(target, output);

console.log(
  `Schrift-Subset erzeugt: ${path.relative(root, target)} ` +
    `(${input.length} → ${output.length} Bytes, ${characters.length} Zeichen)`,
);
