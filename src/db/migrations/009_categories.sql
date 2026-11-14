-- Produktkategorien und Zuordnung.
CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_category_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_links_category ON product_category_links(category_id);

INSERT INTO product_categories (slug, name, sort_order) VALUES
  ('aufbewahrung', 'Aufbewahrung', 10),
  ('bad', 'Bad', 20),
  ('kueche', 'Küche', 30),
  ('deko', 'Deko', 40),
  ('brettspiele', 'Brettspiele', 50),
  ('werkstatt', 'Werkstatt', 60),
  ('saisonales', 'Saisonales', 70)
ON CONFLICT(slug) DO NOTHING;

-- Startzuordnung anhand der Produktnamen; im Admin jederzeit änderbar.
INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'aufbewahrung'
WHERE p.name LIKE '%Aufbewahrung%' OR p.name LIKE '%Batterie%' OR p.name LIKE '%Recycling%'
   OR p.name LIKE '%Bierkiste%' OR p.name LIKE '%Bierkasten%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'bad'
WHERE p.name LIKE '%Toilettenpapier%' OR p.name LIKE '%Handtuch%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'kueche'
WHERE p.name LIKE '%Trichter%' OR p.name LIKE '%Plätzchen%' OR p.name LIKE '%Ausstecher%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'deko'
WHERE p.name LIKE '%Blumenuntertopf%' OR p.name LIKE '%Osterhase%' OR p.name LIKE '%Deko%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'brettspiele'
WHERE p.name LIKE '%Spielfiguren%' OR p.name LIKE '%Pöppel%' OR p.name LIKE '%Halmakegel%'
   OR p.name LIKE '%Brettspiel%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'werkstatt'
WHERE p.name LIKE '%Luftgitter%' OR p.name LIKE '%Tiefenanschlag%' OR p.name LIKE '%Bohrer%'
   OR p.name LIKE '%Fräser%';

INSERT OR IGNORE INTO product_category_links (product_id, category_id)
SELECT p.id, c.id FROM products p JOIN product_categories c ON c.slug = 'saisonales'
WHERE p.name LIKE '%Weihnacht%' OR p.name LIKE '%Plätzchen%' OR p.name LIKE '%Oster%';
