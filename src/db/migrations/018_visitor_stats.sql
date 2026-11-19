-- Besucherstatistik: ausschließlich pseudonyme Zähler, keine IP-Adressen und
-- keine Cookies. Der Besucher-Hash wird täglich neu berechnet (HMAC aus
-- gekürzter IP und Datum) und ist ohne das Server-Secret nicht rückführbar.
-- Das Herkunftsland wird nur als ISO-Code gespeichert.

CREATE TABLE IF NOT EXISTS visitor_stats (
  day         TEXT NOT NULL,                  -- YYYY-MM-DD (UTC)
  country     TEXT NOT NULL DEFAULT '',       -- ISO-3166-1 alpha-2 oder '' unbekannt
  visitor_hash TEXT NOT NULL,                 -- täglich wechselnder HMAC
  views       INTEGER NOT NULL DEFAULT 0,
  last_seen   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (day, country, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_visitor_stats_day ON visitor_stats (day);
CREATE INDEX IF NOT EXISTS idx_visitor_stats_country ON visitor_stats (country);

-- Aufgerufene Pfade ohne Query-String; numerische Segmente werden zu ':'.
CREATE TABLE IF NOT EXISTS visitor_pages (
  day   TEXT NOT NULL,
  path  TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_visitor_pages_day ON visitor_pages (day);
