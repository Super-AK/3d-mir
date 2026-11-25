import { getDb } from '../db/index.js';
import { assignCustomerNumber } from '../lib/customer-numbers.js';
import { normalizedEmail, stableCustomerId, writeCustomerAudit } from '../lib/customers.js';

/**
 * K1-Nachtrag: legt für vorhandene Bestellungen Kunden mit Nummern an.
 * Bewusst KEINE Migration: der Lauf braucht Backup und ausdrückliche Freigabe.
 * Aufruf: npm run customers:backfill -- --confirm
 */
type LegacyOrder = {
  id: number;
  email: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  company: string;
  phone: string;
  customer_id: string | null;
  created_at: string;
};

async function main(): Promise<void> {
  if (!process.argv.includes('--confirm')) {
    console.error('Abgebrochen: erst Backup erstellen und dann mit --confirm ausführen.');
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  const orders = db
    .prepare('SELECT * FROM orders ORDER BY created_at ASC, id ASC')
    .all() as LegacyOrder[];
  const groups = new Map<string, LegacyOrder[]>();
  for (const order of orders) {
    const key = normalizedEmail(order.email);
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  const run = db.transaction(() => {
    let created = 0;
    let linked = 0;
    for (const [, rows] of groups) {
      const first = rows[0]!;
      const id = stableCustomerId(first.email, first.user_id);
      const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id) as { id: string } | undefined;
      if (!existing) {
        const number = assignCustomerNumber();
        db.prepare(
          `INSERT INTO customers
             (id, customer_no, is_guest, type, email, first_name, last_name, company, phone,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          number,
          first.user_id ? 0 : 1,
          first.company ? 'business' : 'private',
          normalizedEmail(first.email),
          first.first_name,
          first.last_name,
          first.company,
          first.phone,
          first.created_at,
          new Date().toISOString().replace('T', ' ').slice(0, 19),
        );
        writeCustomerAudit('system', 'customer.backfill', { id, customer_no: number });
        created += 1;
      }
      for (const order of rows) {
        if (!order.customer_id) {
          db.prepare('UPDATE orders SET customer_id = ? WHERE id = ?').run(id, order.id);
          linked += 1;
        }
      }
    }
    return { created, linked };
  });

  const result = run.immediate();
  console.log(`Nachtrag abgeschlossen: ${result.created} Kunden angelegt, ${result.linked} Bestellungen zugeordnet.`);
}

void main();
