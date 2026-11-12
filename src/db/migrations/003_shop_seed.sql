-- Shop-Grunddaten: Recycling-Box aus dem übernommenen Altbestand.
-- Preise sind Platzhalter (TODO-PREISE) und werden vor dem Livegang bestätigt.

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_unique ON product_variants(product_id, label);

INSERT OR IGNORE INTO products
  (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g, dimensions, stock, active, sort_order)
VALUES (
  'recycling-box-batterien',
  'Recycling-Box mit Deckel für leere Batterien',
  '3D-gedruckte Aufbewahrungsbox mit Deckel für gebrauchte Batterien – in Wunschfarbe, mit Wabenmuster und Einwurföffnung.',
  'Die Recycling-Box mit Deckel für leere Batterien wird mit modernster Technologie hergestellt. Sie wird 3D-gedruckt aus umweltfreundlichem PLA (Polylactid), einem biologisch abbaubaren Kunststoff, der aus nachwachsenden Rohstoffen hergestellt wird.

Das FDM-Verfahren (Fused Deposition Modeling) wird verwendet, um die Box Schicht für Schicht aufzubauen und eine hohe Präzision und Detailtreue zu erreichen. Dadurch wird gewährleistet, dass die Recycling-Box genau den Anforderungen entspricht und robust genug ist, um eine lange Lebensdauer zu garantieren.

Durch den Einsatz von 3D-Druck und PLA-Material wird nicht nur die Umwelt geschont, sondern auch die lokale Produktion und nachhaltige Herstellung gefördert. So können wir gemeinsam einen Beitrag zum Schutz der Umwelt leisten und gleichzeitig ein hochwertiges und praktisches Produkt erhalten.

Aufbewahrungs-Box mit Deckel:
– In Wunschfarbe.
– Mit Waben-Muster Löcher zur Kontrolle, wie voll die Box ist.
– Mit Deckel (nicht abschließbar).
– Mit Einwurföffnung.
– Für verschiedene Größen geeignet (AA, AAA, andere).

Bemaßungen:
Länge = 110 mm
Breite = 65 mm
Höhe = 87 mm',
  1100,
  1250,
  'KAP-202308',
  NULL,
  '110 × 65 × 87 mm',
  NULL,
  1,
  1
);

INSERT OR IGNORE INTO product_variants (product_id, label, price_cents, stock, sort_order)
SELECT p.id, v.label, 1100, NULL, v.sort_order
FROM products p,
  (
    SELECT 'Gelb' AS label, 1 AS sort_order
    UNION ALL SELECT 'Grau', 2
    UNION ALL SELECT 'Himmel-Blau', 3
    UNION ALL SELECT 'Orange', 4
    UNION ALL SELECT 'Rose', 5
    UNION ALL SELECT 'Silber', 6
    UNION ALL SELECT 'Violet', 7
    UNION ALL SELECT 'Wasser-Blau', 8
    UNION ALL SELECT 'Schwarz', 9
    UNION ALL SELECT 'Weiß', 10
    UNION ALL SELECT 'Blau', 11
    UNION ALL SELECT 'Grün', 12
    UNION ALL SELECT 'Random-Verlauf', 13
    UNION ALL SELECT 'Rot', 14
  ) AS v
WHERE p.slug = 'recycling-box-batterien';

INSERT INTO product_images (product_id, file, alt, sort_order)
SELECT p.id, 'product-battery-box', 'Recycling-Box mit Deckel für leere Batterien', 1
FROM products p
WHERE p.slug = 'recycling-box-batterien'
  AND NOT EXISTS (
    SELECT 1 FROM product_images i WHERE i.product_id = p.id AND i.file = 'product-battery-box'
  );
