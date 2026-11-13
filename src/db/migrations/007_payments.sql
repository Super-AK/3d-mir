-- Zahlungsstatus, Stripe-Referenzen und sichere Bestelllinks.
-- Bestehende Bestellungen werden anhand ihres Fulfillment-Status als bezahlt übernommen.

ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'offen';
ALTER TABLE orders ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN payment_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN payment_note TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN payment_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN public_token TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN stock_reserved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN stock_released_at TEXT;

-- Für die Bestandsfreigabe muss die Variante bekannt sein.
ALTER TABLE order_items ADD COLUMN variant_id INTEGER;

CREATE TABLE IF NOT EXISTS order_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'offen',
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_provider_id
  ON order_payments(provider, provider_payment_id)
  WHERE provider_payment_id <> '';

-- Webhook-Ereignisse werden genau einmal verarbeitet (Idempotenz).
CREATE TABLE IF NOT EXISTS payment_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  provider   TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  payload    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);

-- Bestehende Bestellungen: bereits erledigte Vorgänge gelten als bezahlt.
UPDATE orders
   SET payment_status = 'bezahlt'
 WHERE status IN ('bezahlt', 'in_druck', 'versandt', 'abgeschlossen')
   AND payment_status = 'offen';

-- Jede Bestellung erhält einen zufälligen Zugriffstoken für Danke-/Zahlungsseiten.
UPDATE orders
   SET public_token = lower(hex(randomblob(16)))
 WHERE public_token = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token
  ON orders(public_token)
  WHERE public_token <> '';
