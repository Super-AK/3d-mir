/**
 * CSV-Import und -Export für Produkte.
 *
 * Die Dateien verwenden Semikolon als Trennzeichen, UTF-8 mit BOM (für Excel)
 * und RFC-4180-konforme Anführungszeichen. Listenwerte (Varianten, Farben,
 * Kategorien, Versandarten) stehen in einer Zelle und werden mit `|` getrennt;
 * mehrere Varianten werden mit `||` getrennt. Bilder bleiben bewusst beim
 * JSON-Export, da sich Dateien nicht sinnvoll in eine Tabelle einbetten lassen.
 */

export type CsvVariant = {
  label: string;
  priceCents: number;
  stock: number | null;
  sortOrder: number;
};

export type CsvProductInput = {
  sku: string;
  slug: string;
  name: string;
  categorySlugs: string[];
  shortDescription: string;
  description: string;
  priceFromCents: number;
  priceToCents: number | null;
  material: string;
  deliveryNote: string;
  weightG: number | null;
  dimensions: string;
  stock: number | null;
  sortOrder: number;
  active: boolean;
  variants: CsvVariant[];
  colorOptions: string[];
  personalizationEnabled: boolean;
  personalizationHint: string;
  shippingMethodIds: string[];
  shippingOptionIds: string[];
};

export type CsvProductRow = Partial<CsvProductInput>;

export type ParsedProductCsv = {
  rows: CsvProductRow[];
  errors: string[];
};

export const MAX_PRODUCT_CSV_ROWS = 500;

/** Kanonische Spaltenköpfe; zugleich die Reihenfolge im Export. */
export const PRODUCT_CSV_HEADER = [
  'sku',
  'slug',
  'name',
  'kategorien',
  'kurzbeschreibung',
  'beschreibung',
  'preisAb',
  'preisBis',
  'material',
  'lieferhinweis',
  'gewichtG',
  'abmessungen',
  'lagerbestand',
  'sortierung',
  'aktiv',
  'varianten',
  'farben',
  'personalisierung',
  'personalisierungshinweis',
  'versandarten',
  'versandoptionen',
] as const;

const aliases: Record<keyof CsvProductInput, string[]> = {
  sku: ['sku', 'artikelnummer', 'sku nummer'],
  slug: ['slug', 'url'],
  name: ['name', 'titel', 'produktname'],
  categorySlugs: ['kategorien', 'categories', 'kategorie'],
  shortDescription: ['kurzbeschreibung', 'shortdescription', 'kurztext'],
  description: ['beschreibung', 'description', 'text'],
  priceFromCents: ['preisab', 'pricefrom', 'preis', 'price'],
  priceToCents: ['preisbis', 'priceto'],
  material: ['material'],
  deliveryNote: ['lieferhinweis', 'deliverynote'],
  weightG: ['gewichtg', 'weightg', 'gewicht'],
  dimensions: ['abmessungen', 'dimensions'],
  stock: ['lagerbestand', 'stock', 'bestand'],
  sortOrder: ['sortierung', 'sortorder'],
  active: ['aktiv', 'active'],
  variants: ['varianten', 'variants'],
  colorOptions: ['farben', 'coloroptions', 'colors'],
  personalizationEnabled: ['personalisierung', 'personalizationenabled', 'personalisierungaktiv'],
  personalizationHint: ['personalisierungshinweis', 'personalizationhint'],
  shippingMethodIds: ['versandarten', 'shippingmethodids'],
  shippingOptionIds: ['versandoptionen', 'shippingoptionids'],
};

const aliasLookup = new Map<string, keyof CsvProductInput>();
for (const key of Object.keys(aliases) as (keyof CsvProductInput)[]) {
  for (const name of aliases[key]) aliasLookup.set(name, key);
}

/** Liest CSV mit `;` oder `,` inklusive Anführungszeichen und Zeilenumbrüchen. */
export function parseCsv(text: string): string[][] {
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
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Schreibt CSV mit Semikolon, Anführungszeichen nach RFC-4180 und UTF-8-BOM. */
export function stringifyCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? '' : String(value);
          return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(';'),
    )
    .join('\r\n');
  return `\uFEFF${body}\r\n`;
}

