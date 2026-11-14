/**
 * Importiert Etsy-Listings in den Shop – per CSV-Export oder Etsy-API.
 *
 * CSV (ohne API-Zugang):
 *   Etsy → Shop Manager → Einstellungen → Optionen → Daten herunterladen
 *   → „Currently for Sale Listings“ → Download CSV
 *   npm run etsy:import -- --file /tmp/etsy-listings.csv
 *
 * API (inkl. Variationen):
 *   ETSY_API_KEY='keystring:shared_secret' npm run etsy:import -- --api --shop 3DlMIR
 *
 * Optional: --dry-run (nichts schreiben), --limit N (nur die ersten N Listings).
 *
 * Der Import ist idempotent: Bereits vorhandene Produkte (gleiche SKU oder
 * gleicher Slug) werden übersprungen. Bilder werden geladen, lokal in mehreren
 * Größen gespeichert und Metadaten entfernt.
 */
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE ?? '/etc/3d-mir/3d-mir.env';
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
dotenv.config();

const { migrate } = await import('../src/db/migrate.js');
const { getDb, closeDb } = await import('../src/db/index.js');
const { storeProductImage, MAX_PRODUCT_IMAGES } = await import('../src/lib/product-images.js');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const useApi = process.argv.includes('--api');
const limitArg = Number.parseInt(arg('limit') ?? '', 10);
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 0;
const file = arg('file');
const shopName = arg('shop') ?? '3DlMIR';
const apiKey = process.env.ETSY_API_KEY ?? '';

type Variant = { label: string; priceCents: number; stock: number | null };

