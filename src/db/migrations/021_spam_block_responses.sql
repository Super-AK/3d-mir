-- Statistik für Spam-Sperren: Anzahl der Antworten mit HTTP 404
-- („Datei wurde nicht gefunden“) für gesperrte Kontakt-Absender.

CREATE TABLE IF NOT EXISTS spam_block_responses (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  total INTEGER NOT NULL DEFAULT 0,
  last_at TEXT
);

INSERT OR IGNORE INTO spam_block_responses (id, total, last_at) VALUES (1, 0, NULL);
