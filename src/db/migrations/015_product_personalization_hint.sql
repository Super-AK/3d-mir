-- Vom Admin vorgebbarer Platzhaltertext für das Personalisierungsfeld.
--
-- Der Wert erscheint im Shop als grauer Hinweis im optionalen Textfeld und
-- hilft dem Kunden mit einem konkreten Beispiel. Ein leerer Wert bedeutet,
-- dass der Standardtext verwendet wird.
ALTER TABLE products ADD COLUMN personalization_hint TEXT NOT NULL DEFAULT '';
