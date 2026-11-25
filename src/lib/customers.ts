import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { assignCustomerNumber } from './customer-numbers.js';

export type CustomerRow = {
  id: string;
  customer_no: string;
  is_guest: number;
  type: 'private' | 'business';
  status: 'active' | 'blocked' | 'anonymized';
  email: string;
  email_verified_at: string | null;
  first_name: string;
  last_name: string;
  company: string;
  vat_id: string;
  phone: string;
  marketing_consent: number;
  marketing_consent_at: string | null;
  faktura_customer_no: string;
  created_at: string;
  updated_at: string;
};

export function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Stabile ID – einmal berechnet, danach nie wieder (auch bei E-Mail-Änderung). */
export function stableCustomerId(email: string, userId: number | null = null): string {
  if (userId) return `usr_${userId}`;
  const digest = crypto.createHash('sha256').update(normalizedEmail(email)).digest('hex');
  return `cus_${digest.slice(0, 16)}`;
}

export function getCustomerById(id: string): CustomerRow | undefined {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow | undefined;
}

export function getCustomerByEmail(email: string): CustomerRow | undefined {
  return getDb().prepare('SELECT * FROM customers WHERE email = ?').get(normalizedEmail(email)) as
    | CustomerRow
    | undefined;
}

export type CustomerInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  userId?: number | null;
  isGuest?: boolean;
};

/** Findet einen Kunden anhand der E-Mail oder legt ihn mit Nummer an. */
export function ensureCustomer(input: CustomerInput): { customer: CustomerRow; created: boolean } {
  const email = normalizedEmail(input.email);
  const existing = getCustomerByEmail(email);
  if (existing) return { customer: existing, created: false };

  const id = stableCustomerId(email, input.userId ?? null);
  const byId = getCustomerById(id);
  if (byId) return { customer: byId, created: false };

  const number = assignCustomerNumber();
  getDb()
    .prepare(
      `INSERT INTO customers
         (id, customer_no, is_guest, type, email, first_name, last_name, company, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .run(
      id,
      number,
      input.isGuest === false ? 0 : 1,
      input.company ? 'business' : 'private',
      email,
      input.firstName ?? '',
      input.lastName ?? '',
      input.company ?? '',
      input.phone ?? '',
    );
  return { customer: getCustomerById(id)!, created: true };
}

/** Jede Änderung erhöht updated_at (Grundlage der API-Synchronisation). */
export function touchCustomer(id: string, changes: Record<string, unknown> = {}): void {
  const allowed = [
    'email',
    'first_name',
    'last_name',
    'company',
    'vat_id',
    'phone',
    'status',
    'is_guest',
    'marketing_consent',
    'email_verified_at',
    'faktura_customer_no',
  ];
  const entries = Object.entries(changes).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) {
    getDb().prepare("UPDATE customers SET updated_at = datetime('now') WHERE id = ?").run(id);
    return;
  }
  const sql = `UPDATE customers SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`;
  getDb().prepare(sql).run(...entries.map(([, value]) => value), id);
}

/** Löschung = Anonymisierung; customer_no und Snapshots bleiben (Aufbewahrung). */
export function anonymizeCustomer(id: string): boolean {
  const customer = getCustomerById(id);
  if (!customer) return false;
  getDb()
    .prepare(
      `UPDATE customers SET status = 'anonymized', email = '', first_name = '', last_name = '',
         company = '', vat_id = '', phone = '', email_verified_at = NULL,
         updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
  getDb().prepare('DELETE FROM customer_addresses WHERE customer_id = ?').run(id);
  return true;
}

export function writeCustomerAudit(actor: string, action: string, details: unknown = ''): void {
  const text = typeof details === 'string' ? details : JSON.stringify(details);
  getDb()
    .prepare('INSERT INTO customer_audit (actor, action, details) VALUES (?, ?, ?)')
    .run(actor.slice(0, 200), action.slice(0, 100), text.slice(0, 4000));
}
