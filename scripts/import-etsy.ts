/**
 * Importiert Etsy-Listings aus dem CSV-Export in den Shop.
 *
 * CSV beschaffen:
 *   Etsy → Shop Manager → Einstellungen → Optionen → Daten herunterladen
 *   → „Currently for Sale Listings“ → Download CSV
 *
 * Aufruf (produktiv, als Dienstbenutzer):
 *   sudo -u mir3d npm run etsy:import -- --file /tmp/etsy-listings.csv
 *   sudo -u mir3d npm run etsy:import -- --file … --dry-run
 *
 * Der Import ist idempotent: Bereits vorhandene Produkte (gleiche SKU oder
 * gleicher Slug) werden übersprungen. Bilder werden von den Etsy-CDN-URLs
 * geladen, lokal in mehreren Größen gespeichert und Metadaten entfernt.
 *
 * Hinweis: Der CSV-Export enthält keine Variationsdaten. Pro Produkt wird
 * deshalb eine Standardvariante mit dem Listenpreis angelegt; Variationen
 * lassen sich anschließend im Admin ergänzen.
 */
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE ?? '/etc/3d-mir/3d-mir.env';
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
dotenv.config();

const { config } = await import('../src/config.js');
const { migrate } = await import('../src/db/migrate.js');
const { getDb, closeDb } = await import('../src/db/index.js');
const { storeProductImage, MAX_PRODUCT_IMAGES } = await import('../src/lib/product-images.js');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const limit = Number.parseInt(arg('limit') ?? '', 10);
const file = arg('file');

if (!file) {
  console.error('Bitte den CSV-Pfad angeben: npm run etsy:import -- --file /tmp/etsy-listings.csv');
  process.exit(2);
}
if (!fs.existsSync(file)) {
  console.error(`CSV-Datei nicht gefunden: ${file}`);
  process.exit(2);
}

type CsvRow = Record<string, string>;

