import { config } from '../../config.js';
import { getDb } from '../../db/index.js';
import { getLogger } from '../logger.js';
import { sendMail } from '../mailer.js';
import { notifyAdmin } from '../notifications.js';
import { mailButton, mailLayout, mailNotice, mailParagraph, mailSection, mailTable } from '../mail-layout.js';
import { formatEuro } from '../shop.js';
import { findPaymentMethod, getShopSettings, type BankDetails } from '../shop-settings.js';
import {
  createCheckoutSession,
  isStripeConfigured,
  paymentIntentId,
  retrieveCheckoutSession,
  type StripeCheckoutSession,
  type StripeEvent,
  type StripeLineItem,
} from './stripe.js';

const db = () => getDb();

export type PaymentOrder = {
  id: number;
  order_number: string;
  status: string;
  email: string;
  first_name: string;
  last_name: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  options_cents: number;
  payment_method: string;
  payment_status: string;
  payment_provider: string;
  payment_reference: string;
  payment_note: string;
  paid_at: string | null;
  public_token: string;
  stock_reserved: number;
  stock_released_at: string | null;
  created_at: string;
};

export type OrderItem = {
  name: string;
  variant: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  variant_id: number | null;
};

export type OrderOption = {
  label: string;
  price_cents: number;
};

export type PaymentInitResult = {
  redirectUrl: string | null;
  reference: string;
};

type PaymentChange = {
  changed: boolean;
  orderId: number | null;
  duplicate?: boolean;
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  offen: 'Zahlung offen',
  in_bearbeitung: 'Zahlung in Bearbeitung',
  bezahlt: 'Bezahlt',
  fehlgeschlagen: 'Zahlung fehlgeschlagen',
  erstattet: 'Erstattet',
  storniert: 'Storniert',
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function paymentStatusTone(status: string): 'neutral' | 'warning' | 'success' | 'danger' {
  if (status === 'bezahlt') return 'success';
  if (status === 'fehlgeschlagen' || status === 'storniert') return 'danger';
  if (status === 'erstattet') return 'neutral';
  return 'warning';
}

export function paymentProviderLabel(provider: string): string {
  if (provider === 'stripe') return 'Stripe';
  if (provider === 'manual') return 'Manuell';
  return provider;
}

export function getPaymentOrderById(id: number): PaymentOrder | null {
  const row = db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as PaymentOrder | undefined;
  return row ?? null;
}

export function getPaymentOrderByNumber(orderNumber: string): PaymentOrder | null {
  const row = db().prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) as PaymentOrder | undefined;
  return row ?? null;
}

/** Nur mit gültigem öffentlichen Token darf eine Bestellung angezeigt werden. */
export function getPaymentOrderByAccess(orderNumber: string, token: string): PaymentOrder | null {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const row = db()
    .prepare('SELECT * FROM orders WHERE order_number = ? AND public_token = ?')
    .get(orderNumber, token) as PaymentOrder | undefined;
  return row ?? null;
}

export function getOrderItems(orderId: number): OrderItem[] {
  return db()
    .prepare(
      'SELECT name, variant, quantity, unit_price_cents, line_total_cents, variant_id FROM order_items WHERE order_id = ? ORDER BY id',
    )
    .all(orderId) as OrderItem[];
}

export function getOrderOptions(orderId: number): OrderOption[] {
  return db()
    .prepare('SELECT label, price_cents FROM order_options WHERE order_id = ? ORDER BY id')
    .all(orderId) as OrderOption[];
}

export function getBankDetails(): BankDetails {
  return getShopSettings().bank;
}

