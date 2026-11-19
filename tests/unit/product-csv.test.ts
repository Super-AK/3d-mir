import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  parseProductCsv,
  productCsv,
  stringifyCsv,
  type CsvProductInput,
} from '../../src/lib/product-csv.js';

const product: CsvProductInput = {
  sku: 'CSV-1',
  slug: 'csv-beispiel',
  name: 'Beispiel; Produkt',
  categorySlugs: ['kueche', 'saisonales'],
  shortDescription: 'Kurz "beschreibung"',
  description: 'Zeile 1\nZeile 2',
  priceFromCents: 1290,
  priceToCents: 1990,
  material: 'PLA',
  deliveryNote: 'Fertigung nach Bezahlung',
  weightG: 150.5,
  dimensions: '10 x 10 x 5 cm',
  stock: 7,
  sortOrder: 3,
  active: true,
  variants: [
    { label: 'Klein', priceCents: 1290, stock: 7, sortOrder: 1 },
    { label: 'Groß', priceCents: 1990, stock: 2, sortOrder: 2 },
  ],
  colorOptions: ['schwarz', 'weiß'],
  personalizationEnabled: false,
  personalizationHint: 'Wunschtext',
  personalizationPriceCents: 250,
  shippingMethodIds: ['standard'],
  shippingOptionIds: ['versichert'],
};

describe('Produkt-CSV', () => {
  it('liest Semikolon-, Komma- und zitierte Felder korrekt', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\n"x,y","z""q"')).toEqual([
      ['a', 'b'],
      ['x,y', 'z"q'],
    ]);
    expect(parseCsv('a;b\n"mehr\nzeilen";2')[1]?.[0]).toBe('mehr\nzeilen');
  });

  it('schreibt BOM, CRLF und maskierte Anführungszeichen', () => {
    expect(stringifyCsv([['a', 'b'], ['x;y', 'z"q']])).toBe(
      '\uFEFFa;b\r\n"x;y";"z""q"\r\n',
    );
  });

  it('exportiert und importiert ein Produkt ohne Datenverlust', () => {
    const parsed = parseProductCsv(productCsv([product]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      sku: 'CSV-1',
      slug: 'csv-beispiel',
      name: 'Beispiel; Produkt',
      categorySlugs: ['kueche', 'saisonales'],
      shortDescription: 'Kurz "beschreibung"',
      description: 'Zeile 1\nZeile 2',
      priceFromCents: 1290,
      priceToCents: 1990,
      weightG: 150.5,
      stock: 7,
      sortOrder: 3,
      active: true,
      colorOptions: ['schwarz', 'weiß'],
      personalizationEnabled: false,
      personalizationPriceCents: 250,
      shippingMethodIds: ['standard'],
      shippingOptionIds: ['versichert'],
    });
    expect(parsed.rows[0]?.variants).toEqual(product.variants);
  });

  it('versteht deutsche und englische Spaltennamen', () => {
    const parsed = parseProductCsv(
      'Artikelnummer;Titel;Preis;Kategorien;Aktiv;Varianten;Farben\nS-2;Test;7,50;bad;ja;Standard|7,50|;rot',
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      sku: 'S-2',
      name: 'Test',
      priceFromCents: 750,
      categorySlugs: ['bad'],
      active: true,
      colorOptions: ['rot'],
    });
    expect(parsed.rows[0]?.variants?.[0]).toMatchObject({ label: 'Standard', priceCents: 750 });
  });

  it('leere Ja/Nein- und Preis-Zellen bleiben unverändert', () => {
    const parsed = parseProductCsv(
      'sku;name;aktiv;personalisierung;personalisierungspreis\nS-3;Test;;;',
    );
    expect(parsed.rows[0]?.active).toBeUndefined();
    expect(parsed.rows[0]?.personalizationEnabled).toBeUndefined();
    expect(parsed.rows[0]?.personalizationPriceCents).toBeUndefined();

    const english = parseProductCsv('sku;name;personalizationPrice\nS-3a;Test;3,50');
    expect(english.errors).toEqual([]);
    expect(english.rows[0]?.personalizationPriceCents).toBe(350);
  });

  it('meldet ungültige Preise, Varianten und Schlüssel', () => {
    const parsed = parseProductCsv(
      'sku;name;preisAb;varianten;versandarten\nS-4;Test;abc;Klein;bad ID',
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors).toHaveLength(3);
    expect(parsed.errors.join(' ')).toContain('Ungültiger Preis');
    expect(parsed.errors.join(' ')).toContain('Variante 1');
    expect(parsed.errors.join(' ')).toContain('versandarten');
  });

  it('schützt Tabellenellen vor Formel-Einschleusung', () => {
    const csv = productCsv([{ ...product, name: '=SUM(A1:A9)' }]);
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(parseProductCsv(csv).rows[0]?.name).toBe("'=SUM(A1:A9)");
  });
});