/** Textzellen gegen CSV-Injektion schützen (Excel/ LibreOffice). */
function safeText(value: string): string {
  if (value.startsWith("'")) return value; // nicht bei jedem Export erneut ergänzen
  const trimmed = value.trimStart();
  return /^[=+@\t\r]/.test(trimmed) || /^-\D/.test(trimmed) ? `'${value}` : value;
}

function money(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function decimal(value: number): string {
  return String(value).replace('.', ',');
}

function booleanText(value: boolean): string {
  return value ? '1' : '0';
}

/** Wandelt ein Produkt in eine CSV-Zeile um. */
export function productCsvRow(product: CsvProductInput): string[] {
  return [
    safeText(product.sku),
    safeText(product.slug),
    safeText(product.name),
    safeText(product.categorySlugs.join('|')),
    safeText(product.shortDescription),
    safeText(product.description),
    money(product.priceFromCents),
    product.priceToCents == null ? '' : money(product.priceToCents),
    safeText(product.material),
    safeText(product.deliveryNote),
    product.weightG == null ? '' : decimal(product.weightG),
    safeText(product.dimensions),
    product.stock == null ? '' : String(product.stock),
    String(product.sortOrder),
    booleanText(product.active),
    product.variants
      .map((variant) => `${safeText(variant.label)}|${money(variant.priceCents)}|${variant.stock ?? ''}`)
      .join('||'),
    safeText(product.colorOptions.join('|')),
    booleanText(product.personalizationEnabled),
    safeText(product.personalizationHint),
    safeText(product.shippingMethodIds.join('|')),
    safeText(product.shippingOptionIds.join('|')),
  ];
}

/** Erzeugt die vollständige CSV-Datei inklusive Kopfzeile. */
export function productCsv(products: CsvProductInput[]): string {
  return stringifyCsv([
    [...PRODUCT_CSV_HEADER],
    ...products.map((product) => productCsvRow(product)),
  ]);
}

function normalizedHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function parseMoney(value: string, label: string): number {
  const cleaned = value.trim().replace(/[€\s]/g, '').replace(',', '.');
  const amount = Number(cleaned);
  if (!cleaned || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    throw new Error(`Ungültiger Preis (${label}): ${value}`);
  }
  return Math.round(amount * 100);
}

function parseNumber(value: string, label: string, min: number, max: number): number {
  const cleaned = value.trim().replace(',', '.');
  const parsed = Number(cleaned);
  if (!cleaned || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Ungültiger Wert (${label}): ${value}`);
  }
  return parsed;
}

function parseInteger(value: string, label: string, min: number, max: number): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Ungültige Zahl (${label}): ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'ja', 'yes', 'on', 'wahr'].includes(normalized)) return true;
  if (['0', 'false', 'nein', 'no', 'off', 'falsch', ''].includes(normalized)) return false;
  throw new Error(`Ungültiger Ja/Nein-Wert: ${value}`);
}

function parseList(value: string, label: string, maxLength: number, maxItems: number): string[] {
  const items = value
    .split('|')
    .map((item) => item.trim().replace(/\s+/g, ' ').slice(0, maxLength))
    .filter(Boolean);
  if (items.length > maxItems) throw new Error(`Zu viele Einträge (${label}), maximal ${maxItems}.`);
  return [...new Set(items)];
}

function parseSlugs(value: string, label: string): string[] {
  const items = value
    .split('|')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (items.some((item) => !/^[a-z0-9-]+$/.test(item))) {
    throw new Error(`Ungültiger Schlüssel in ${label}: ${value}`);
  }
  return [...new Set(items)];
}

function parseVariants(value: string): CsvVariant[] {
  if (!value.trim()) return [];
  const variants = value.split('||').map((entry, index) => {
    const parts = entry.split('|');
    if (parts.length < 2 || !parts[0]?.trim()) {
      throw new Error(`Variante ${index + 1} muss mindestens Bezeichnung und Preis enthalten.`);
    }
    return {
      label: parts[0]!.trim().slice(0, 80),
      priceCents: parseMoney(parts[1] ?? '', `Variante ${index + 1}`),
      stock: parseInteger(parts[2] ?? '', `Variantenbestand ${index + 1}`, 0, 1_000_000),
      sortOrder: index + 1,
    };
  });
  if (variants.length > 100) throw new Error('Zu viele Varianten, maximal 100.');
  return variants;
}

/** Liest eine exportierte CSV-Datei und liefert produktweise partielle Zeilen. */
export function parseProductCsv(text: string): ParsedProductCsv {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length === 0) return { rows: [], errors: ['Die CSV-Datei ist leer.'] };

  const header = table[0]!.map(normalizedHeader);
  const columns = new Map<keyof CsvProductInput, number>();
  header.forEach((name, index) => {
    const key = aliasLookup.get(name);
    if (key) columns.set(key, index);
  });
  if (!columns.has('name') && !columns.has('sku') && !columns.has('slug')) {
    return { rows: [], errors: ['Die CSV-Datei enthält keine Spalte „name“, „sku“ oder „slug“.'] };
  }

  const rows: CsvProductRow[] = [];
  const limit = Math.min(table.length - 1, MAX_PRODUCT_CSV_ROWS);
  if (table.length - 1 > MAX_PRODUCT_CSV_ROWS) {
    errors.push(`Die Datei enthält mehr als ${MAX_PRODUCT_CSV_ROWS} Produkte; nur die ersten ${MAX_PRODUCT_CSV_ROWS} werden verarbeitet.`);
  }

  for (let index = 1; index <= limit; index += 1) {
    const values = table[index]!;
    if (values.every((value) => !value.trim())) continue;
    const row: CsvProductRow = {};
    const label = `Zeile ${index + 1}`;

    for (const [key, position] of columns) {
      const raw = values[position] ?? '';
      try {
        switch (key) {
          case 'sku':
          case 'slug':
            row[key] = raw.trim().slice(0, key === 'sku' ? 60 : 120);
            break;
          case 'name':
            row.name = raw.trim().slice(0, 200);
            break;
          case 'categorySlugs':
            row.categorySlugs = parseSlugs(raw, 'kategorien');
            break;
          case 'shortDescription':
            row.shortDescription = raw.slice(0, 300);
            break;
          case 'description':
            row.description = raw.slice(0, 20_000);
            break;
          case 'priceFromCents':
            if (raw.trim()) row.priceFromCents = parseMoney(raw, 'preisAb');
            break;
          case 'priceToCents':
            row.priceToCents = raw.trim() ? parseMoney(raw, 'preisBis') : null;
            break;
          case 'material':
            row.material = raw.trim().slice(0, 100);
            break;
          case 'deliveryNote':
            row.deliveryNote = raw.trim().slice(0, 200);
            break;
          case 'weightG':
            row.weightG = raw.trim() ? parseNumber(raw, 'gewichtG', 0, 1_000_000) : null;
            break;
          case 'dimensions':
            row.dimensions = raw.trim().slice(0, 100);
            break;
          case 'stock':
            row.stock = parseInteger(raw, 'lagerbestand', 0, 1_000_000);
            break;
          case 'sortOrder':
            row.sortOrder = raw.trim() ? parseInteger(raw, 'sortierung', -100_000, 100_000) ?? 0 : undefined;
            break;
          case 'active':
            // Leere Zellen bedeuten „unverändert“, nicht „deaktivieren“.
            if (raw.trim()) row.active = parseBoolean(raw);
            break;
          case 'variants':
            row.variants = parseVariants(raw);
            break;
          case 'colorOptions':
            row.colorOptions = parseList(raw, 'farben', 60, 40);
            break;
          case 'personalizationEnabled':
            if (raw.trim()) row.personalizationEnabled = parseBoolean(raw);
            break;
          case 'personalizationHint':
            row.personalizationHint = raw.trim().slice(0, 200);
            break;
          case 'shippingMethodIds':
            row.shippingMethodIds = parseSlugs(raw, 'versandarten');
            break;
          case 'shippingOptionIds':
            row.shippingOptionIds = parseSlugs(raw, 'versandoptionen');
            break;
        }
      } catch (error) {
        errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!row.name?.trim() && !row.sku?.trim() && !row.slug?.trim()) {
      errors.push(`${label}: Weder Name noch SKU oder Slug angegeben.`);
      continue;
    }
    rows.push(row);
  }

  return { rows, errors };
}
