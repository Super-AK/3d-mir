import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { sendMail } from './mailer.js';

type NewsletterRow = {
  id: number;
  email: string;
  token_hash: string;
  consent_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

function normalized(email: string): string {
  return email.trim().toLowerCase();
}

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Double-Opt-in: Anmeldung ist erst nach Bestätigung wirksam. */
export function subscribeNewsletter(email: string): string | null {
  const address = normalized(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) || address.length > 200) return null;
  const token = crypto.randomBytes(32).toString('hex');
  getDb()
    .prepare(
      `INSERT INTO newsletter_subscriptions (email, token_hash) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET token_hash = excluded.token_hash,
         consent_at = datetime('now'), confirmed_at = NULL, unsubscribed_at = NULL`,
    )
    .run(address, hash(token));
  const base = config.site.baseUrl.replace(/\/$/, '');
  const confirm = `${base}/newsletter/bestaetigen/?token=${token}`;
  const unsubscribe = `${base}/newsletter/abmelden/?token=${token}`;
  void sendMail({
    to: address,
    subject: 'Newsletter bestätigen – 3D-MIR',
    text: `Bitte bestätigen Sie Ihre Anmeldung: ${confirm}\nAbmelden: ${unsubscribe}`,
    html: `<p>Bitte bestätigen Sie Ihre Anmeldung: <a href="${confirm}">Bestätigen</a></p><p>Jederzeit abmelden: <a href="${unsubscribe}">Abmelden</a></p>`,
  }).catch(() => {});
  return token;
}

export function confirmNewsletter(token: string): boolean {
  const row = getDb()
    .prepare('SELECT * FROM newsletter_subscriptions WHERE token_hash = ?')
    .get(hash(token)) as NewsletterRow | undefined;
  if (!row) return false;
  getDb()
    .prepare("UPDATE newsletter_subscriptions SET confirmed_at = datetime('now') WHERE id = ?")
    .run(row.id);
  return true;
}

export function unsubscribeNewsletter(token: string): boolean {
  const row = getDb()
    .prepare('SELECT * FROM newsletter_subscriptions WHERE token_hash = ?')
    .get(hash(token)) as NewsletterRow | undefined;
  if (!row) return false;
  getDb()
    .prepare("UPDATE newsletter_subscriptions SET unsubscribed_at = datetime('now') WHERE id = ?")
    .run(row.id);
  return true;
}

export function isNewsletterSubscriber(email: string): boolean {
  const row = getDb()
    .prepare('SELECT confirmed_at, unsubscribed_at FROM newsletter_subscriptions WHERE email = ?')
    .get(normalized(email)) as { confirmed_at: string | null; unsubscribed_at: string | null } | undefined;
  return Boolean(row?.confirmed_at && !row.unsubscribed_at);
}
