-- Lieferhinweis pro Produkt.
--
-- Bisher stand auf der Produktseite fest „Fertigung nach Bestellung“. Der
-- Hinweis lässt sich nun pro Produkt pflegen, z. B. „Fertigung nach Bezahlung“
-- oder „sofort lieferbar“. Bestehende Produkte erhalten den bisherigen Text.
ALTER TABLE products ADD COLUMN delivery_note TEXT NOT NULL DEFAULT 'Fertigung nach Bezahlung';
