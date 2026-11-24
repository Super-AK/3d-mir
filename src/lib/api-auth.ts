import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { API_SCOPES, type ApiScope } from './api-settings.js';

const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

type TokenRow = {
  id: number;
  name: string;
  token_hash: string;
  scopes: string;
  ip_allowlist: string;
  expires_at: string | null;
  revoked_at: string | null;
  rotated_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type ApiTokenInfo = {
  id: number;
  name: string;
  scopes: ApiScope[];
  ipAllowlist: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type ResolvedApiToken = ApiTokenInfo & { tokenId: number };

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseJson(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scopesOf(value: string): ApiScope[] {
  return parseJson(value).filter((item): item is ApiScope =>
    API_SCOPES.includes(item as ApiScope),
  );
}

function info(row: TokenRow): ApiTokenInfo {
  return {
    id: row.id,
    name: row.name,
    scopes: scopesOf(row.scopes),
    ipAllowlist: parseJson(row.ip_allowlist).filter((item): item is string => typeof item === 'string'),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    rotatedAt: row.rotated_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

/** Erzeugt einen Token; der Klartext wird nur einmal zurückgegeben. */
export function createApiToken(input: {
  name: string;
  scopes: ApiScope[];
  ipAllowlist?: string[];
  expiresAt?: string | null;
}): { token: string; info: ApiTokenInfo } {
  const name = input.name.trim().slice(0, 100) || 'API-Token';
  const scopes = [...new Set(input.scopes.filter((scope) => API_SCOPES.includes(scope)))];
  const token = crypto.randomBytes(32).toString('hex');
  const result = getDb()
    .prepare(
      `INSERT INTO api_tokens (name, token_hash, scopes, ip_allowlist, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      name,
      hash(token),
      JSON.stringify(scopes),
      JSON.stringify(input.ipAllowlist ?? []),
      input.expiresAt || null,
    );
  const row = getDb()
    .prepare('SELECT * FROM api_tokens WHERE id = ?')
    .get(result.lastInsertRowid) as TokenRow;
  return { token, info: info(row) };
}

export function listApiTokens(): ApiTokenInfo[] {
  const rows = getDb()
    .prepare('SELECT * FROM api_tokens ORDER BY created_at DESC, id DESC')
    .all() as TokenRow[];
  return rows.map(info);
}

export function revokeApiToken(id: number): boolean {
  return (
    getDb()
      .prepare("UPDATE api_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL")
      .run(id).changes > 0
  );
}

export function deleteApiToken(id: number): boolean {
  return getDb().prepare('DELETE FROM api_tokens WHERE id = ?').run(id).changes > 0;
}

/** Rotiert einen Token; der alte bleibt 24 Stunden übergangsweise gültig. */
export function rotateApiToken(id: number): { token: string; info: ApiTokenInfo } | null {
  const row = getDb().prepare('SELECT * FROM api_tokens WHERE id = ?').get(id) as TokenRow | undefined;
  if (!row || row.revoked_at) return null;
  const token = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare(
      `UPDATE api_tokens SET token_hash = ?, rotated_at = datetime('now'), last_used_at = NULL
       WHERE id = ?`,
    )
    .run(hash(token), id);
  // Der vorherige Hash wird für die Übergangszeit separat hinterlegt.
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO api_token_previous (token_id, token_hash, valid_until)
       VALUES (?, ?, datetime('now', '+24 hours'))`,
    )
    .run(id, row.token_hash);
  const updated = getDb().prepare('SELECT * FROM api_tokens WHERE id = ?').get(id) as TokenRow;
  return { token, info: info(updated) };
}

function ipAllowed(list: string[], ip: string): boolean {
  if (list.length === 0) return true;
  return list.some((entry) => {
    const value = entry.trim();
    if (!value) return false;
    if (value === ip) return true;
    if (!value.includes('/') || !ip.includes('.')) return false;
    const [network, bitsRaw] = value.split('/');
    const bits = Number.parseInt(bitsRaw ?? '', 10);
    if (!network || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const toInt = (address: string): number =>
      address.split('.').reduce((sum, part) => (sum * 256 + (Number.parseInt(part, 10) || 0)) >>> 0, 0);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (toInt(ip) & mask) === (toInt(network) & mask);
  });
}

/** Prüft einen Bearer-Header gegen gespeicherte Hashs, Sperre, Ablauf und IP-Liste. */
export function resolveApiToken(header: string | undefined, ip: string): ResolvedApiToken | null {
  if (!header || !/^Bearer\s+\S+$/i.test(header)) return null;
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const digest = hash(token);
  const row = getDb()
    .prepare('SELECT * FROM api_tokens WHERE token_hash = ?')
    .get(digest) as TokenRow | undefined;

  let resolvedRow = row;
  if (!resolvedRow) {
    const previous = getDb()
      .prepare(
        `SELECT token_id FROM api_token_previous
         WHERE token_hash = ? AND valid_until > datetime('now')`,
      )
      .get(digest) as { token_id: number } | undefined;
    if (!previous) return null;
    resolvedRow = getDb()
      .prepare('SELECT * FROM api_tokens WHERE id = ? AND revoked_at IS NULL')
      .get(previous.token_id) as TokenRow | undefined;
    if (!resolvedRow) return null;
  }

  if (resolvedRow.revoked_at) return null;
  if (resolvedRow.expires_at && resolvedRow.expires_at <= new Date().toISOString().slice(0, 19).replace('T', ' ')) {
    return null;
  }
  const details = info(resolvedRow);
  if (!ipAllowed(details.ipAllowlist, ip)) return null;

  getDb()
    .prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?")
    .run(resolvedRow.id);
  return { ...details, tokenId: resolvedRow.id };
}

export function hasApiScope(token: ResolvedApiToken | null, scope: ApiScope): boolean {
  return Boolean(token?.scopes.includes(scope));
}

/** Bereinigt abgelaufene Einträge der Rotations-Übergangszeit. */
export function cleanupPreviousApiTokens(): void {
  getDb().prepare("DELETE FROM api_token_previous WHERE valid_until <= datetime('now')").run();
}