type ImportItem = {
  title: string;
  description: string;
  priceCents: number;
  priceToCents: number | null;
  sku: string;
  stock: number | null;
  tags: string;
  materials: string;
  images: string[];
  variants: Variant[];
  sourceId?: string;
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC-4180-konformer CSV-Parser (Anführungszeichen, Zeilenumbrüche, Semikolon). */
function parseCsv(text: string): string[][] {
  const firstLine = text.split('\n')[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
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
  quantity: ['quantity', 'menge', 'bestand', 'stueckzahl', 'stuckzahl', 'verfugbare menge', 'verfuegbare menge'],
  sku: ['sku', 'sku numbers', 'sku nummer', 'artikelnummer'],
  images: ['image urls', 'image url', 'images', 'image', 'bild urls', 'bilder', 'bild url', 'bilder urls'],
  tags: ['tags', 'schlagworter', 'schlagwoerter'],
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

function readCsvItems(path: string): ImportItem[] {
  const rows = parseCsv(fs.readFileSync(path, 'utf8'));
  if (rows.length < 2) throw new Error('Die CSV-Datei enthält keine Daten.');

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
    throw new Error(`Titel- oder Preisspalte nicht gefunden. Gefundene Spalten: ${headers.join(', ')}`);
  }

  // Bilder liegen je nach Export in einer Sammelspalte oder in BILD1…BILD10.
  const imageColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /^(bild|image)\s*\d+$/.test(header))
    .map(({ index }) => index);
  if (columns.images >= 0) imageColumns.unshift(columns.images);

  const variations = [1, 2, 3, 4, 5]
    .map((number) => ({
      name: headers.indexOf(`variationsname ${number}`),
      values: headers.indexOf(`variationswert ${number}`),
      type: headers.indexOf(`variationstyp ${number}`),
      englishName: headers.indexOf(`variation name ${number}`),
      englishValues: headers.indexOf(`variation value ${number}`),
    }))
    .map((entry) => ({
      name: entry.name >= 0 ? entry.name : entry.englishName,
      values: entry.values >= 0 ? entry.values : entry.englishValues,
    }))
    .filter((entry) => entry.name >= 0 && entry.values >= 0);

  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
  const items = new Map<string, ImportItem>();

  for (const [position, cells] of dataRows.entries()) {
    const value = (index: number): string => (index >= 0 ? (cells[index] ?? '') : '');
    const title = cleanText(value(columns.title), 200);
    const priceCents = parsePriceCents(value(columns.price));
    const currency = cleanText(value(columns.currency), 10).toUpperCase() || 'EUR';

    if (!title || priceCents === null) {
      console.warn(`Zeile ${position + 2}: Titel oder Preis fehlt – übersprungen.`);
      continue;
    }
    if (currency !== 'EUR') {
      console.warn(`Zeile ${position + 2}: Währung ${currency} wird nicht unterstützt – übersprungen.`);
      continue;
    }

    const quantity = Number.parseInt(cleanText(value(columns.quantity), 20), 10);
    const stock = Number.isFinite(quantity) && quantity >= 0 && quantity < 999 ? quantity : null;
    const images = [
      ...imageUrls(value(columns.images)),
      ...imageColumns.map((index) => cells[index] ?? ''),
    ].flatMap((entry) => imageUrls(entry));

    const variationLines = variations
      .map((entry) => {
        const name = cleanText(value(entry.name), 80);
        const values = cleanText(value(entry.values), 500);
        return name && values ? `- ${name}: ${values}` : '';
      })
      .filter(Boolean);

    let description = cleanText(value(columns.description), 20_000);
    if (variationLines.length > 0) {
      description = `${description}\n\nVerfügbare Varianten:\n${variationLines.join('\n')}`.trim();
    }

    const existing = items.get(title);
    if (existing) {
      // Etsy exportiert manche Listings mehrfach (z. B. mit anderem Titelbild).
      existing.images = [...new Set([...existing.images, ...images])].slice(0, MAX_PRODUCT_IMAGES);
      if (existing.priceCents !== priceCents) {
        console.warn(`„${title}“: abweichender Preis in einer weiteren Zeile – erster Preis bleibt erhalten.`);
      }
      continue;
    }

    items.set(title, {
      title,
      description,
      priceCents,
      priceToCents: null,
      sku: cleanText(value(columns.sku), 60),
      stock,
      tags: cleanText(value(columns.tags), 500),
      materials: cleanText(value(columns.materials), 500),
      images: [...new Set(images)].slice(0, MAX_PRODUCT_IMAGES),
      variants: [{ label: 'Standard', priceCents, stock }],
    });
  }

  const result = [...items.values()];
  if (variations.length > 0) {
    console.warn(
      'Hinweis: Der CSV-Export enthält keine Preise je Variationskombination. Die Varianten stehen deshalb in der Beschreibung; exakte Varianten liefert der API-Import (--api), sobald die Etsy-App freigegeben ist.',
    );
  }
  return limit > 0 ? result.slice(0, limit) : result;
}

// ---------------------------------------------------------------------------
// Etsy-API v3
// ---------------------------------------------------------------------------

const API_BASE = 'https://openapi.etsy.com/v3/application';

type EtsyMoney = { amount: number; divisor: number; currency_code: string };
type EtsyImage = { url_570xN?: string; url_fullxfull?: string; alt_text?: string; rank?: number };
type EtsyListing = {
  listing_id: number;
  title: string;
  description: string;
  price: EtsyMoney;
  quantity: number;
  tags?: string[];
  materials?: string[];
  sku?: string[];
  skus?: string[];
  images?: EtsyImage[];
};
type EtsyInventoryProduct = {
  product_id: number;
  sku?: string;
  property_values?: { property_name: string; values: string[] }[];
  offerings?: { price: EtsyMoney; quantity: number; is_enabled?: boolean }[];
};

async function etsyGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-api-key': apiKey, 'user-agent': '3D-MIR Produktimport (info@3d-mir.de)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Etsy-API ${response.status}: ${text.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

function moneyCents(money: EtsyMoney | undefined): number | null {
  if (!money || !money.divisor) return null;
  return Math.round((money.amount * 100) / money.divisor);
}

function variantLabel(product: EtsyInventoryProduct): string {
  const values = (product.property_values ?? []).flatMap((property) => property.values ?? []).filter(Boolean);
  return values.length > 0 ? values.join(' / ') : 'Standard';
}

async function readApiItems(): Promise<ImportItem[]> {
  if (!apiKey) throw new Error('ETSY_API_KEY fehlt (Format: keystring:shared_secret).');

  const shop = await etsyGet<{ shop_id: number; shop_name: string }>(`/shops/${encodeURIComponent(shopName)}`);
  console.log(`Shop: ${shop.shop_name} (ID ${shop.shop_id})`);

  const listings: EtsyListing[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const page = await etsyGet<{ count: number; results: EtsyListing[] }>(
      `/shops/${shop.shop_id}/listings/active?limit=${pageSize}&offset=${offset}`,
    );
    listings.push(...page.results);
    if (page.results.length < pageSize || listings.length >= page.count) break;
  }
  console.log(`Aktive Listings: ${listings.length}`);
  const selected = limit > 0 ? listings.slice(0, limit) : listings;

  const items: ImportItem[] = [];
  for (const [index, listing] of selected.entries()) {
    const priceCents = moneyCents(listing.price) ?? 0;
    if (listing.price?.currency_code && listing.price.currency_code !== 'EUR') {
      console.warn(`„${listing.title}“: Währung ${listing.price.currency_code} wird nicht unterstützt – übersprungen.`);
      continue;
    }

    let images: EtsyImage[] = listing.images ?? [];
    if (images.length === 0) {
      try {
        const result = await etsyGet<{ results: EtsyImage[] }>(`/listings/${listing.listing_id}/images`);
        images = result.results;
      } catch (error) {
        console.warn(`  Bilder konnten nicht geladen werden: ${(error as Error).message}`);
      }
    }

    let variants: Variant[] = [];
    try {
      const inventory = await etsyGet<{ products: EtsyInventoryProduct[] }>(
        `/listings/${listing.listing_id}/inventory`,
      );
      const seen = new Set<string>();
      for (const product of inventory.products) {
        const offering = (product.offerings ?? []).find((entry) => entry.is_enabled !== false) ?? product.offerings?.[0];
        if (!offering) continue;
        const price = moneyCents(offering.price);
        if (price === null) continue;
        let label = variantLabel(product);
        if (seen.has(label)) {
          let counter = 2;
          while (seen.has(`${label} (${counter})`)) counter += 1;
          label = `${label} (${counter})`;
        }
        seen.add(label);
        const quantity = offering.quantity;
        variants.push({
          label: label.slice(0, 80),
          priceCents: price,
          stock: Number.isFinite(quantity) && quantity >= 0 && quantity < 999 ? quantity : null,
        });
      }
    } catch (error) {
      console.warn(`  Variationen konnten nicht geladen werden: ${(error as Error).message}`);
    }

    if (variants.length === 0) {
      const stock = listing.quantity >= 0 && listing.quantity < 999 ? listing.quantity : null;
      variants = [{ label: 'Standard', priceCents, stock }];
    }

    const prices = variants.map((variant) => variant.priceCents);
    const minPrice = Math.min(...prices, priceCents);
    const maxPrice = Math.max(...prices, priceCents);

    items.push({
      title: cleanText(listing.title, 200),
      description: descriptionText(listing.description),
      priceCents: minPrice,
      priceToCents: maxPrice > minPrice ? maxPrice : null,
      sku: cleanText((listing.sku ?? listing.skus ?? []).join(', '), 60),
      stock: listing.quantity >= 0 && listing.quantity < 999 ? listing.quantity : null,
      tags: cleanText((listing.tags ?? []).join(', '), 500),
      materials: cleanText((listing.materials ?? []).join(', '), 500),
      images: [...new Set(images.map((image) => image.url_fullxfull ?? image.url_570xN).filter((url): url is string => Boolean(url)))].slice(
        0,
        MAX_PRODUCT_IMAGES,
      ),
      variants,
      sourceId: String(listing.listing_id),
    });

    console.log(
      `  ${index + 1}/${selected.length}: ${listing.title} – ${variants.length} Variante(n), ${images.length} Bild(er)`,
    );
    // Etsy erlaubt 10 Anfragen pro Sekunde; sequenziell bleiben wir deutlich darunter.
  }
  return items;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

if (!useApi && !file) {
  console.error('Bitte --file <csv> oder --api (mit ETSY_API_KEY) angeben.');
  process.exit(2);
}

let items: ImportItem[] = [];
try {
  items = useApi ? await readApiItems() : readCsvItems(file!);
} catch (error) {
  console.error(`Fehler: ${(error as Error).message}`);
  process.exit(1);
}
if (items.length === 0) {
  console.error('Keine importierbaren Listings gefunden.');
  process.exit(1);
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

function existingProduct(sku: string, name: string): { id: number } | undefined {
  if (sku) {
    const bySku = db.prepare('SELECT id FROM products WHERE sku = ? LIMIT 1').get(sku) as { id: number } | undefined;
    if (bySku) return bySku;
  }
  return db.prepare('SELECT id FROM products WHERE slug = ? LIMIT 1').get(slugify(name)) as { id: number } | undefined;
}

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

const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM products').get() as { value: number }).value;

console.log(`\n${items.length} Produkt(e) werden verarbeitet${dryRun ? ' (Testlauf)' : ''}.`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (const [position, item] of items.entries()) {
  const existing = existingProduct(item.sku, item.title);
  if (existing) {
    console.log(`= ${item.title} (bereits vorhanden, ID ${existing.id}) – übersprungen.`);
    skipped += 1;
    continue;
  }

  let description = item.description;
  if (item.materials) description = `${description}\n\nMaterialien: ${item.materials}`.trim();
  if (item.tags) description = `${description}\n\nSchlagwörter: ${item.tags}`.trim();

  console.log(
    `${dryRun ? '~' : '+'} ${item.title} – ${(item.priceCents / 100).toFixed(2)} €, ${item.variants.length} Variante(n), ${item.images.length} Bild(er)`,
  );

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
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '', ?, 1, ?, '[]', '[]')`,
        )
        .run(
          uniqueSlug(item.title),
          item.title,
          shortDescription(description),
          description,
          item.priceCents,
          item.priceToCents,
          item.sku,
          item.stock,
          maxSort + imported + 1,
        );
      const id = Number(info.lastInsertRowid);
      const insertVariant = db.prepare(
        'INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)',
      );
      item.variants.forEach((variant, index) => {
        insertVariant.run(id, variant.label, variant.priceCents, variant.stock, index + 1);
      });
      return id;
    })();

    let storedImages = 0;
    for (const [imageIndex, url] of item.images.entries()) {
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
          item.title,
          imageIndex + 1,
        );
        storedImages += 1;
      } catch (error) {
        console.warn(`  Bild ${imageIndex + 1} konnte nicht geladen werden: ${(error as Error).message}`);
      }
    }
    if (storedImages === 0 && item.images.length > 0) {
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
