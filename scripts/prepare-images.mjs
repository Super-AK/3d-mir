/**
 * Erzeugt optimierte Bildvarianten (AVIF/WebP/JPG), Favicons und das OG-Bild.
 * Aufruf: node scripts/prepare-images.mjs
 * Idempotent: vorhandene Dateien werden überschrieben.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'web', 'static', 'img');
const outDir = path.join(srcDir, 'gen');

const images = [
  { name: 'hero', file: 'FDM3DDrucker-Rechnu.jpg', widths: [480, 800, 1200, 1600], alt: 'FDM-3D-Drucker bei der Fertigung' },
  { name: 'service', file: '3DDruck-Service-mit.jpg', widths: [480, 800, 1200], alt: '3D-Druck-Service' },
  { name: 'calculator', file: 'FDM3DDrucker-calcul.jpg', widths: [480, 800, 1200], alt: '3D-Druck-Rechner' },
  { name: 'product-battery-box', file: 'IMG_5003-1-scaled-e1734310071390.jpg', widths: [400, 600, 900], alt: 'Recycling-Box für Batterien' },
  { name: 'gallery-1', file: 'IMG_4012-scaled-e1734309593877.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-2', file: 'IMG_4011-scaled-e1734309379508.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-3', file: 'IMG_4010-scaled-e1734309515898.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-4', file: 'IMG_4013-scaled-e1734295337637.webp', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-5', file: 'IMG_4270-scaled-e1734309680646.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-6', file: 'IMG_4265-scaled-e1734309755322.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-7', file: 'IMG_4267-scaled-e1734309856976.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-8', file: 'IMG_4269-scaled-e1734309951417.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-9', file: 'IMG_4264.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-10', file: 'IMG_4263.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-11', file: 'IMG_4007.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'gallery-12', file: 'IMG_4009.jpeg', widths: [400, 700, 1000], alt: '3D-gedrucktes Bauteil' },
  { name: 'colors', file: 'gruen_alle.png', widths: [500, 900, 1400], alt: 'Filamentfarben im Überblick' },
  { name: 'shipping', file: 'das-bild-soll-versandarten-abbilden-wie-dhl-post-versand-packet.png', widths: [480, 800], alt: 'Versand von 3D-Druck-Teilen' },
];

fs.mkdirSync(outDir, { recursive: true });
const manifest = {};

for (const image of images) {
  const input = path.join(srcDir, image.file);
  if (!fs.existsSync(input)) {
    console.warn(`Übersprungen (fehlt): ${image.file}`);
    continue;
  }
  const meta = await sharp(input).rotate().metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  const widths = [...new Set(image.widths.filter((w) => w <= sourceWidth))];
  if (widths.length === 0) widths.push(sourceWidth);

  const variants = [];
  for (const width of widths) {
    const base = path.join(outDir, `${image.name}-${width}`);
    const pipeline = () => sharp(input).rotate().resize({ width, withoutEnlargement: true });
    await pipeline().avif({ quality: 52, effort: 5 }).toFile(`${base}.avif`);
    await pipeline().webp({ quality: 76, effort: 4 }).toFile(`${base}.webp`);
    await pipeline().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
    variants.push({
      width,
      avif: `/assets/img/gen/${image.name}-${width}.avif`,
      webp: `/assets/img/gen/${image.name}-${width}.webp`,
      jpg: `/assets/img/gen/${image.name}-${width}.jpg`,
    });
  }
  manifest[image.name] = {
    width: sourceWidth,
    height: sourceHeight,
    alt: image.alt,
    variants,
  };
}

// Logo für Header und Favicons
const logo = path.join(srcDir, '3D-MIR-Logo-v2.png');
if (fs.existsSync(logo)) {
  await sharp(logo).resize({ width: 96 }).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'logo-96.png'));
  await sharp(logo).resize({ width: 44 }).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'logo-44.png'));
  for (const size of [32, 180, 192, 512]) {
    await sharp(logo)
      .resize({ width: size, height: size, fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(srcDir, size === 32 ? 'favicon-32.png' : size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`));
  }
}

// OG-Bild (1200 x 630)
const hero = path.join(srcDir, 'FDM3DDrucker-Rechnu.jpg');
if (fs.existsSync(hero)) {
  await sharp(hero).rotate().resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(srcDir, 'og-image.jpg'));
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Bilder erzeugt: ${Object.keys(manifest).length} Motive, Ausgabe: ${outDir}`);
