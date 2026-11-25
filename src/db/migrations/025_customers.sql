-- K1: Kundenstamm, Konten, Adressen und Kundennummern (ohne Bestands-Nachtrag).
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_no TEXT NOT NULL UNIQUE CHECK (customer_no GLOB 'KD[0-9][0-9][0-9][0-9][0-9][0-9]'),
  is_guest INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'private' CHECK (type IN ('private', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'anonymized')),
  email TEXT NOT NULL DEFAULT '',
  email_verified_at TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  vat_id TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  marketing_consent_at TEXT,
  faktura_customer_no TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('billing', 'shipping')),
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  address_2 TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT 'DE',
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

CREATE TABLE IF NOT EXISTS customer_accounts (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL DEFAULT '',
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS customer_number_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_value INTEGER NOT NULL DEFAULT 900000
);
INSERT OR IGNORE INTO customer_number_counter (id, last_value) VALUES (1, 900000);

CREATE TABLE IF NOT EXISTS customer_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE orders ADD COLUMN customer_id TEXT;
ALTER TABLE orders ADD COLUMN billing_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_snapshot TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
