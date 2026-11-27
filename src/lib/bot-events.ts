import { getDb } from '../db/index.js';
import { contactIpPrefix } from './contact-protection.js';

export type BotEvent = {
  id: number;
  created_at: string;
  form: string;
  reason: string;
  ip_prefix: string;
  details: string;
};

/** Speichert eine Bot-Ablehnung – nur mit gekürzter IP, ohne E-Mail/Namen/Token. */
export function recordBotEvent(input: {
  form: string;
  reason: string;
  ip?: string;
  details?: string;
}): void {
  getDb()
    .prepare('INSERT INTO bot_events (form, reason, ip_prefix, details) VALUES (?, ?, ?, ?)')
    .run(
      input.form.slice(0, 100),
      input.reason.slice(0, 100),
      input.ip ? contactIpPrefix(input.ip).slice(0, 60) : '',
      (input.details ?? '').slice(0, 500),
    );
}

export function listBotEvents(limit = 100): BotEvent[] {
  const rows = getDb()
    .prepare('SELECT * FROM bot_events ORDER BY id DESC LIMIT ?')
    .all(limit) as BotEvent[];
  return rows.map((row) => ({
    ...row,
    details: row.details || defaultDetail(row.reason),
  }));
}

function defaultDetail(reason: string): string {
  if (reason.includes('Honeypot')) return 'Honeypot-Feld ausgefüllt – Anfrage verworfen';
  if (reason.includes('Turnstile')) return 'Turnstile-Prüfung fehlgeschlagen – Anfrage verworfen';
  if (reason.includes('Rate-Limit')) return 'IP-Rate-Limit überschritten';
  return 'Bot-Ablehnung';
}

export function clearBotEvents(): number {
  return getDb().prepare('DELETE FROM bot_events').run().changes;
}

export function botEventStats(): { total: number; lastAt: string | null; turnstile: number; honeypot: number; rateLimit: number } {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total, MAX(created_at) AS last_at,
              SUM(CASE WHEN reason LIKE '%Turnstile%' THEN 1 ELSE 0 END) AS turnstile,
              SUM(CASE WHEN reason LIKE '%Honeypot%' THEN 1 ELSE 0 END) AS honeypot,
              SUM(CASE WHEN reason LIKE '%Rate-Limit%' THEN 1 ELSE 0 END) AS rate_limit
         FROM bot_events`,
    )
    .get() as { total: number; last_at: string | null; turnstile: number | null; honeypot: number | null; rate_limit: number | null };
  return {
    total: row.total,
    lastAt: row.last_at,
    turnstile: row.turnstile ?? 0,
    honeypot: row.honeypot ?? 0,
    rateLimit: row.rate_limit ?? 0,
  };
}
