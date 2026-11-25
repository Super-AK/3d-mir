import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `customers-test-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `customers-test-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'customers-test-session-secret-with-at-least-32-chars';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const {
  assignCustomerNumber,
  customerNumberStats,
  formatCustomerNumber,
  isValidCustomerNumber,
} = await import('../../src/lib/customer-numbers.js');
const {
  anonymizeCustomer,
  ensureCustomer,
  getCustomerByEmail,
  stableCustomerId,
  touchCustomer,
} = await import('../../src/lib/customers.js');

beforeAll(() => {
  migrate();
});

afterAll(async () => {
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

describe('Kundennummern', () => {
  it('vergibt 50 aufeinanderfolgende, eindeutige Nummern im Format KD9xxxxx', () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 50; i += 1) numbers.add(assignCustomerNumber());
    expect(numbers.size).toBe(50);
    for (const number of numbers) {
      expect(isValidCustomerNumber(number)).toBe(true);
      expect(number).toMatch(/^KD9\d{5}$/);
    }
    expect(customerNumberStats().last_assigned).toBe(formatCustomerNumber(900050));
  });

  it('verwendet keine Nummer nach Anonymisierung erneut', () => {
    const before = String(customerNumberStats().last_assigned);
    const created = ensureCustomer({ email: `anonym-${Date.now()}@example.de`, isGuest: true });
    expect(anonymizeCustomer(created.customer.id)).toBe(true);
    const next = assignCustomerNumber();
    expect(next > before).toBe(true);
    expect(next).not.toBe(created.customer.customer_no);
  });
});

describe('Kundenstamm', () => {
  it('verwendet für gleiche E-Mail dieselbe stabile ID und Nummer', () => {
    const email = `Gast-${Date.now()}@Example.DE`;
    const first = ensureCustomer({ email, firstName: 'Erika', isGuest: true });
    const second = ensureCustomer({ email: email.toLowerCase(), isGuest: true });
    expect(second.created).toBe(false);
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.customer.customer_no).toBe(first.customer.customer_no);
    expect(second.customer.is_guest).toBe(1);
    expect(getCustomerByEmail(email)?.id).toBe(first.customer.id);
  });

  it('behält die ID bei E-Mail-Änderung und erhöht updated_at', () => {
    const created = ensureCustomer({ email: `change-${Date.now()}@example.de`, isGuest: false });
    const before = created.customer.updated_at;
    touchCustomer(created.customer.id, { email: 'neu@example.de', first_name: 'Neu' });
    const changed = getCustomerByEmail('neu@example.de');
    expect(changed?.id).toBe(created.customer.id);
    expect(changed?.updated_at >= before).toBe(true);
  });

  it('bildet stabile IDs aus user_id oder E-Mail-Hash', () => {
    expect(stableCustomerId('x@example.de', 42)).toBe('usr_42');
    expect(stableCustomerId('x@example.de')).toMatch(/^cus_[a-f0-9]{16}$/);
  });
});
