import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

export type Db = Database.Database;

let instance: Db | null = null;

/** Öffnet die SQLite-Datenbank (WAL-Modus) und legt Verzeichnisse an. */
export function getDb(): Db {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  instance = db;
  return db;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}
