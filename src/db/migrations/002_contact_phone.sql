-- Ergänzt die optionale Telefonnummer im Kontaktformular.
ALTER TABLE contact_messages ADD COLUMN phone TEXT NOT NULL DEFAULT '';
