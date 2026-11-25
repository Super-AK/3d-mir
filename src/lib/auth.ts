import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';

/** Admin-Anmeldung: Sitzungen liegen serverseitig in SQLite, im Cookie steht nur die ID. */
export const ADMIN_COOKIE = 'mir3d_admin';
export const PENDING_ADMIN_COOKIE = 'mir3d_admin_pending';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PENDING_TTL_SECONDS = 5 * 60;
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export type AdminUser = { id: number; email: string; name: string; role: 'admin' | 'support' };
export type SessionData = { csrf?: string; pending2fa?: boolean; challenge?: string };
export type AdminSession = {
  id: string;
  data: SessionData;
  user: AdminUser;
  expiresAt: string;
};

type SessionRow = {
  id: string;
  data: string;
  expires_at: string;
  user_id: number;
  email: string;
  name: string;
  role: string;
};

function db() {
  return getDb();
}

/** Wandelt SQLite-Zeitstempel (UTC) in Millisekunden um. */
function sqliteTime(value: string): number {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

function parseData(value: string): SessionData {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as SessionData) : {};
  } catch {
    return {};
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Erzeugt eine neue Admin-Sitzung und räumt abgelaufene Sitzungen auf. */
export function createSession(userId: number): AdminSession {
  const id = crypto.randomBytes(32).toString('hex');
  const data: SessionData = { csrf: crypto.randomBytes(32).toString('hex') };
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  db().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  db()
    .prepare('INSERT INTO sessions (id, user_id, data, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, JSON.stringify(data), expiresAt);

  const user = db()
    .prepare("SELECT id, email, name, role FROM users WHERE id = ? AND role IN ('admin', 'support')")
    .get(userId) as AdminUser | undefined;
  if (!user) throw new Error('Admin-Benutzer nicht gefunden.');

  return { id, data, user, expiresAt };
}

/** Liest die Sitzung aus dem signierten Cookie. Ungültige oder abgelaufene Sitzungen ergeben null. */
export function getSession(request: FastifyRequest): AdminSession | null {
  const raw = request.cookies?.[ADMIN_COOKIE];
  if (!raw) return null;

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const row = db()
    .prepare(
      `SELECT s.id, s.data, s.expires_at, u.id AS user_id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(unsigned.value) as SessionRow | undefined;

  if (!row || !['admin', 'support'].includes(row.role)) return null;
  if (!Number.isFinite(sqliteTime(row.expires_at)) || sqliteTime(row.expires_at) <= Date.now()) {
    db().prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    return null;
  }

  const data = parseData(row.data);
  // Vorläufige Sitzungen aus dem Passwort-Schritt gelten nicht als angemeldet.
  if (data.pending2fa) return null;

  return {
    id: row.id,
    data,
    expiresAt: row.expires_at,
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role as AdminUser['role'] },
  };
}

/** Legt eine kurzlebige Sitzung für den zweiten Faktor an. */
export function createPendingLogin(userId: number): { id: string; expiresAt: string } {
  const id = crypto.randomBytes(32).toString('hex');
  const data: SessionData = { pending2fa: true };
  const expiresAt = new Date(Date.now() + PENDING_TTL_SECONDS * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  db().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  db()
    .prepare('INSERT INTO sessions (id, user_id, data, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, JSON.stringify(data), expiresAt);
  return { id, expiresAt };
}

/** Liest die vorläufige Sitzung nach erfolgreicher Passwortprüfung. */
export function getPendingLogin(
  request: FastifyRequest,
): { id: string; user: AdminUser; expiresAt: string; data: SessionData } | null {
  const raw = request.cookies?.[PENDING_ADMIN_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const row = db()
    .prepare(
      `SELECT s.id, s.data, s.expires_at, u.id AS user_id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(unsigned.value) as SessionRow | undefined;
  if (!row || !['admin', 'support'].includes(row.role)) return null;
  if (!parseData(row.data).pending2fa) return null;
  if (!Number.isFinite(sqliteTime(row.expires_at)) || sqliteTime(row.expires_at) <= Date.now()) {
    db().prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    return null;
  }

  return {
    id: row.id,
    expiresAt: row.expires_at,
    data: parseData(row.data),
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role as AdminUser['role'] },
  };
}

export function destroySession(session: AdminSession): void {
  db().prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
}

/** Löscht eine Sitzung anhand ihrer ID (auch vorläufige 2FA-Sitzungen). */
export function destroySessionById(sessionId: string): void {
  db().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/** Speichert eine WebAuthn-Challenge in der Sitzung (oder löscht sie). */
export function setSessionChallenge(sessionId: string, challenge: string | null): void {
  const row = db().prepare('SELECT data FROM sessions WHERE id = ?').get(sessionId) as
    | { data: string }
    | undefined;
  if (!row) return;
  const data = parseData(row.data);
  if (challenge) data.challenge = challenge;
  else delete data.challenge;
  db().prepare('UPDATE sessions SET data = ? WHERE id = ?').run(JSON.stringify(data), sessionId);
}

export function setSessionCookie(reply: FastifyReply, request: FastifyRequest, sessionId: string): void {
  reply.setCookie(ADMIN_COOKIE, sessionId, {
    path: '/admin',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    signed: true,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: '/admin' });
}

export function setPendingCookie(reply: FastifyReply, request: FastifyRequest, sessionId: string): void {
  reply.setCookie(PENDING_ADMIN_COOKIE, sessionId, {
    path: '/admin',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    signed: true,
    maxAge: PENDING_TTL_SECONDS,
  });
}

export function clearPendingCookie(reply: FastifyReply): void {
  reply.clearCookie(PENDING_ADMIN_COOKIE, { path: '/admin' });
}

/** Liefert das CSRF-Token der Sitzung und legt es bei Bedarf an. */
export function csrfToken(session: AdminSession): string {
  if (!session.data.csrf) {
    session.data.csrf = crypto.randomBytes(32).toString('hex');
    db()
      .prepare('UPDATE sessions SET data = ? WHERE id = ?')
      .run(JSON.stringify(session.data), session.id);
  }
  return session.data.csrf;
}

/** Prüft ein CSRF-Token gegen das Token der Sitzung. */
export function verifyCsrfToken(session: AdminSession, token: unknown): boolean {
  const expected = session.data.csrf;
  if (typeof token !== 'string' || !expected) return false;
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** Prüft das versteckte CSRF-Feld gegen das Token der Sitzung. */
export function verifyCsrf(session: AdminSession, request: FastifyRequest): boolean {
  const body = request.body;
  if (!body || typeof body !== 'object') return false;
  return verifyCsrfToken(session, (body as Record<string, unknown>)._csrf);
}

export function writeAudit(actor: string, action: string, details: unknown = ''): void {
  const text = typeof details === 'string' ? details : JSON.stringify(details);
  db()
    .prepare('INSERT INTO audit_log (actor, action, details) VALUES (?, ?, ?)')
    .run(actor.slice(0, 200), action.slice(0, 100), text.slice(0, 4000));
}
