-- K5/K6: Kundenkonten, einmalige Tokens, Kundensitzungen und Admin-Notizen.
CREATE TABLE IF NOT EXISTS customer_auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset', 'email_change')),
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_auth_customer ON customer_auth_tokens(customer_id);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires ON customer_sessions(expires_at);

ALTER TABLE customers ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN invoice_expires_at TEXT;
