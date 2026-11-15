-- Passkeys (WebAuthn) für Admin-Konten.
-- Die Credential-ID ist base64url-kodiert; der öffentliche Schlüssel wird
-- als BLOB gespeichert. Transports sind ein JSON-Array.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key   BLOB NOT NULL,
  counter      INTEGER NOT NULL DEFAULT 0,
  transports   TEXT NOT NULL DEFAULT '[]',
  label        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);
