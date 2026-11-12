-- Produktspezifische Versandarten und Zusatzoptionen.
-- Leere Liste bei shipping_method_ids bedeutet: alle aktiven Versandarten.
ALTER TABLE products ADD COLUMN shipping_method_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN shipping_option_ids TEXT NOT NULL DEFAULT '[]';
