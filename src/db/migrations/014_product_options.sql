-- Produktvarianten verallgemeinern und Personalisierung ergänzen.
--
-- product_variants bleibt für echte Variationen (z. B. Größe oder Modell) mit
-- eigenem Preis und Bestand. Zusätzlich kann pro Produkt eine kommagetrennte
-- Farbliste ohne Preisunterschied hinterlegt werden. Produkte ohne Varianten
-- sind direkt kaufbar.
--
-- Bestellpositionen halten die gewählte Farbe und eine optionale
-- Personalisierung fest, damit spätere Änderungen am Produkt die Bestellung
-- nicht verfälschen.
ALTER TABLE products ADD COLUMN color_options TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN personalization_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE order_items ADD COLUMN color TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN personalization TEXT NOT NULL DEFAULT '';
