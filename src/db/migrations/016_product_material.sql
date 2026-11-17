-- Materialangabe pro Produkt.
--
-- Bisher stand auf der Produktseite fest „PLA“. Das Material lässt sich nun im
-- Admin pro Produkt pflegen. Bestehende Produkte behalten PLA als Standard.
ALTER TABLE products ADD COLUMN material TEXT NOT NULL DEFAULT 'PLA';
