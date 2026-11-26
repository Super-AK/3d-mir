import crypto from 'node:crypto';
import argon2 from 'argon2';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { getLogger } from './logger.js';
import { sendMail } from './mailer.js';
import { ensureCustomer, getCustomerByEmail, normalizedEmail, touchCustomer, writeCustomerAudit } from './customers.js';
import { queueWebhook } from './api-webhooks.js';

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const COMMON_PASSWORDS = new Set([
  'password',
  'passwort',
  '1234567890',
  '123456789',
  '12345678',
  'qwertyuiop',
  'iloveyou',
  'admin1234',
  'testpasswort',
]);

type AuthRow = {
  customer_id: string;
  password_hash: string;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
};

type TokenRow = {
  id: number;
  customer_id: string;
  kind: 'verify' | 'reset' | 'email_change';
  payload: string;
  expires_at: string;
  used_at: string | null;
};

export type CustomerSession = {
  id: string;
  customerId: string;
  data: { csrf?: string };
  expiresAt: string;
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Versendet eine Kunden-Mail und macht SMTP-Fehler im Log sichtbar (ohne PII). */
async function sendCustomerMail(options: {
  subject: string;
  text: string;
  html?: string;
  to: string;
}): Promise<boolean> {
  try {
    const result = await sendMail(options);
    if (!result.delivered && !result.savedTo) {
      getLogger().error({ subject: options.subject }, 'Kunden-E-Mail wurde nicht zugestellt');
      return false;
    }
    return true;
  } catch (error) {
    getLogger().error(
      { subject: options.subject, err: error instanceof Error ? error.message : 'unbekannter Fehler' },
      'Kunden-E-Mail fehlgeschlagen',
    );
    return false;
  }
}

function sqlUtc(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}

function issueToken(customerId: string, kind: TokenRow['kind'], payload = '', minutes = 60): string {
  const token = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare(
      `INSERT INTO customer_auth_tokens (customer_id, kind, token_hash, payload, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(customerId, kind, hashToken(token), payload, sqlUtc(minutes));
  return token;
}

function consumeToken(token: string, kind: TokenRow['kind']): TokenRow | null {
  const digest = hashToken(token);
  const row = getDb()
    .prepare(
      "SELECT * FROM customer_auth_tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > datetime('now')",
    )
    .get(digest, kind) as TokenRow | undefined;
  if (!row) return null;
  const changed = getDb()
    .prepare('UPDATE customer_auth_tokens SET used_at = datetime(\'now\') WHERE id = ? AND used_at IS NULL')
    .run(row.id);
  return changed.changes === 1 ? row : null;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 10 && !COMMON_PASSWORDS.has(password.toLowerCase());
}

/** Neutral: verrät nie, ob die Adresse bereits existiert. */
export async function registerCustomer(email: string, password: string): Promise<{ ok: true }> {
  const normalized = normalizedEmail(email);
  if (!isStrongPassword(password)) return { ok: true };
  const existing = getCustomerByEmail(normalized);
  const { customer } = existing
    ? { customer: existing }
    : ensureCustomer({ email: normalized, isGuest: false });
  const hash = await argon2.hash(password, ARGON_OPTIONS);
  getDb()
    .prepare(
      `INSERT INTO customer_accounts (customer_id, password_hash, failed_logins, last_login_at)
       VALUES (?, ?, 0, datetime('now'))
       ON CONFLICT(customer_id) DO UPDATE SET password_hash = excluded.password_hash, failed_logins = 0`,
    )
    .run(customer.id, hash);
  const token = issueToken(customer.id, 'verify', '', 48 * 60);
  const link = `${config.site.baseUrl.replace(/\/$/, '')}/konto/bestaetigen/?token=${token}`;
  await sendCustomerMail({
    to: normalized,
    subject: 'Bitte E-Mail-Adresse bestätigen – 3D-MIR',
    text: `Bitte bestätigen Sie Ihre E-Mail-Adresse: ${link}\nDer Link ist 48 Stunden gültig.`,
    html: `<p>Bitte bestätigen Sie Ihre E-Mail-Adresse:</p><p><a href="${link}">E-Mail bestätigen</a></p><p>Der Link ist 48 Stunden gültig.</p>`,
  });
  writeCustomerAudit('system', 'customer.register', { id: customer.id });
  return { ok: true };
}

export function verifyEmail(token: string): boolean {
  const row = consumeToken(token, 'verify');
  if (!row) return false;
  let email = '';
  const customer = getDb().prepare('SELECT email FROM customers WHERE id = ?').get(row.customer_id) as
    | { email: string }
    | undefined;
  email = customer?.email ?? '';
  touchCustomer(row.customer_id, { email_verified_at: sqlUtc(0) });
  queueWebhook('customer.updated', row.customer_id);
  writeCustomerAudit('system', 'customer.email_verified', { id: row.customer_id });
  return Boolean(email);
}

export function confirmEmailChange(token: string): boolean {
  const row = consumeToken(token, 'email_change');
  if (!row) return false;
  let email = '';
  try {
    const payload = JSON.parse(row.payload || '{}') as { email?: string };
    email = normalizedEmail(payload.email ?? '');
  } catch {
    return false;
  }
  if (!email) return false;
  touchCustomer(row.customer_id, { email, email_verified_at: sqlUtc(0) });
  queueWebhook('customer.updated', row.customer_id);
  writeCustomerAudit('system', 'customer.email_changed', { id: row.customer_id });
  return true;
}

export async function loginCustomer(email: string, password: string): Promise<string | null> {
  const customer = getCustomerByEmail(email);
  if (!customer) return null;
  const row = getDb().prepare('SELECT * FROM customer_accounts WHERE customer_id = ?').get(customer.id) as
    | AuthRow
    | undefined;
  if (!row || !row.password_hash || !customer.email_verified_at) return null;
  if (row.locked_until && row.locked_until > new Date().toISOString().replace('T', ' ').slice(0, 19)) return null;
  if (!(await argon2.verify(row.password_hash, password))) {
    const failed = row.failed_logins + 1;
    getDb()
      .prepare('UPDATE customer_accounts SET failed_logins = ?, locked_until = ? WHERE customer_id = ?')
      .run(failed, failed >= MAX_FAILED ? sqlUtc(LOCK_MINUTES) : null, customer.id);
    return null;
  }
  getDb()
    .prepare("UPDATE customer_accounts SET failed_logins = 0, locked_until = NULL, last_login_at = datetime('now') WHERE customer_id = ?")
    .run(customer.id);
  const id = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare("INSERT INTO customer_sessions (id, customer_id, data, expires_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))")
    .run(id, customer.id, JSON.stringify({ csrf: crypto.randomBytes(24).toString('hex') }));
  return id;
}

/** Neutral: immer ok, auch wenn das Konto nicht existiert. */
export async function requestPasswordReset(email: string): Promise<{ ok: true; delivered: boolean }> {
  const customer = getCustomerByEmail(email);
  const account = customer
    ? (getDb().prepare('SELECT * FROM customer_accounts WHERE customer_id = ?').get(customer.id) as AuthRow | undefined)
    : undefined;
  if (!customer) return { ok: true, delivered: true };
  if (!account) {
    // Gastkunde: Mit dem Reset-Link wird gleichzeitig ein Konto eingerichtet.
    getDb()
      .prepare('INSERT INTO customer_accounts (customer_id, password_hash) VALUES (?, ?)')
      .run(customer.id, '');
  }
  const token = issueToken(customer.id, 'reset', '', 60);
  const link = `${config.site.baseUrl.replace(/\/$/, '')}/konto/neu-setzen/?token=${token}`;
  const delivered = await sendCustomerMail({
    to: customer.email,
    subject: 'Passwort zurücksetzen – 3D-MIR',
    text: `Link zum Zurücksetzen (60 Minuten gültig): ${link}`,
    html: `<p>Link zum Zurücksetzen (60 Minuten gültig): <a href="${link}">Passwort neu setzen</a></p>`,
  });
  return { ok: true, delivered };
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  if (!isStrongPassword(password)) return false;
  const row = consumeToken(token, 'reset');
  if (!row) return false;
  const hash = await argon2.hash(password, ARGON_OPTIONS);
  getDb()
    .prepare('UPDATE customer_accounts SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE customer_id = ?')
    .run(hash, row.customer_id);
  touchCustomer(row.customer_id, { is_guest: 0, email_verified_at: sqlUtc(0) });
  getDb().prepare('DELETE FROM customer_sessions WHERE customer_id = ?').run(row.customer_id);
  writeCustomerAudit('system', 'customer.password_reset', { id: row.customer_id });
  return true;
}

export async function requestEmailChange(customerId: string, email: string): Promise<{ ok: true }> {
  const token = issueToken(customerId, 'email_change', JSON.stringify({ email: normalizedEmail(email) }), 60);
  const link = `${config.site.baseUrl.replace(/\/$/, '')}/konto/bestaetigen/?token=${token}`;
  await sendCustomerMail({
    to: normalizedEmail(email),
    subject: 'Neue E-Mail-Adresse bestätigen – 3D-MIR',
    text: `Bitte bestätigen Sie die neue E-Mail-Adresse: ${link}`,
    html: `<p>Bitte bestätigen Sie die neue E-Mail-Adresse: <a href="${link}">Bestätigen</a></p>`,
  });
  return { ok: true };
}

export function createCustomerSession(customerId: string): string {
  const id = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare("INSERT INTO customer_sessions (id, customer_id, data, expires_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))")
    .run(id, customerId, JSON.stringify({ csrf: crypto.randomBytes(24).toString('hex') }));
  return id;
}

export function getCustomerSession(id: string | undefined): CustomerSession | null {
  if (!id) return null;
  const row = getDb()
    .prepare("SELECT * FROM customer_sessions WHERE id = ? AND expires_at > datetime('now')")
    .get(id) as { id: string; customer_id: string; data: string; expires_at: string } | undefined;
  if (!row) return null;
  let data: { csrf?: string } = {};
  try {
    data = JSON.parse(row.data) as { csrf?: string };
  } catch {
    data = {};
  }
  return { id: row.id, customerId: row.customer_id, data, expiresAt: row.expires_at };
}

export function deleteCustomerSession(id: string): void {
  getDb().prepare('DELETE FROM customer_sessions WHERE id = ?').run(id);
}

export function deleteAllCustomerSessions(customerId: string): void {
  getDb().prepare('DELETE FROM customer_sessions WHERE customer_id = ?').run(customerId);
}

export function customerCsrf(session: CustomerSession): string {
  return session.data.csrf ?? '';
}

export function verifyCustomerCsrf(session: CustomerSession, token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const expected = Buffer.from(session.data.csrf ?? '');
  const actual = Buffer.from(token);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export { SESSION_TTL_SECONDS };
