import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Zusammenfassung der Daten, die vor dem Livegang zurückgesetzt werden können.
 * Produkte, Preise, Bilder, Stammdaten, Einstellungen und Benutzer bleiben
 * unberührt.
 */
export interface TestDataSummary {
  orders: number;
  revenueCents: number;
  paymentEvents: number;
  quotes: number;
  quoteFiles: number;
  messages: number;
  blocks: number;
}

export interface TestDataResetResult {
  orders: number;
  revenueCents: number;
  paymentEvents: number;
  quotes: number;
  quoteFiles: number;
  messages: number;
  blocks: number;
}

/** Liest die Anzahl der Testdatensätze und den erfassten Umsatz. */
export function getTestDataSummary(): TestDataSummary {
  const db = getDb();
  const count = (sql: string): number =>
    (db.prepare(sql).get() as { count: number }).count;

  return {
    orders: count('SELECT COUNT(*) AS count FROM orders'),
    revenueCents: (
      db
        .prepare(
          `SELECT COALESCE(SUM(total_cents), 0) AS cents
             FROM orders
            WHERE status IN ('bezahlt', 'in_druck', 'versandt', 'abgeschlossen')`,
        )
        .get() as { cents: number }
    ).cents,
    paymentEvents: count('SELECT COUNT(*) AS count FROM payment_events'),
    quotes: count('SELECT COUNT(*) AS count FROM quote_requests'),
    quoteFiles: count(
      "SELECT COUNT(*) AS count FROM quote_requests WHERE file_path IS NOT NULL AND file_path <> ''",
    ),
    messages: count('SELECT COUNT(*) AS count FROM contact_messages'),
    blocks: count('SELECT COUNT(*) AS count FROM contact_blocks'),
  };
}

/** Sammelt die zu löschenden Modelldateien aus Datenbank und Upload-Verzeichnis. */
function quoteFiles(): string[] {
  const db = getDb();
  const uploadRoot = path.resolve(config.uploadDir);
  const quotesDir = path.join(uploadRoot, 'quotes');
  const files = new Set<string>();

  const stored = db
    .prepare(
      "SELECT file_path FROM quote_requests WHERE file_path IS NOT NULL AND file_path <> ''",
    )
    .all() as { file_path: string }[];
  for (const row of stored) {
    const file = path.resolve(uploadRoot, row.file_path);
    if (file.startsWith(`${uploadRoot}${path.sep}`)) files.add(file);
  }

  if (fs.existsSync(quotesDir)) {
    for (const entry of fs.readdirSync(quotesDir, { withFileTypes: true })) {
      if (entry.isFile()) files.add(path.join(quotesDir, entry.name));
    }
  }

  return [...files];
}

/**
 * Löscht Bestellungen samt Positionen, Zahlungen und Verlauf, Zahlungsereignisse,
 * Angebotsanfragen samt Modelldateien sowie Kontaktnachrichten und
 * Spam-Beobachtungen. Der Vorgang läuft in einer Transaktion; Dateien werden
 * anschließend entfernt.
 */
export function resetTestData(): TestDataResetResult {
  const db = getDb();
  const summary = getTestDataSummary();
  const files = quoteFiles();

  db.transaction(() => {
    db.prepare('DELETE FROM payment_events').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM quote_requests').run();
    db.prepare('DELETE FROM contact_messages').run();
    db.prepare('DELETE FROM contact_blocks').run();
  })();

  let removedFiles = 0;
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        removedFiles += 1;
      }
    } catch {
      // Verwaiste Dateien werden beim nächsten Aufräumlauf erneut geprüft.
    }
  }

  return {
    orders: summary.orders,
    revenueCents: summary.revenueCents,
    paymentEvents: summary.paymentEvents,
    quotes: summary.quotes,
    quoteFiles: removedFiles,
    messages: summary.messages,
    blocks: summary.blocks,
  };
}