/** RFC-4180-konformer CSV-Parser (Anführungszeichen, Zeilenumbrüche, Semikolon). */
function parseCsv(text: string): string[][] {
  const delimiter = (text.split('\n')[0]?.match(/;/g)?.length ?? 0) > (text.split('\n')[0]?.match(/,/g)?.length ?? 0)
    ? ';'
    : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLUMN_ALIASES: Record<string, string[]> = {
  title: ['title', 'titel', 'name', 'listing title', 'artikelname'],
  description: ['description', 'beschreibung', 'artikelbeschreibung'],
  price: ['price', 'preis', 'artikelpreis'],
  currency: ['currency code', 'currency', 'waehrungscode', 'waehrung', 'wahrung', 'wahrungscode'],
  quantity: ['quantity', 'menge', 'bestand', 'verfugbare menge', 'verfuegbare menge'],
  sku: ['sku', 'sku numbers', 'sku nummer', 'artikelnummer'],
  images: ['image urls', 'image url', 'images', 'image', 'bild urls', 'bilder', 'bild url', 'bilder urls'],
  tags: ['tags', 'schlagworter', 'schlagwoerter', 'schlagworter'],
  materials: ['materials', 'materialien', 'material'],
};

function findColumn(headers: string[], key: string): number {
  const aliases = COLUMN_ALIASES[key] ?? [];
  return headers.findIndex((header) => aliases.includes(header));
}

function cleanText(value: string | undefined, maxLength: number): string {
  return (value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Wandelt eine Etsy-Beschreibung in reinen Text um. */
function descriptionText(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const withBreaks = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(withBreaks)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20_000);
}

function shortDescription(description: string): string {
  const firstLine = description.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  return firstLine.length > 280 ? `${firstLine.slice(0, 277).trimEnd()} …` : firstLine;
}

/** Liest einen Preis im deutschen oder englischen Format als Centbetrag. */
function parsePriceCents(value: string): number | null {
  let text = value.replace(/[^\d.,-]/g, '').trim();
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replaceAll('.', '').replace(',', '.');
    } else {
      text = text.replaceAll(',', '');
    }
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const amount = Number.parseFloat(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function imageUrls(value: string | undefined): string[] {
  return [...new Set((value ?? '').match(/https?:\/\/[^\s,;"']+/g) ?? [])].slice(0, MAX_PRODUCT_IMAGES);
}

/** Lädt ein Bild und gibt Puffer plus MIME-Typ zurück. */
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimetype: string }> {
  const response = await fetch(url, {
    headers: { 'user-agent': '3D-MIR Produktimport (info@3d-mir.de)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  return { buffer, mimetype: type };
}

const text = fs.readFileSync(file, 'utf8');
const rows = parseCsv(text);
if (rows.length < 2) {
  console.error('Die CSV-Datei enthält keine Daten.');
  process.exit(2);
}

const headers = (rows[0] ?? []).map(normalizeHeader);
const columns = {
  title: findColumn(headers, 'title'),
  description: findColumn(headers, 'description'),
  price: findColumn(headers, 'price'),
  currency: findColumn(headers, 'currency'),
  quantity: findColumn(headers, 'quantity'),
  sku: findColumn(headers, 'sku'),
  images: findColumn(headers, 'images'),
  tags: findColumn(headers, 'tags'),
  materials: findColumn(headers, 'materials'),
};

if (columns.title < 0 || columns.price < 0) {
  console.error('Titel- oder Preisspalte nicht gefunden. Gefundene Spalten:', headers.join(', '));
  process.exit(2);
}

const unmapped = headers.filter(
  (header) =>
    header &&
    !Object.values(COLUMN_ALIASES).some((aliases) => aliases.includes(header)) &&
    !header.includes('variation'),
);
const variationColumns = headers.filter((header) => header.includes('variation'));
if (variationColumns.length > 0) {
  console.warn(
    `Hinweis: Variationsspalten gefunden (${variationColumns.join(', ')}). Sie werden nicht automatisch übernommen; bitte im Admin ergänzen.`,
  );
}
if (unmapped.length > 0) {
  console.log('Nicht zugeordnete Spalten (werden ignoriert):', unmapped.join(', '));
}

migrate();
const db = getDb();

function uniqueSlug(base: string): string {
  const root = (slugify(base) || 'produkt').slice(0, 105);
  let slug = root;
  let counter = 2;
  while (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) {
    slug = `${root.slice(0, 100)}-${counter}`;
    counter += 1;
  }
  return slug;
}

function existingProduct(sku: string, slug: string): { id: number } | undefined {
  if (sku) {
    const bySku = db.prepare('SELECT id FROM products WHERE sku = ? LIMIT 1').get(sku) as { id: number } | undefined;
    if (bySku) return bySku;
  }
  return db.prepare('SELECT id FROM products WHERE slug = ? LIMIT 1').get(slugify(slug)) as { id: number } | undefined;
}

const value = (row: CsvRow, index: number): string => (index >= 0 ? (row[headers[index] ?? ''] ?? '') : '');

const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM products').get() as { value: number }).value;
const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
const selected = Number.isFinite(limit) && limit > 0 ? dataRows.slice(0, limit) : dataRows;

console.log(`CSV: ${dataRows.length} Zeilen, ${selected.length} werden verarbeitet${dryRun ? ' (Testlauf)' : ''}.`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (const [position, cells] of selected.entries()) {
  const row: CsvRow = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  const title = cleanText(value(row, columns.title), 200);
  const priceCents = parsePriceCents(value(row, columns.price));
  const currency = cleanText(value(row, columns.currency), 10).toUpperCase() || 'EUR';

  if (!title || priceCents === null) {
    console.warn(`Zeile ${position + 2}: Titel oder Preis fehlt – übersprungen.`);
    skipped += 1;
    continue;
  }
  if (currency !== 'EUR') {
    console.warn(`Zeile ${position + 2}: Währung ${currency} wird nicht unterstützt – übersprungen.`);
    skipped += 1;
    continue;
  }

  const slug = slugify(title);
  const sku = cleanText(value(row, columns.sku), 60);
  const existing = existingProduct(sku, slug);
  if (existing) {
    console.log(`= ${title} (bereits vorhanden, ID ${existing.id}) – übersprungen.`);
    skipped += 1;
    continue;
  }

  let description = descriptionText(value(row, columns.description));
  const materials = cleanText(value(row, columns.materials), 500);
  const tags = cleanText(value(row, columns.tags), 500);
  if (materials) description = `${description}\n\nMaterialien: ${materials}`.trim();
  if (tags) description = `${description}\n\nSchlagwörter: ${tags}`.trim();

  const quantityRaw = cleanText(value(row, columns.quantity), 20);
  const quantity = Number.parseInt(quantityRaw, 10);
  const stock = Number.isFinite(quantity) && quantity >= 0 && quantity < 999 ? quantity : null;

  const urls = imageUrls(value(row, columns.images));

  console.log(`+ ${title} – ${(priceCents / 100).toFixed(2)} €, ${urls.length} Bild(er)`);
  if (dryRun) {
    imported += 1;
    continue;
  }

  try {
    const productId = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO products
             (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g,
              dimensions, stock, active, sort_order, shipping_method_ids, shipping_option_ids)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, '', ?, 1, ?, '[]', '[]')`,
        )
        .run(
          uniqueSlug(title),
          title,
          shortDescription(description),
          description,
          priceCents,
          sku,
          stock,
          maxSort + imported + 1,
        );
      const id = Number(info.lastInsertRowid);
      db.prepare(
        'INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, 1)',
      ).run(id, 'Standard', priceCents, stock);
      return id;
    })();

    let storedImages = 0;
    for (const [imageIndex, url] of urls.entries()) {
      try {
        const image = await downloadImage(url.replace(/il_\d+xN/i, 'il_1140xN'));
        const stored = await storeProductImage(productId, {
          buffer: image.buffer,
          filename: `etsy-${position + 1}-${imageIndex + 1}.jpg`,
          mimetype: image.mimetype,
        });
        db.prepare('INSERT INTO product_images (product_id, file, alt, sort_order) VALUES (?, ?, ?, ?)').run(
          productId,
          stored,
          title,
          imageIndex + 1,
        );
        storedImages += 1;
      } catch (error) {
        console.warn(`  Bild ${imageIndex + 1} konnte nicht geladen werden: ${(error as Error).message}`);
      }
    }

    if (storedImages === 0 && urls.length > 0) {
      console.warn('  Kein Bild gespeichert – Produkt bleibt ohne Bild.');
    }
    imported += 1;
  } catch (error) {
    failed += 1;
    console.error(`  Import fehlgeschlagen: ${(error as Error).message}`);
  }
}

closeDb();
console.log(`\nFertig: ${imported} importiert, ${skipped} übersprungen, ${failed} fehlgeschlagen.`);
if (dryRun) console.log('Testlauf – es wurden keine Daten geschrieben.');
process.exit(0);
