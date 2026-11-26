import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `newsletter-test-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `newsletter-test-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'newsletter-test-session-secret-32';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const {
  confirmNewsletter,
  isNewsletterSubscriber,
  subscribeNewsletter,
  unsubscribeNewsletter,
} = await import('../../src/lib/newsletter.js');

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

describe('Newsletter', () => {
  it('erfordert eine gültige Adresse', () => {
    expect(subscribeNewsletter('keine-adresse')).toBeNull();
    expect(subscribeNewsletter('kunde@example.de')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ist erst nach Bestätigung aktiv und danach abmeldbar', () => {
    expect(subscribeNewsletter('keine-adresse')).toBeNull();
    const token = subscribeNewsletter('kunde@example.de');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(isNewsletterSubscriber('kunde@example.de')).toBe(false);
    expect(confirmNewsletter(token!)).toBe(true);
    expect(isNewsletterSubscriber('kunde@example.de')).toBe(true);
    expect(unsubscribeNewsletter(token!)).toBe(true);
    expect(isNewsletterSubscriber('kunde@example.de')).toBe(false);
  });
});
