import { getDb } from '../src/db/index.js';
import { releaseStock } from '../src/lib/payments/index.js';

/**
 * Storniert unbezahlte Bestellungen nach Ablauf der Zahlungsfrist und gibt
 * reservierten Bestand frei.
 *
 * Aufruf:
 *   npm run orders:cleanup -- --days 7
 */
const daysArg = process.argv.indexOf('--days');
const days = daysArg >= 0 ? Math.max(1, Math.trunc(Number(process.argv[daysArg + 1]))) : 7;
if (!Number.isFinite(days)) {
  console.error('Ungültiger Wert für --days.');
  process.exit(1);
}

const rows = getDb()
  .prepare(
    `SELECT id, order_number
       FROM orders
      WHERE status <> 'storniert'
        AND payment_status IN ('offen', 'in_bearbeitung', 'fehlgeschlagen')
        AND created_at < datetime('now', ?)
      ORDER BY id`,
  )
  .all(`-${days} days`) as { id: number; order_number: string }[];

let cancelled = 0;
for (const row of rows) {
  if (releaseStock(row.id, `Zahlungsfrist von ${days} Tagen abgelaufen`, true)) {
    cancelled += 1;
    console.log(`Storniert: ${row.order_number}`);
  }
}

console.log(`${cancelled} unbezahlte Bestellung(en) storniert (Frist: ${days} Tage).`);
