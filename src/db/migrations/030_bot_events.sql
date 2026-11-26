-- Bot-Schutz: Ereignisse (Turnstile, Honeypot, Rate-Limit) ohne personenbezogene Daten.
CREATE TABLE IF NOT EXISTS bot_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  form TEXT NOT NULL,
  reason TEXT NOT NULL,
  ip_prefix TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bot_events_created ON bot_events(created_at);
