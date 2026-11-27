import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `bot-events-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `bot-events-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'bot-events-test-secret-32';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const { listBotEvents, recordBotEvent } = await import('../../src/lib/bot-events.js');

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

describe('Bot-Ereignisse', () => {
  it('speichert Details und gekürzte IP-Präfixe', () => {
    recordBotEvent({
      form: '/kontakt/',
      reason: 'Turnstile abgelehnt',
      ip: '203.0.113.42',
      details: 'Token ungültig – E-Mail nicht versendet',
    });
    const event = listBotEvents()[0]!;
    expect(event.details).toBe('Token ungültig – E-Mail nicht versendet');
    expect(event.ip_prefix).toBe('203.0.113.0/24');
  });

  it('ergänzt ältere Ereignisse ohne Details', () => {
    getDb()
      .prepare("INSERT INTO bot_events (form, reason, details) VALUES ('/kontakt/', 'Honeypot', '')")
      .run();
    const event = listBotEvents().find((row) => row.details.includes('Honeypot'));
    expect(event?.details).toBe('Honeypot-Feld ausgefüllt – Anfrage verworfen');
  });
});
