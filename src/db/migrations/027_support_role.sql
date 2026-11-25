-- F95: Rolle support zulassen (lesen + Notizen). Tabellenneuaufbau wegen CHECK-Constraint.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'support', 'customer')),
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, name, role, totp_secret, totp_enabled, created_at, updated_at)
SELECT id, email, password_hash, name, role, totp_secret, totp_enabled, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
