import crypto from 'node:crypto';
import { getDb } from '../db/index.js';
import { getApiSettings } from './api-settings.js';

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'customer.updated',
  'product.updated',
] as const;

type DeliveryRow = {
  id: number;
  event: string;
  external_id: string;
  payload: string;
  target_url: string;
  status: string;
  attempts: number;
  next_attempt_at: string;
  last_error: string;
  created_at: string;
  delivered_at: string | null;
};

/** Zeitfenster in Minuten je Zustellversuch (1, 5, 30, 120, 720). */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

export function webhookConfigured(): boolean {
  const settings = getApiSettings();
  return Boolean(settings.webhooks.enabled && settings.webhooks.url.startsWith('https://') && settings.webhooks.secret);
}

/** Erzeugt ein neues Webhook-Secret (Klartext nur einmal im Admin anzeigen). */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Ein Ereignis wird nur vorgemerkt, wenn der Betreiber es freigegeben hat. */
export function queueWebhook(event: string, externalId: string, occurredAt?: string): number | null {
  const settings = getApiSettings();
  if (!webhookConfigured() || !settings.webhooks.events.includes(event)) return null;
  const payload = JSON.stringify({
    event,
    id: externalId,
    occurred_at: occurredAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  const result = getDb()
    .prepare(
      `INSERT INTO api_webhook_deliveries
         (event, external_id, payload, target_url, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(event, externalId, payload, settings.webhooks.url);
  return Number(result.lastInsertRowid);
}

/** Versendet ein fälliges Ereignis; 2xx gilt als zugestellt. */
async function deliver(delivery: DeliveryRow, secret: string): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', secret).update(delivery.payload).digest('hex');
  try {
    const response = await fetch(delivery.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
        'X-Timestamp': timestamp,
      },
      body: delivery.payload,
      signal: AbortSignal.timeout(10_000),
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    getDb()
      .prepare('UPDATE api_webhook_deliveries SET last_error = ? WHERE id = ?')
      .run(error instanceof Error ? error.message.slice(0, 500) : 'Verbindungsfehler', delivery.id);
    return false;
  }
}

/** Verarbeitet alle fälligen Zustellungen mit Backoff (1/5/30/120/720 Minuten). */
export async function deliverPendingWebhooks(): Promise<{ sent: number; failed: number; givenUp: number }> {
  if (!webhookConfigured()) return { sent: 0, failed: 0, givenUp: 0 };
  const secret = getApiSettings().webhooks.secret;
  const rows = getDb()
    .prepare(
      "SELECT * FROM api_webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= datetime('now') ORDER BY id ASC LIMIT 50",
    )
    .all() as DeliveryRow[];
  const result = { sent: 0, failed: 0, givenUp: 0 };
  for (const row of rows) {
    const ok = await deliver(row, secret);
    if (ok) {
      getDb()
        .prepare("UPDATE api_webhook_deliveries SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?")
        .run(row.id);
      result.sent += 1;
      continue;
    }
    const attempts = row.attempts + 1;
    if (attempts > BACKOFF_MINUTES.length) {
      getDb()
        .prepare("UPDATE api_webhook_deliveries SET status = 'failed', attempts = ? WHERE id = ?")
        .run(attempts, row.id);
      result.givenUp += 1;
    } else {
      const minutes = BACKOFF_MINUTES[attempts - 1] ?? 720;
      getDb()
        .prepare(
          "UPDATE api_webhook_deliveries SET attempts = ?, next_attempt_at = datetime('now', ?) WHERE id = ?",
        )
        .run(attempts, `+${minutes} minutes`, row.id);
      result.failed += 1;
    }
  }
  return result;
}

export function listWebhookDeliveries(limit = 30): DeliveryRow[] {
  return getDb()
    .prepare('SELECT * FROM api_webhook_deliveries ORDER BY id DESC LIMIT ?')
    .all(limit) as DeliveryRow[];
}

/** Setzt eine fehlgeschlagene Zustellung manuell erneut auf fällig. */
export function retryWebhook(id: number): boolean {
  return (
    getDb()
      .prepare(
        "UPDATE api_webhook_deliveries SET status = 'pending', attempts = 0, next_attempt_at = datetime('now'), last_error = '' WHERE id = ?",
      )
      .run(id).changes > 0
  );
}

/** Test-Event mit der zuletzt angelegten Bestellung (fällt zurück auf ID 0). */
export function testWebhook(): number | null {
  const row = getDb().prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  return queueWebhook('order.created', row ? String(row.id) : '0');
}
