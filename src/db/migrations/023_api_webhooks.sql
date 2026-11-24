-- Phase 2 der Shop-API: Status-Rückmeldung und Webhook-Zustellprotokoll.
ALTER TABLE orders ADD COLUMN tracking_number TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_webhook_pending ON api_webhook_deliveries(status, next_attempt_at);
