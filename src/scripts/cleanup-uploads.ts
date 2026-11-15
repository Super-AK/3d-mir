import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { writeAudit } from '../lib/auth.js';

/**
 * Löscht hochgeladene Modelldateien aus Angebotsanfragen nach der
 * dokumentierten Aufbewahrungsfrist (Standard: 90 Tage).
 *
 * Die Anfrage selbst und die Kontaktdaten bleiben erhalten; lediglich die
 * Modelldatei und ihre Metadaten werden entfernt. Zusätzlich werden verwaiste
 * Dateien im Quotes-Upload-Verzeichnis aufgeräumt.
 *
 * Aufruf:
 *   npm run uploads:cleanup
 *   npm run uploads:cleanup -- --days 90
 *   npm run uploads:cleanup -- --dry-run
 */

const daysArg = process.argv.indexOf('--days');
const days =
  daysArg >= 0 ? Math.max(1, Math.trunc(Number(process.argv[daysArg + 1]))) : 90;
const dryRun = process.argv.includes('--dry-run');

if (!Number.isFinite(days) || days < 1) {
  console.error('Ungültiger Wert für --days.');
  process.exit(1);
}

const db = getDb();
const uploadRoot = path.resolve(config.uploadDir);
const quotesDir = path.join(uploadRoot, 'quotes');
const cutoff = `-${days} days`;

function safeFile(relativePath: string): string | null {
  const file = path.resolve(uploadRoot, relativePath);
  if (!file.startsWith(`${uploadRoot}${path.sep}`)) return null;
  return file;
}

function removeFile(file: string): boolean {
  try {
    if (!fs.existsSync(file)) return false;
    if (!dryRun) fs.unlinkSync(file);
    return true;
  } catch (error) {
    console.error(`Datei konnte nicht gelöscht werden: ${file}`, error);
    return false;
  }
}

const expired = db
  .prepare(
    `SELECT id, reference, file_path
       FROM quote_requests
      WHERE file_path IS NOT NULL
        AND file_path <> ''
        AND created_at < datetime('now', ?)
      ORDER BY id`,
  )
  .all(cutoff) as { id: number; reference: string; file_path: string }[];

let removed = 0;
for (const quote of expired) {
  const file = safeFile(quote.file_path);
  if (file) {
    if (removeFile(file)) removed += 1;
  }
  if (!dryRun) {
    db.prepare(
      `UPDATE quote_requests
          SET file_path = NULL,
              file_name = NULL,
              file_size = NULL,
              file_sha256 = NULL,
              updated_at = datetime('now')
        WHERE id = ?`,
    ).run(quote.id);
  }
  console.log(`${dryRun ? 'Würde löschen' : 'Gelöscht'}: ${quote.reference} (${quote.file_path})`);
}

// Verwaiste Dateien: nicht mehr in der Datenbank referenziert und älter als die Frist.
const referenced = new Set(
  (db.prepare("SELECT file_path FROM quote_requests WHERE file_path IS NOT NULL AND file_path <> ''").all() as {
    file_path: string;
  }[]).map((row) => row.file_path),
);
let orphans = 0;
if (fs.existsSync(quotesDir)) {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(quotesDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relative = path.join('quotes', entry.name);
    if (referenced.has(relative)) continue;
    const file = path.join(quotesDir, entry.name);
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > cutoffTime) continue;
      if (removeFile(file)) orphans += 1;
    } catch {
      // Einzelne Dateien dürfen den Lauf nicht abbrechen.
    }
  }
}

if (!dryRun && (removed > 0 || orphans > 0)) {
  writeAudit('system', 'quote.files.cleanup', { days, removed, orphans });
}

console.log(
  `${dryRun ? 'Testlauf' : 'Aufräumen'} abgeschlossen: ${removed} Modelldatei(en), ${orphans} verwaiste Datei(en) (Frist: ${days} Tage).`,
);
