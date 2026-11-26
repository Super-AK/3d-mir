import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `turnstile-settings-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `turnstile-settings-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'turnstile-settings-test-secret-32';
process.env.TURNSTILE_SITE_KEY = 'env-site-key';
process.env.TURNSTILE_SECRET_KEY = 'env-secret-key';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const {
  getTurnstileSettings,
  maskedSecret,
  resetTurnstileSettings,
  saveTurnstileSettings,
} = await import('../../src/lib/turnstile-settings.js');

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

describe('Turnstile-Einstellungen', () => {
  it('nutzt Env-Werte als Fallback', () => {
    expect(getTurnstileSettings()).toEqual({ siteKey: 'env-site-key', secret: 'env-secret-key' });
  });

  it('überschreibt Env-Werte und behält leere Felder', () => {
    saveTurnstileSettings({ siteKey: 'admin-site-key', secret: 'admin-secret' });
    expect(getTurnstileSettings()).toEqual({ siteKey: 'admin-site-key', secret: 'admin-secret' });
    saveTurnstileSettings({ siteKey: '', secret: '' });
    expect(getTurnstileSettings()).toEqual({ siteKey: 'admin-site-key', secret: 'admin-secret' });
  });

  it('maskiert das Secret und setzt auf Env zurück', () => {
    expect(maskedSecret('admin-secret')).toMatch(/^admi… \(12 Zeichen\)$/);
    resetTurnstileSettings();
    expect(getTurnstileSettings()).toEqual({ siteKey: 'env-site-key', secret: 'env-secret-key' });
  });
});
