import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';

/** Admin-Anmeldung: Sitzungen liegen serverseitig in SQLite, im Cookie steht nur die ID. */
export const ADMIN_COOKIE = 'mir3d_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export type AdminUser = { id: number; email: string; name: string; role: 'admin' };
export type SessionData = { csrf?: string };
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
    .prepare("SELECT id, email, name, role FROM users WHERE id = ? AND role = 'admin'")
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

  if (!row || row.role !== 'admin') return null;
  if (!Number.isFinite(sqliteTime(row.expires_at)) || sqliteTime(row.expires_at) <= Date.now()) {
    db().prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    return null;
  }

  return {
    id: row.id,
    data: parseData(row.data),
    expiresAt: row.expires_at,
    user: { id: row.user_id, email: row.email, name: row.name, role: 'admin' },
  };
}

export function destroySession(session: AdminSession): void {
  db().prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
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
