-- Spam-Abwehr für das Kontaktformular: pseudonymisierte Absenderkennung,
-- Versuchszähler und automatische Sperren.
--
-- Die vollständige IP-Adresse wird nicht gespeichert. Gespeichert werden:
--   ip_hash    – HMAC-SHA256 der IP-Adresse (nicht rückführbar ohne Server-Secret)
--   ip_prefix  – gekürzte IP-Adresse (IPv4 /24, IPv6 /48) für die Diagnose
--   user_agent – Browserkennung, gekürzt
--
-- contact_blocks enthält pro Absender eine Zeile. Solange blocked = 0 ist,
-- wird der Absender nur beobachtet. Nach der eingestellten Anzahl auffälliger
-- Versuche wird blocked = 1 gesetzt; blocked_until = NULL bedeutet dauerhaft.
ALTER TABLE contact_messages ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN ip_prefix TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_contact_messages_ip ON contact_messages(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS contact_blocks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash          TEXT NOT NULL UNIQUE,
  ip_prefix        TEXT NOT NULL DEFAULT '',
  country          TEXT NOT NULL DEFAULT '',
  user_agent       TEXT NOT NULL DEFAULT '',
  reason           TEXT NOT NULL DEFAULT '',
  attempts         INTEGER NOT NULL DEFAULT 0,
  first_seen       TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen        TEXT NOT NULL DEFAULT (datetime('now')),
  blocked          INTEGER NOT NULL DEFAULT 0,
  blocked_until    TEXT,
  last_notified_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_blocks_status ON contact_blocks(blocked, last_seen);
