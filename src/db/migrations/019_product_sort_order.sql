-- Sortierungsnummern der Produkte eindeutig machen.
-- Die bisherige Reihenfolge (sort_order, id) bleibt erhalten; doppelte
-- Nummern werden anhand der ID aufgelöst und alle Werte auf 1..n gesetzt.
-- Die alten Werte werden zuerst in eine Temporärtabelle kopiert: SQLite
-- würde eine korrelierte Unterabfrage während des UPDATEs mit bereits
-- geänderten Zeilen auswerten.
CREATE TEMP TABLE product_order_old (
  id INTEGER PRIMARY KEY,
  rn INTEGER NOT NULL
);
INSERT INTO product_order_old (id, rn)
SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id)
FROM products;
UPDATE products
SET sort_order = (SELECT rn FROM product_order_old WHERE product_order_old.id = products.id);
DROP TABLE product_order_old;