export function publicOrderUrl(order: Pick<PaymentOrder, 'order_number' | 'public_token'>): string {
  return `${config.payment.baseUrl}/bestellung/danke/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;
}

function buildLineItems(order: PaymentOrder): StripeLineItem[] {
  const items = getOrderItems(order.id);
  const options = getOrderOptions(order.id);
  const method = findPaymentMethod(order.payment_method);
  const lineItems: StripeLineItem[] = items.map((item) => ({
    name: `${item.name}${item.variant ? ` – ${item.variant}` : ''}`,
    amountCents: item.unit_price_cents,
    quantity: item.quantity,
  }));
  if (order.shipping_cents > 0) {
    lineItems.push({
      name: `Versand${method ? ` (${method.label})` : ''}`,
      amountCents: order.shipping_cents,
      quantity: 1,
    });
  }
  for (const option of options) {
    lineItems.push({
      name: option.label,
      amountCents: option.price_cents,
      quantity: 1,
    });
  }
  return lineItems;
}

function recordPaymentAttempt(
  orderId: number,
  provider: string,
  providerPaymentId: string,
  status: string,
  amountCents: number,
): void {
  if (!providerPaymentId) return;
  const updated =
    amountCents > 0
      ? db()
          .prepare(
            `UPDATE order_payments
                SET status = ?, amount_cents = ?, updated_at = datetime('now')
              WHERE provider = ? AND provider_payment_id = ?`,
          )
          .run(status, amountCents, provider, providerPaymentId)
      : db()
          .prepare(
            `UPDATE order_payments
                SET status = ?, updated_at = datetime('now')
              WHERE provider = ? AND provider_payment_id = ?`,
          )
          .run(status, provider, providerPaymentId);
  if (updated.changes > 0) return;
  db()
    .prepare(
      `INSERT INTO order_payments (order_id, provider, provider_payment_id, status, amount_cents, currency)
       VALUES (?, ?, ?, ?, ?, 'EUR')`,
    )
    .run(orderId, provider, providerPaymentId, status, amountCents);
}

/** Startet die Zahlung für eine bereits gespeicherte Bestellung. */
export async function createPaymentForOrder(order: PaymentOrder): Promise<PaymentInitResult> {
  const method = findPaymentMethod(order.payment_method);
  if (!method) throw new Error('Die gewählte Zahlungsart ist nicht mehr verfügbar.');
  if (method.provider === 'manual') {
    return { redirectUrl: null, reference: order.order_number };
  }

  if (!isStripeConfigured()) {
    throw new Error('Die Online-Zahlung ist derzeit nicht konfiguriert.');
  }
  if (!method.stripeMethod) {
    throw new Error('Für diese Zahlungsart ist keine Stripe-Methode hinterlegt.');
  }

  const successUrl = `${config.payment.baseUrl}/bestellung/danke/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;
  const cancelUrl = `${config.payment.baseUrl}/bestellung/zahlung/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;

  const session = await createCheckoutSession({
    orderId: order.id,
    orderNumber: order.order_number,
    publicToken: order.public_token,
    paymentMethodId: method.id,
    stripeMethod: method.stripeMethod,
    customerEmail: order.email,
    lineItems: buildLineItems(order),
    successUrl,
    cancelUrl,
  });

  db()
    .prepare(
      `UPDATE orders
          SET payment_status = CASE WHEN payment_status = 'bezahlt' THEN payment_status ELSE 'in_bearbeitung' END,
              payment_provider = 'stripe',
              payment_reference = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(session.id, order.id);
  recordPaymentAttempt(order.id, 'stripe', session.id, 'offen', order.total_cents);

  if (!session.url) throw new Error('Stripe hat keine Zahlungs-URL geliefert.');
  return { redirectUrl: session.url, reference: session.id };
}

