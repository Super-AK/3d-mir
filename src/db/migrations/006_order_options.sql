-- Gewählte Versand-Zusatzoptionen (z. B. Express, Geschenkverpackung).
ALTER TABLE orders ADD COLUMN options_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  option_id   TEXT NOT NULL,
  label       TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_options_order ON order_options(order_id);
