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

/** Normalisiert IPv4-gemappte IPv6-Adressen (::ffff:1.2.3.4 → 1.2.3.4). */
export function normalizeIp(value: string): string {
  const ip = value.trim().toLowerCase().replace(/%.*$/, '');
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = ((result << 8) + octet) >>> 0;
  }
  return result;
}

function ipv6ToBigInt(ip: string): bigint | null {
  if (!ip.includes(':')) return null;
  const halves = ip.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves[1] === undefined) {
    groups = left;
  } else {
    if (left.length + right.length > 7) return null;
    groups = [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right];
  }
  if (groups.length !== 8) return null;
  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    result = (result << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return result;
}

function inCidr(ip: string, network: string, bits: number): boolean {
  const ip4 = ipv4ToInt(ip);
  const net4 = ipv4ToInt(network);
  if (ip4 !== null && net4 !== null) {
    if (bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ip4 & mask) === (net4 & mask);
  }
  const ip6 = ipv6ToBigInt(ip);
  const net6 = ipv6ToBigInt(network);
  if (ip6 !== null && net6 !== null) {
    if (bits < 0 || bits > 128) return false;
    const mask = bits === 0 ? 0n : (~0n << BigInt(128 - bits)) & ((1n << 128n) - 1n);
    return (ip6 & mask) === (net6 & mask);
  }
  return false;
}

/** Vergleicht die Herkunft mit der Allowlist (exakt oder IPv4-/IPv6-CIDR). */
export function ipAllowed(list: string[], ip: string): boolean {
  if (list.length === 0) return true;
  const actual = normalizeIp(ip);
  return list.some((entry) => {
    const value = normalizeIp(entry);
    if (!value) return false;
    if (value === actual) return true;
    const slash = value.indexOf('/');
    if (slash === -1) return false;
    const bits = Number.parseInt(value.slice(slash + 1), 10);
    if (!Number.isInteger(bits)) return false;
    return inCidr(actual, value.slice(0, slash), bits);
  });
}

/** Prüft einen Bearer-Header gegen gespeicherte Hashs, Sperre, Ablauf und IP-Liste. */
export function resolveApiToken(header: string | undefined, ip: string, forwardedFor?: string): ResolvedApiToken | null {
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
  // NGINX hängt die echte Client-IP als letztes Element an X-Forwarded-For.
  // Nur dieser Wert ist als Fallback zulässig – nicht spoofbare frühere Werte.
  const forwarded = forwardedFor?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
  const lastForwarded = forwarded[forwarded.length - 1];
  const candidates = lastForwarded ? [ip, lastForwarded] : [ip];
  if (!candidates.some((candidate) => ipAllowed(details.ipAllowlist, candidate))) return null;

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
