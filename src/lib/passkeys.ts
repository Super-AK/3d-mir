import { getDb } from '../db/index.js';

/**
 * Passkey-Verwaltung (WebAuthn).
 *
 * Gespeichert werden nur die Credential-ID, der öffentliche Schlüssel und der
 * Signaturzähler. Der private Schlüssel verlässt das Gerät des Nutzers nie.
 */
export type PasskeyRow = {
  id: string;
  user_id: number;
  public_key: Buffer;
  counter: number;
  transports: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
};

function db() {
  return getDb();
}

export function listPasskeys(userId: number): PasskeyRow[] {
  return db()
    .prepare(
      `SELECT id, user_id, public_key, counter, transports, label, created_at, last_used_at
         FROM webauthn_credentials
        WHERE user_id = ?
        ORDER BY created_at DESC, id`,
    )
    .all(userId) as PasskeyRow[];
}

export function countPasskeys(userId: number): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS count FROM webauthn_credentials WHERE user_id = ?')
    .get(userId) as { count: number };
  return row.count;
}

export function findPasskey(id: string): PasskeyRow | undefined {
  return db()
    .prepare(
      `SELECT id, user_id, public_key, counter, transports, label, created_at, last_used_at
         FROM webauthn_credentials
        WHERE id = ?`,
    )
    .get(id) as PasskeyRow | undefined;
}

export function addPasskey(input: {
  id: string;
  userId: number;
  publicKey: Uint8Array | Buffer;
  counter: number;
  transports: string[];
  label: string;
}): void {
  db()
    .prepare(
      `INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, label)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.userId,
      Buffer.from(input.publicKey),
      Math.max(0, Math.trunc(input.counter)),
      JSON.stringify(input.transports),
      input.label.slice(0, 120),
    );
}

export function updatePasskeyCounter(id: string, counter: number): void {
  db()
    .prepare("UPDATE webauthn_credentials SET counter = ?, last_used_at = datetime('now') WHERE id = ?")
    .run(Math.max(0, Math.trunc(counter)), id);
}

export function deletePasskey(userId: number, id: string): boolean {
  const result = db()
    .prepare('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return result.changes > 0;
}

/** Transports aus der Datenbank als Array für SimpleWebAuthn. */
export function passkeyTransports(row: PasskeyRow): string[] {
  try {
    const parsed: unknown = JSON.parse(row.transports);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
