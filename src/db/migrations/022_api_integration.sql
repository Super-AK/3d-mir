-- API v1 für die Faktura-App: Tokens, Zugriffsprotokoll und Rechnungsrückmeldung.
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT '[]',
  ip_allowlist TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  revoked_at TEXT,
  rotated_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_token_previous (
  token_hash TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  valid_until TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  token_id INTEGER,
  token_name TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_access_log_created ON api_access_log(created_at);

ALTER TABLE orders ADD COLUMN invoice_number TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN invoice_date TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN invoice_url TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN delivery_note_number TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN invoice_updated_at TEXT;
ALTER TABLE orders ADD COLUMN api_first_exposed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_api_updated ON orders(updated_at, id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