/** Markiert eine Bestellung als bezahlt und schreibt die Status-Historie. */
export function markOrderPaid(
  orderId: number,
  provider: string,
  reference: string,
): { changed: boolean; order: PaymentOrder | null } {
  const run = db().transaction(() => {
    const current = getPaymentOrderById(orderId);
    if (!current) return { changed: false, order: null };
    if (current.payment_status === 'bezahlt') return { changed: false, order: current };

    const isCancelled = current.status === 'storniert';
    const note = isCancelled
      ? 'Zahlung nach Stornierung eingegangen – bitte prüfen und ggf. erstatten.'
      : '';
    const update = db()
      .prepare(
        `UPDATE orders
            SET payment_status = 'bezahlt',
                payment_provider = ?,
                payment_reference = ?,
                payment_note = ?,
                paid_at = datetime('now'),
                updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(provider, reference, note, orderId);

    if (update.changes === 0) return { changed: false, order: current };

    if (current.status === 'neu') {
      db()
        .prepare("UPDATE orders SET status = 'bezahlt', updated_at = datetime('now') WHERE id = ?")
        .run(orderId);
      db()
        .prepare(
          'INSERT INTO order_status_history (order_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)',
        )
        .run(orderId, current.status, 'bezahlt', `system:${provider}`, 'Zahlung bestätigt');
    }

    recordPaymentAttempt(orderId, provider, reference, 'bezahlt', current.total_cents);
    return { changed: true, order: getPaymentOrderById(orderId) };
  });

  return run();
}

/** Setzt eine Zahlung auf „in Bearbeitung“ (z. B. SEPA/Klarna oder PayPal-Prüfung). */
export function markOrderInProgress(orderId: number, provider: string, reference: string): boolean {
  const update = db()
    .prepare(
      `UPDATE orders
          SET payment_status = CASE WHEN payment_status = 'bezahlt' THEN payment_status ELSE 'in_bearbeitung' END,
              payment_provider = ?,
              payment_reference = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(provider, reference, orderId);
  recordPaymentAttempt(orderId, provider, reference, 'in_bearbeitung', 0);
  return update.changes > 0;
}

/** Markiert eine Zahlung als fehlgeschlagen; der Bestand bleibt für einen erneuten Versuch reserviert. */
export function markOrderPaymentFailed(orderId: number, provider: string, reference: string, note: string): boolean {
  const update = db()
    .prepare(
      `UPDATE orders
          SET payment_status = CASE WHEN payment_status = 'bezahlt' THEN payment_status ELSE 'fehlgeschlagen' END,
              payment_provider = ?,
              payment_reference = ?,
              payment_note = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(provider, reference, note, orderId);
  recordPaymentAttempt(orderId, provider, reference, 'fehlgeschlagen', 0);
  return update.changes > 0;
}

/** Vermerkt eine Erstattung (die eigentliche Erstattung erfolgt im Stripe-Dashboard). */
export function markOrderRefunded(orderId: number, note: string, actor: string): boolean {
  const update = db()
    .prepare(
      `UPDATE orders
          SET payment_status = 'erstattet',
              payment_note = ?,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(note, orderId);
  if (update.changes > 0) {
    db()
      .prepare(
        'INSERT INTO order_status_history (order_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)',
      )
      .run(orderId, 'bezahlt', 'erstattet', actor, note);
  }
  return update.changes > 0;
}

/**
 * Gibt reservierten Bestand frei. Wird beim Stornieren oder durch den
 * Aufräumjob für dauerhaft unbezahlte Bestellungen verwendet.
 */
export function releaseStock(orderId: number, reason: string, cancelOrder = true): boolean {
  const run = db().transaction(() => {
    const order = getPaymentOrderById(orderId);
    if (!order) return false;

    if (order.stock_reserved === 1 && !order.stock_released_at) {
      const items = db()
        .prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL')
        .all(orderId) as { variant_id: number; quantity: number }[];
      for (const item of items) {
        db()
          .prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL')
          .run(item.quantity, item.variant_id);
      }
      db()
        .prepare(
          "UPDATE orders SET stock_reserved = 0, stock_released_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        )
        .run(orderId);
    }

    if (cancelOrder && order.status !== 'storniert') {
      db()
        .prepare("UPDATE orders SET status = 'storniert', updated_at = datetime('now') WHERE id = ?")
        .run(orderId);
      db()
        .prepare(
          'INSERT INTO order_status_history (order_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)',
        )
        .run(orderId, order.status, 'storniert', 'system', reason);
      return true;
    }
    return false;
  });
  return run();
}

function resolveOrderFromSession(session: StripeCheckoutSession): PaymentOrder | null {
  const metadata = session.metadata ?? {};
  const orderId = Number(metadata.order_id);
  if (Number.isInteger(orderId) && orderId > 0) {
    const byId = getPaymentOrderById(orderId);
    if (byId) return byId;
  }
  if (session.client_reference_id) {
    return getPaymentOrderByNumber(session.client_reference_id);
  }
  if (metadata.order_number) {
    return getPaymentOrderByNumber(metadata.order_number);
  }
  return null;
}

function amountMatches(order: PaymentOrder, session: StripeCheckoutSession): boolean {
  return session.amount_total === order.total_cents && (!session.currency || session.currency === 'eur');
}

function applyCheckoutSession(
  session: StripeCheckoutSession,
  eventType: string,
): PaymentChange {
  const order = resolveOrderFromSession(session);
  if (!order) {
    getLogger().warn({ sessionId: session.id, eventType }, 'Stripe-Session ohne passende Bestellung');
    return { changed: false, orderId: null };
  }

  if (eventType === 'checkout.session.completed' && session.payment_status !== 'paid') {
    markOrderInProgress(order.id, 'stripe', session.id);
    return { changed: true, orderId: order.id };
  }

  if (eventType === 'checkout.session.async_payment_failed' || eventType === 'checkout.session.expired') {
    markOrderPaymentFailed(
      order.id,
      'stripe',
      session.id,
      eventType === 'checkout.session.expired'
        ? 'Die Zahlungssitzung ist abgelaufen. Die Zahlung kann erneut gestartet werden.'
        : 'Die Zahlung ist fehlgeschlagen. Die Zahlung kann erneut gestartet werden.',
    );
    return { changed: true, orderId: order.id };
  }

  if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
    if (!amountMatches(order, session)) {
      db()
        .prepare(
          "UPDATE orders SET payment_status = 'in_bearbeitung', payment_note = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(
          `Zahlungsbetrag weicht ab: erwartet ${formatEuro(order.total_cents)}, erhalten ${
            session.amount_total == null ? 'unbekannt' : formatEuro(session.amount_total)
          }. Bitte manuell prüfen.`,
          order.id,
        );
      getLogger().error(
        { order: order.order_number, expected: order.total_cents, received: session.amount_total },
        'Stripe-Betrag weicht von der Bestellung ab',
      );
      return { changed: true, orderId: order.id };
    }

    const result = markOrderPaid(
      order.id,
      'stripe',
      paymentIntentId(session) || session.id,
    );
    return { changed: result.changed, orderId: order.id };
  }

  return { changed: false, orderId: order.id };
}

/** Verarbeitet ein Stripe-Webhook-Ereignis genau einmal. */
export async function applyStripeEvent(event: StripeEvent): Promise<PaymentChange> {
  const sessionLike = event.data.object as unknown as StripeCheckoutSession;
  const supported = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ]);
  if (!supported.has(event.type)) {
    return { changed: false, orderId: null };
  }

  let change: PaymentChange = { changed: false, orderId: null };
  const run = db().transaction(() => {
    const inserted = db()
      .prepare(
        `INSERT OR IGNORE INTO payment_events (provider, event_id, event_type, order_id, payload)
         VALUES ('stripe', ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.type,
        Number(sessionLike.metadata?.order_id) || null,
        JSON.stringify({ id: event.id, type: event.type }).slice(0, 4000),
      );
    if (inserted.changes === 0) {
      return { changed: false, orderId: null, duplicate: true };
    }
    change = applyCheckoutSession(sessionLike, event.type);
    if (change.orderId) {
      db()
        .prepare('UPDATE payment_events SET order_id = ? WHERE provider = ? AND event_id = ?')
        .run(change.orderId, 'stripe', event.id);
    }
    return change;
  });

  const result = run();
  if (result.changed && result.orderId) {
    const order = getPaymentOrderById(result.orderId);
    if (order && order.payment_status === 'bezahlt') {
      await sendPaymentConfirmed(order);
    }
  }
  return result;
}

/** Prüft eine Checkout-Session nach der Rückleitung (Fallback zum Webhook). */
export async function reconcileStripeSession(sessionId: string): Promise<PaymentChange> {
  const session = await retrieveCheckoutSession(sessionId);
  if (session.payment_status === 'paid') {
    const change = applyCheckoutSession(session, 'checkout.session.completed');
    if (change.changed && change.orderId) {
      const order = getPaymentOrderById(change.orderId);
      if (order && order.payment_status === 'bezahlt') await sendPaymentConfirmed(order);
    }
    return change;
  }
  if (session.status === 'complete') {
    return applyCheckoutSession(session, 'checkout.session.completed');
  }
  if (session.status === 'expired') {
    return applyCheckoutSession(session, 'checkout.session.expired');
  }
  return { changed: false, orderId: null };
}

/** Sendet die Zahlungsbestätigung an Kunde und Betreiber. */
export async function sendPaymentConfirmed(order: PaymentOrder): Promise<void> {
  const items = getOrderItems(order.id);
  const method = findPaymentMethod(order.payment_method);
  const methodLabel = method?.label ?? order.payment_method;
  if (order.status === 'storniert') {
    try {
      await notifyAdmin({
        subject: `[Zahlung nach Stornierung] Bestellung ${order.order_number} – ${formatEuro(order.total_cents)}`,
        text: [
          `Für die bereits stornierte Bestellung ${order.order_number} ist eine Zahlung eingegangen.`,
          `Kunde: ${order.first_name} ${order.last_name} <${order.email}>`,
          `Betrag: ${formatEuro(order.total_cents)}`,
          `Zahlungsart: ${methodLabel}`,
          `Referenz: ${order.payment_reference || '–'}`,
          '',
          'Bitte prüfen Sie den Vorgang und veranlassen Sie ggf. eine Erstattung.',
          '',
          `Admin: ${config.payment.baseUrl}/admin/bestellungen/${order.id}/`,
        ].join('\n'),
        html: mailLayout({
          title: 'Zahlung nach Stornierung',
          preheader: `Bestellung ${order.order_number} · ${formatEuro(order.total_cents)}`,
          body: [
            mailNotice('Für eine bereits stornierte Bestellung ist eine Zahlung eingegangen. Bitte prüfen Sie den Vorgang und veranlassen Sie ggf. eine Erstattung.'),
            mailSection('Zahlung', mailTable([
              ['Bestellung', order.order_number],
              ['Kunde', `${order.first_name} ${order.last_name} <${order.email}>`],
              ['Betrag', formatEuro(order.total_cents)],
              ['Zahlungsart', methodLabel],
              ['Referenz', order.payment_reference || '–'],
            ])),
            mailButton(`${config.payment.baseUrl}/admin/bestellungen/${order.id}/`, 'Bestellung im Admin öffnen'),
          ].join(''),
        }),
        replyTo: order.email,
      });
    } catch (error) {
      getLogger().warn({ err: error, order: order.order_number }, 'Hinweis zu Zahlung nach Stornierung konnte nicht versendet werden');
    }
    return;
  }
  const text = [
    `Hallo ${order.first_name},`,
    '',
    `Ihre Zahlung für die Bestellung ${order.order_number} ist bei uns eingegangen.`,
    `Betrag: ${formatEuro(order.total_cents)}`,
    `Zahlungsart: ${methodLabel}`,
    '',
    'Wir beginnen mit der Fertigung und melden uns, sobald sich der Status ändert.',
    '',
    ...items.map(
      (item) =>
        `- ${item.quantity} × ${item.name}${item.variant ? ` (${item.variant})` : ''} = ${formatEuro(item.line_total_cents)}`,
    ),
    '',
    'Viele Grüße',
    '3D-MIR 3D-Druck Service',
  ].join('\n');

  const itemRows = items.map(
    (item) => [`${item.quantity} × ${item.name}`, `${item.variant ? `${item.variant} · ` : ''}${formatEuro(item.line_total_cents)}`] as [string, string],
  );
  const customerHtml = mailLayout({
    title: 'Zahlung eingegangen',
    preheader: `Bestellung ${order.order_number} · ${formatEuro(order.total_cents)}`,
    body: [
      mailParagraph(`Hallo ${order.first_name},`),
      mailNotice(`Ihre Zahlung für die Bestellung ${order.order_number} ist bei uns eingegangen.`),
      mailSection('Zahlung', mailTable([
        ['Bestellnummer', order.order_number],
        ['Betrag', formatEuro(order.total_cents)],
        ['Zahlungsart', methodLabel],
      ])),
      mailSection('Positionen', mailTable(itemRows)),
      mailParagraph('Wir beginnen mit der Fertigung und melden uns, sobald sich der Status ändert.'),
      mailButton(publicOrderUrl(order), 'Bestellübersicht öffnen'),
    ].join(''),
  });
  const adminHtml = mailLayout({
    title: 'Zahlung eingegangen',
    preheader: `Bestellung ${order.order_number} · ${formatEuro(order.total_cents)}`,
    body: [
      mailSection('Zahlung', mailTable([
        ['Bestellung', order.order_number],
        ['Kunde', `${order.first_name} ${order.last_name} <${order.email}>`],
        ['Betrag', formatEuro(order.total_cents)],
        ['Zahlungsart', methodLabel],
        ['Anbieter', paymentProviderLabel(order.payment_provider)],
        ['Referenz', order.payment_reference || '–'],
      ])),
      mailButton(`${config.payment.baseUrl}/admin/bestellungen/${order.id}/`, 'Bestellung im Admin öffnen'),
    ].join(''),
  });

  try {
    await sendMail({
      to: order.email,
      subject: `Zahlung eingegangen – Bestellung ${order.order_number}`,
      text,
      html: customerHtml,
      replyTo: config.mail.to,
    });
    await notifyAdmin({
      subject: `[Zahlung] Bestellung ${order.order_number} – ${formatEuro(order.total_cents)}`,
      text: [
        `Zahlung eingegangen für Bestellung ${order.order_number}.`,
        `Kunde: ${order.first_name} ${order.last_name} <${order.email}>`,
        `Betrag: ${formatEuro(order.total_cents)}`,
        `Zahlungsart: ${methodLabel}`,
        `Anbieter: ${paymentProviderLabel(order.payment_provider)}`,
        `Referenz: ${order.payment_reference || '–'}`,
        '',
        `Admin: ${config.payment.baseUrl}/admin/bestellungen/${order.id}/`,
      ].join('\n'),
      html: adminHtml,
      replyTo: order.email,
    });
  } catch (error) {
    getLogger().warn(
      { err: error, order: order.order_number },
      'Zahlungsbestätigung konnte nicht per E-Mail versendet werden',
    );
  }
}
