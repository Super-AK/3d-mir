-- Zwei-Faktor-Authentifizierung für Admin-Konten.
-- Das Secret liegt bereits in users.totp_secret; dieses Flag schaltet die
-- Abfrage beim Login scharf.

ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
