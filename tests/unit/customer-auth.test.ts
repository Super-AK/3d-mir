import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `customer-auth-test-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `customer-auth-test-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'customer-auth-test-session-secret-32';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const { ensureCustomer, getCustomerById } = await import('../../src/lib/customers.js');
const {
  confirmEmailChange,
  customerCsrf,
  getCustomerSession,
  isStrongPassword,
  loginCustomer,
  resetPassword,
  verifyCustomerCsrf,
  verifyEmail,
} = await import('../../src/lib/customer-auth.js');

function insertToken(customerId: string, kind: string, plain: string, payload = ''): void {
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  getDb()
    .prepare('INSERT INTO customer_auth_tokens (customer_id, kind, token_hash, payload, expires_at) VALUES (?, ?, ?, ?, datetime(\'now\', \'+1 hour\'))')
    .run(customerId, kind, hash, payload);
}

beforeAll(() => {
  migrate();
});

afterAll(() => {
  getDb().close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${dbPath}${suffix}`);
    } catch {
      // Datei existiert nicht mehr.
    }
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('Kundenkonten', () => {
  it('prüft die Passwortstärke', () => {
    expect(isStrongPassword('1234567890')).toBe(false);
    expect(isStrongPassword('password')).toBe(false);
    expect(isStrongPassword('MeinSicheresPasswort1')).toBe(true);
  });

  it('bestätigt E-Mail und E-Mail-Änderung nur einmal', () => {
    const { customer } = ensureCustomer({ email: `verify-${Date.now()}@example.de`, isGuest: false });
    insertToken(customer.id, 'verify', 'verify-token-1');
    expect(verifyEmail('verify-token-1')).toBe(true);
    expect(verifyEmail('verify-token-1')).toBe(false);
    expect(getCustomerById(customer.id)?.email_verified_at).not.toBeNull();

    insertToken(customer.id, 'email_change', 'change-token-1', JSON.stringify({ email: 'neu@example.de' }));
    expect(confirmEmailChange('change-token-1')).toBe(true);
    expect(getCustomerById(customer.id)?.email).toBe('neu@example.de');
  });

  it('verhindert Login vor Bestätigung und sperrt nach Fehlversuchen', async () => {
    const email = `login-${Date.now()}@example.de`;
    const { customer } = ensureCustomer({ email, isGuest: false });
    const hash = await import('argon2').then((argon2) =>
      argon2.hash('MeinSicheresPasswort1', { type: argon2.argon2id, memoryCost: 1024, timeCost: 2 }),
    );
    getDb().prepare('INSERT INTO customer_accounts (customer_id, password_hash) VALUES (?, ?)').run(customer.id, hash);
    expect(await loginCustomer(email, 'MeinSicheresPasswort1')).toBeNull(); // nicht bestätigt
    getDb().prepare("UPDATE customers SET email_verified_at = datetime('now') WHERE id = ?").run(customer.id);
    for (let i = 0; i < 5; i += 1) await loginCustomer(email, 'falsch');
    expect(await loginCustomer(email, 'MeinSicheresPasswort1')).toBeNull(); // gesperrt
    const row = getDb().prepare('SELECT failed_logins FROM customer_accounts WHERE customer_id = ?').get(customer.id) as { failed_logins: number };
    expect(row.failed_logins).toBeGreaterThanOrEqual(5);
  });

  it('setzt das Passwort zurück und beendet alte Sitzungen', async () => {
    const { customer } = ensureCustomer({ email: `reset-${Date.now()}@example.de`, isGuest: false });
    insertToken(customer.id, 'reset', 'reset-token-1');
    const hash = await import('argon2').then((argon2) =>
      argon2.hash('AltesPasswort123', { type: argon2.argon2id, memoryCost: 1024, timeCost: 2 }),
    );
    getDb().prepare('INSERT INTO customer_accounts (customer_id, password_hash) VALUES (?, ?)').run(customer.id, hash);
    getDb().prepare("INSERT INTO customer_sessions (id, customer_id, data, expires_at) VALUES ('old', ?, '{}', datetime('now', '+1 hour'))").run(customer.id);
    expect(await resetPassword('reset-token-1', 'NeuesPasswort123')).toBe(true);
    expect(getCustomerSession('old')).toBeNull();
    expect(await resetPassword('reset-token-1', 'NochmalPasswort1')).toBe(false); // einmalig
  });

  it('schützt Formulare mit CSRF', () => {
    const { customer } = ensureCustomer({ email: `csrf-${Date.now()}@example.de`, isGuest: false });
    const session = getCustomerSession(
      (() => {
        const id = 'csrf-session-test';
        getDb().prepare("INSERT INTO customer_sessions (id, customer_id, data, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))").run(id, customer.id, JSON.stringify({ csrf: 'abc123' }));
        return id;
      })(),
    )!;
    expect(customerCsrf(session)).toBe('abc123');
    expect(verifyCustomerCsrf(session, 'abc123')).toBe(true);
    expect(verifyCustomerCsrf(session, 'falsch')).toBe(false);
  });
});
