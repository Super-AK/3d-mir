-- Ergänzungen für den Admin-Bereich (Phase 5).
-- Statuswechsel werden zusätzlich im Audit-Log und in einer eigenen Historie festgehalten.

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_handled ON contact_messages(handled);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL DEFAULT '',
  to_status   TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

CREATE TABLE IF NOT EXISTS quote_status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id   INTEGER NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL DEFAULT '',
  to_status  TEXT NOT NULL,
  actor      TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quote_status_history_quote ON quote_status_history(quote_id);
