import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `contact-blocks-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `contact-blocks-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'contact-blocks-test-secret-32';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const {
  blockContactBlockManually,
  deleteContactBlock,
  listContactBlocks,
  unblockContactBlock,
} = await import('../../src/lib/contact-protection.js');

function createBlock(): number {
  const result = getDb()
    .prepare("INSERT INTO contact_blocks (ip_hash, ip_prefix, reason) VALUES (?, ?, ?)")
    .run(`hash-${Date.now()}-${Math.random()}`, '203.0.113.0/24', 'Spam-Verdacht');
  return Number(result.lastInsertRowid);
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

describe('Absender-Verwaltung', () => {
  it('sperrt einen beobachteten Absender manuell und hebt die Sperre auf', () => {
    const id = createBlock();
    expect(listContactBlocks().find((row) => row.id === id)?.blocked).toBe(0);
    expect(blockContactBlockManually(id, 24)).toBe(true);
    const blocked = listContactBlocks().find((row) => row.id === id);
    expect(blocked?.blocked).toBe(1);
    expect(blocked?.blocked_until).not.toBeNull();
    expect(unblockContactBlock(id)).toBe(true);
    expect(listContactBlocks().find((row) => row.id === id)?.blocked).toBe(0);
  });

  it('erlaubt dauerhafte Sperren und löscht Einträge', () => {
    const id = createBlock();
    expect(blockContactBlockManually(id, 0)).toBe(true);
    expect(listContactBlocks().find((row) => row.id === id)?.blocked_until).toBeNull();
    expect(deleteContactBlock(id)).toBe(true);
    expect(listContactBlocks().find((row) => row.id === id)).toBeUndefined();
  });
});
