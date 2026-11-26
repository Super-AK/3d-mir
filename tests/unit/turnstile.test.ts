import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join('/tmp/opencode', `turnstile-test-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `turnstile-test-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'turnstile-test-session-secret-32';
process.env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
process.env.TURNSTILE_SECRET_KEY = 'test-secret';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const { verifyTurnstileToken, turnstileToken, turnstileConfigured } = await import('../../src/lib/turnstile.js');

function stubVerify(body: Record<string, unknown>, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }),
  );
}

beforeAll(() => {
  migrate();
  expect(turnstileConfigured()).toBe(true);
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Turnstile', () => {
  it('liest das Token aus Formulardaten', () => {
    expect(turnstileToken({ 'cf-turnstile-response': 'abc' })).toBe('abc');
    expect(turnstileToken({ other: 'abc' })).toBeUndefined();
  });

  it('akzeptiert ein gültiges Token', async () => {
    stubVerify({ success: true });
    expect(await verifyTurnstileToken('gültiges-token')).toBe(true);
  });

  it('lehnt fehlgeschlagene, fehlende und fehlerhafte Tokens ab', async () => {
    stubVerify({ success: false });
    expect(await verifyTurnstileToken('token')).toBe(false);

    expect(await verifyTurnstileToken(undefined)).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await verifyTurnstileToken('token')).toBe(false);
  });
});
