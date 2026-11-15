import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { writeAudit } from '../lib/auth.js';

/**
 * Löscht hochgeladene Modelldateien aus Angebotsanfragen nach der
 * dokumentierten Aufbewahrungsfrist (Standard: 90 Tage).
 *
 * Modelldateien werden nach 90 Tagen entfernt. Angebotsanfragen und
 * Kontaktnachrichten werden nach 24 Monaten gelöscht. Zusätzlich werden
 * verwaiste Dateien im Quotes-Upload-Verzeichnis aufgeräumt.
 *
 * Aufruf:
 *   npm run uploads:cleanup
 *   npm run uploads:cleanup -- --days 90
 *   npm run uploads:cleanup -- --dry-run
 */

const daysArg = process.argv.indexOf('--days');
const days =
  daysArg >= 0 ? Math.max(1, Math.trunc(Number(process.argv[daysArg + 1]))) : 90;
const monthsArg = process.argv.indexOf('--inquiry-months');
const inquiryMonths =
  monthsArg >= 0 ? Math.max(1, Math.trunc(Number(process.argv[monthsArg + 1]))) : 24;
const dryRun = process.argv.includes('--dry-run');

if (!Number.isFinite(days) || days < 1) {
  console.error('Ungültiger Wert für --days.');
  process.exit(1);
}
if (!Number.isFinite(inquiryMonths) || inquiryMonths < 1) {
  console.error('Ungültiger Wert für --inquiry-months.');
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

// Anfrage- und Kontaktdaten: laut Datenschutzerklärung spätestens nach 24 Monaten.
const inquiryCutoff = `-${inquiryMonths} months`;
const oldQuotes = db
  .prepare(
    `SELECT id, reference, file_path
       FROM quote_requests
      WHERE created_at < datetime('now', ?)
      ORDER BY id`,
  )
  .all(inquiryCutoff) as { id: number; reference: string; file_path: string | null }[];

let deletedQuotes = 0;
for (const quote of oldQuotes) {
  if (quote.file_path) {
    const file = safeFile(quote.file_path);
    if (file) removeFile(file);
  }
  if (!dryRun) {
    db.prepare('DELETE FROM quote_requests WHERE id = ?').run(quote.id);
  }
  deletedQuotes += 1;
  console.log(`${dryRun ? 'Würde löschen' : 'Gelöscht'}: Anfrage ${quote.reference} (älter als ${inquiryMonths} Monate)`);
}

const contacts = db
  .prepare('SELECT COUNT(*) AS count FROM contact_messages WHERE created_at < datetime(\'now\', ?)')
  .get(inquiryCutoff) as { count: number };
let deletedContacts = 0;
if (!dryRun) {
  deletedContacts = db
    .prepare("DELETE FROM contact_messages WHERE created_at < datetime('now', ?)")
    .run(inquiryCutoff).changes;
} else {
  deletedContacts = contacts.count;
}
if (deletedContacts > 0) {
  console.log(`${dryRun ? 'Würde löschen' : 'Gelöscht'}: ${deletedContacts} Kontaktnachricht(en) (älter als ${inquiryMonths} Monate)`);
}

if (!dryRun && (removed > 0 || orphans > 0 || deletedQuotes > 0 || deletedContacts > 0)) {
  writeAudit('system', 'data.cleanup', {
    fileDays: days,
    inquiryMonths,
    files: removed,
    orphans,
    quotes: deletedQuotes,
    contacts: deletedContacts,
  });
}

console.log(
  `${dryRun ? 'Testlauf' : 'Aufräumen'} abgeschlossen: ${removed} Modelldatei(en), ${orphans} verwaiste Datei(en), ${deletedQuotes} Anfrage(n), ${deletedContacts} Kontaktnachricht(en) (Dateien: ${days} Tage, Anfragen: ${inquiryMonths} Monate).`,
);
