-- Optionaler Aufpreis für Personalisierung pro Stück.
-- Der Betrag wird nur berechnet, wenn der Kunde tatsächlich einen Text
-- eingibt. Bestehende Produkte behalten einen Aufpreis von 0,00 €.
ALTER TABLE products ADD COLUMN personalization_price_cents INTEGER NOT NULL DEFAULT 0;
