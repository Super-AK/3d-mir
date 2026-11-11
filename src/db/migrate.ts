import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './index.js';
import { config } from '../config.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const migrationCandidates = [
  path.join(moduleDir, 'migrations'),
  path.join(config.root, 'src', 'db', 'migrations'),
];
const migrationsDir = migrationCandidates.find((dir) => fs.existsSync(dir)) ?? migrationCandidates[0]!;

/**
 * Führt alle noch nicht angewendeten SQL-Migrationen in Dateinamen-Reihenfolge aus.
 * Jede Migration läuft in einer Transaktion. Mehrfaches Ausführen ist unschädlich.
 */
export function migrate(): string[] {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => (row as { name: string }).name),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const executed: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
    run();
    executed.push(file);
    console.log(`Migration angewendet: ${file}`);
  }
  if (executed.length === 0) console.log('Datenbank ist aktuell, keine Migration nötig.');
  return executed;
}

// Direktaufruf: `npm run migrate`
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    migrate();
    console.log(`Datenbank: ${config.dbPath}`);
  } catch (error) {
    console.error('Migration fehlgeschlagen:', error);
    process.exit(1);
  }
}
