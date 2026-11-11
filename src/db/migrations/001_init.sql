-- Grundschema für 3D-MIR
-- Alle Geldbeträge werden als Ganzzahl in Cent gespeichert.

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_blocks (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  totp_secret   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  price_from_cents  INTEGER NOT NULL DEFAULT 0,
  price_to_cents    INTEGER,
  sku               TEXT,
  weight_g          REAL,
  dimensions        TEXT,
  stock             INTEGER,
  active            INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  stock       INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'neu'
                   CHECK (status IN ('neu', 'bezahlt', 'in_druck', 'versandt', 'abgeschlossen', 'storniert')),
  email            TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  company          TEXT NOT NULL DEFAULT '',
  street           TEXT NOT NULL,
  address_extra    TEXT NOT NULL DEFAULT '',
  zip              TEXT NOT NULL,
  city             TEXT NOT NULL,
  country          TEXT NOT NULL DEFAULT 'DE',
  phone            TEXT NOT NULL DEFAULT '',
  payment_method   TEXT NOT NULL,
  shipping_method  TEXT NOT NULL,
  shipping_cents   INTEGER NOT NULL DEFAULT 0,
  subtotal_cents   INTEGER NOT NULL DEFAULT 0,
  total_cents      INTEGER NOT NULL DEFAULT 0,
  customer_note    TEXT NOT NULL DEFAULT '',
  admin_note       TEXT NOT NULL DEFAULT '',
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  variant          TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_requests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  reference             TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'neu'
                        CHECK (status IN ('neu', 'geprueft', 'angebot_gesendet', 'angenommen', 'abgelehnt', 'abgeschlossen')),
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL DEFAULT '',
  company               TEXT NOT NULL DEFAULT '',
  message               TEXT NOT NULL DEFAULT '',
  material_id           TEXT NOT NULL,
  color                 TEXT NOT NULL DEFAULT '',
  printer_id            TEXT NOT NULL,
  infill                INTEGER NOT NULL,
  layer_height          REAL NOT NULL,
  quantity              INTEGER NOT NULL,
  coating               TEXT NOT NULL DEFAULT 'none',
  scale_percent         REAL NOT NULL DEFAULT 100,
  unit                  TEXT NOT NULL DEFAULT 'mm',
  dimensions            TEXT NOT NULL DEFAULT '{}',
  volume_cm3            REAL NOT NULL DEFAULT 0,
  surface_cm2           REAL NOT NULL DEFAULT 0,
  weight_g              REAL NOT NULL DEFAULT 0,
  estimated_price_cents INTEGER NOT NULL DEFAULT 0,
  file_path             TEXT,
  file_name             TEXT,
  file_size             INTEGER,
  file_sha256           TEXT,
  consent_at            TEXT NOT NULL,
  admin_note            TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quote_requests(created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  handled    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT NOT NULL DEFAULT 'system',
  action     TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Startinhalte, die der Betreiber im Admin-Bereich ändern kann.
INSERT OR IGNORE INTO content_blocks (key, value) VALUES
  ('home.hero.kicker', 'FDM-3D-Druck aus dem Schwarzwald'),
  ('home.hero.title', 'Ihre Idee. Gedruckt in 3D.'),
  ('home.hero.text', 'Prototyping, Modellbau, Kleinserien und Ersatzteile – gefertigt in Schömberg. Laden Sie Ihr Modell hoch und erhalten Sie in wenigen Minuten eine unverbindliche Preisschätzung.'),
  ('home.contact.title', 'Sie haben eine Frage oder ein besonderes Teil?'),
  ('home.contact.text', 'Schreiben Sie uns – wir prüfen Ihr Modell, beraten zur Materialwahl und melden uns in der Regel innerhalb eines Werktags.');
