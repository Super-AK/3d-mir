import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { getLogger } from './logger.js';
import { sendMail } from './mailer.js';

export type CampaignRow = {
  id: number;
  subject: string;
  text_body: string;
  html_body: string;
  status: 'draft' | 'sent' | 'failed';
  recipients: number;
  created_at: string;
  sent_at: string | null;
};

export type SubscriberRow = {
  id: number;
  email: string;
  consent_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function subscriberStats(): Record<string, number> {
  const rows = getDb()
    .prepare('SELECT confirmed_at, unsubscribed_at FROM newsletter_subscriptions')
    .all() as { confirmed_at: string | null; unsubscribed_at: string | null }[];
  return {
    total: rows.length,
    active: rows.filter((row) => row.confirmed_at && !row.unsubscribed_at).length,
    pending: rows.filter((row) => !row.confirmed_at).length,
    unsubscribed: rows.filter((row) => row.unsubscribed_at).length,
  };
}

export function listSubscribers(): Array<SubscriberRow & { status: string }> {
  const rows = getDb()
    .prepare('SELECT * FROM newsletter_subscriptions ORDER BY created_at DESC, id DESC')
    .all() as SubscriberRow[];
  return rows.map((row) => ({
    ...row,
    status: row.unsubscribed_at ? 'abgemeldet' : row.confirmed_at ? 'bestätigt' : 'ausstehend',
  }));
}

export function listCampaigns(limit = 30): CampaignRow[] {
  return getDb()
    .prepare('SELECT * FROM newsletter_campaigns ORDER BY id DESC LIMIT ?')
    .all(limit) as CampaignRow[];
}

export function campaignDeliveries(id: number): Array<{ id: number; status: string; error: string; created_at: string }> {
  return getDb()
    .prepare('SELECT id, status, error, created_at FROM newsletter_deliveries WHERE campaign_id = ? ORDER BY id DESC LIMIT 100')
    .all(id) as Array<{ id: number; status: string; error: string; created_at: string }>;
}

export function createCampaign(input: { subject: string; text: string; html?: string }): number {
  const result = getDb()
    .prepare('INSERT INTO newsletter_campaigns (subject, text_body, html_body) VALUES (?, ?, ?)')
    .run(input.subject.trim().slice(0, 200), input.text.trim(), (input.html ?? '').trim());
  return Number(result.lastInsertRowid);
}

function unsubscribeLink(email: string): string {
  const existing = getDb()
    .prepare('SELECT token_hash FROM newsletter_unsubscribe WHERE email = ?')
    .get(email) as { token_hash: string } | undefined;
  let token = '';
  if (existing) {
    // Bestehender Datensatz: neuer Token, damit der Link nicht mehrfach benutzt wird.
    token = crypto.randomBytes(32).toString('hex');
    getDb().prepare('UPDATE newsletter_unsubscribe SET token_hash = ? WHERE email = ?').run(hash(token), email);
  } else {
    token = crypto.randomBytes(32).toString('hex');
    getDb().prepare('INSERT INTO newsletter_unsubscribe (email, token_hash) VALUES (?, ?)').run(email, hash(token));
  }
  return `${config.site.baseUrl.replace(/\/$/, '')}/newsletter/abmelden/?token=${token}`;
}

async function deliver(email: string, subject: string, text: string, html: string): Promise<string> {
  const link = unsubscribeLink(email);
  const textBody = `${text}\n\n---\nNewsletter abmelden: ${link}`;
  const htmlBody = html ? `${html}<p><a href="${link}">Newsletter abmelden</a></p>` : undefined;
  try {
    const result = await sendMail({ to: email, subject, text: textBody, html: htmlBody });
    if (!result.delivered && !result.savedTo) return 'nicht zugestellt';
    return 'zugestellt';
  } catch (error) {
    return error instanceof Error ? error.message.slice(0, 500) : 'unbekannter Fehler';
  }
}

/** Versendet eine Kampagne an alle bestätigten, nicht abgemeldeten Empfänger. */
export async function sendCampaign(id: number): Promise<{ recipients: number; sent: number; failed: number }> {
  const campaign = getDb().prepare('SELECT * FROM newsletter_campaigns WHERE id = ?').get(id) as CampaignRow | undefined;
  if (!campaign) throw new Error('Kampagne nicht gefunden.');
  if (campaign.status === 'sent') throw new Error('Kampagne wurde bereits versendet.');

  const subscribers = getDb()
    .prepare('SELECT email FROM newsletter_subscriptions WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL ORDER BY id ASC')
    .all() as Array<{ email: string }>;

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const status = await deliver(subscriber.email, campaign.subject, campaign.text_body, campaign.html_body);
    getDb()
      .prepare('INSERT INTO newsletter_deliveries (campaign_id, email_hash, status, error) VALUES (?, ?, ?, ?)')
      .run(id, hash(subscriber.email), status === 'zugestellt' ? 'delivered' : 'failed', status === 'zugestellt' ? '' : status);
    if (status === 'zugestellt') sent += 1;
    else failed += 1;
  }

  getDb()
    .prepare("UPDATE newsletter_campaigns SET recipients = ?, status = ?, sent_at = datetime('now') WHERE id = ?")
    .run(subscribers.length, failed > 0 && sent === 0 ? 'failed' : 'sent', id);
  getLogger().info({ campaign: id, recipients: subscribers.length, sent, failed }, 'Newsletter-Kampagne versendet');
  return { recipients: subscribers.length, sent, failed };
}

export async function sendTestMail(email: string, subject: string, text: string, html?: string): Promise<boolean> {
  const status = await deliver(email, subject, text, html ?? '');
  return status === 'zugestellt';
}
