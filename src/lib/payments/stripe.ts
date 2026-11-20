import crypto from 'node:crypto';
import { config } from '../../config.js';

/** Fehler aus der Stripe-API oder der Signaturprüfung. */
export class StripeError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

export type StripeLineItem = {
  name: string;
  amountCents: number;
  quantity: number;
};

export type StripeCheckoutSession = {
  id: string;
  object: string;
  amount_total: number | null;
  currency: string | null;
  payment_status: string;
  status: string;
  metadata: Record<string, string> | null;
  client_reference_id: string | null;
  payment_intent: string | { id: string } | null;
  customer_email: string | null;
  expires_at: number | null;
  url?: string | null;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

export type CreateCheckoutSessionInput = {
  orderId: number;
  orderNumber: string;
  publicToken: string;
  paymentMethodId: string;
  stripeMethod: string;
  customerEmail: string;
  lineItems: StripeLineItem[];
  successUrl: string;
  cancelUrl: string;
};

/** Sind die für Checkout und Webhook nötigen Stripe-Geheimnisse gesetzt? */
export function isStripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey && config.stripe.webhookSecret);
}

export type StripeKeyKind =
  | 'missing'
  | 'secret-test'
  | 'secret-live'
  | 'restricted-test'
  | 'restricted-live'
  | 'unknown';

export type StripeDiagnostics = {
  configured: boolean;
  keyPresent: boolean;
  keyKind: StripeKeyKind;
  keyLabel: string;
  keyMode: 'test' | 'live' | 'unbekannt';
  configuredMode: 'test' | 'live';
  modeMatches: boolean;
  restricted: boolean;
  webhookPresent: boolean;
  webhookLabel: string;
  webhookLooksValid: boolean;
  paymentBaseUrl: string;
  issues: string[];
};

function inspectKey(key: string): Pick<StripeDiagnostics, 'keyKind' | 'keyLabel' | 'keyMode' | 'restricted'> {
  if (!key) {
    return { keyKind: 'missing', keyLabel: 'nicht gesetzt', keyMode: 'unbekannt', restricted: false };
  }
  if (/^sk_test_/.test(key)) {
    return { keyKind: 'secret-test', keyLabel: 'sk_test…', keyMode: 'test', restricted: false };
  }
  if (/^sk_live_/.test(key)) {
    return { keyKind: 'secret-live', keyLabel: 'sk_live…', keyMode: 'live', restricted: false };
  }
  if (/^rk_test_/.test(key)) {
    return { keyKind: 'restricted-test', keyLabel: 'rk_test…', keyMode: 'test', restricted: true };
  }
  if (/^rk_live_/.test(key)) {
    return { keyKind: 'restricted-live', keyLabel: 'rk_live…', keyMode: 'live', restricted: true };
  }
  return { keyKind: 'unknown', keyLabel: 'unbekanntes Präfix', keyMode: 'unbekannt', restricted: false };
}

/**
 * Admin-Diagnose ohne Geheimnisse: nur Präfixe, Modus und plausibility checks.
 */
export function getStripeDiagnostics(): StripeDiagnostics {
  const key = config.stripe.secretKey.trim();
  const webhook = config.stripe.webhookSecret.trim();
  const inspected = inspectKey(key);
  const webhookPresent = webhook.length > 0;
  const webhookLooksValid = /^whsec_/.test(webhook) && webhook.length > 10;
  const issues: string[] = [];

  if (inspected.keyKind === 'missing') {
    issues.push('STRIPE_SECRET_KEY ist nicht gesetzt.');
  } else if (inspected.keyKind === 'unknown') {
    issues.push('STRIPE_SECRET_KEY beginnt nicht mit sk_test_, sk_live_, rk_test_ oder rk_live_.');
  }
  if (inspected.keyMode !== 'unbekannt' && inspected.keyMode !== config.stripe.mode) {
    issues.push(
      `STRIPE_MODE=${config.stripe.mode} passt nicht zum Schlüssel (${inspected.keyLabel}). ` +
        'Beide müssen denselben Modus haben.',
    );
  }
  if (!webhookPresent) {
    issues.push('STRIPE_WEBHOOK_SECRET ist nicht gesetzt.');
  } else if (!webhookLooksValid) {
    issues.push('STRIPE_WEBHOOK_SECRET beginnt nicht mit whsec_.');
  }

  return {
    configured: Boolean(key && webhook),
    keyPresent: key.length > 0,
    ...inspected,
    configuredMode: config.stripe.mode,
    modeMatches: inspected.keyMode === 'unbekannt' || inspected.keyMode === config.stripe.mode,
    webhookPresent,
    webhookLabel: webhookPresent ? 'whsec…' : 'nicht gesetzt',
    webhookLooksValid,
    paymentBaseUrl: config.payment.baseUrl,
    issues,
  };
}

/** Lesbare, geheimnisfreie Fehlermeldung für Bestellnotiz und Admin-Anzeige. */
export function stripeErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || 'unbekannter Stripe-Fehler';
}

export type StripeConnectionTest = {
  ok: boolean;
  message: string;
  status: number | null;
};

/**
 * Prüft mit dem hinterlegten Schlüssel, ob die Checkout-Sessions-API erreichbar ist.
 * Der Test gibt bewusst keine Schlüssel oder Kontodaten zurück.
 */
export async function testStripeConnection(): Promise<StripeConnectionTest> {
  const diagnostics = getStripeDiagnostics();
  if (!diagnostics.keyPresent) {
    return { ok: false, message: diagnostics.issues[0] ?? 'STRIPE_SECRET_KEY fehlt.', status: null };
  }

  try {
    await stripeRequest<{ object: string }>('/v1/checkout/sessions?limit=1', { method: 'GET' });
    return {
      ok: true,
      message: 'Stripe antwortet. Der Schlüssel darf Checkout-Sessions lesen.',
      status: 200,
    };
  } catch (error) {
    if (error instanceof StripeError) {
      return { ok: false, message: error.message, status: error.status || null };
    }
    return { ok: false, message: stripeErrorDetail(error), status: null };
  }
}

async function stripeRequest<T>(path: string, init: RequestInit): Promise<T> {
  if (!config.stripe.secretKey) {
    throw new StripeError('STRIPE_SECRET_KEY ist nicht gesetzt.');
  }

  let response: Response;
  try {
    response = await fetch(`${config.stripe.apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.stripe.secretKey}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new StripeError(
      `Stripe ist nicht erreichbar: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`,
    );
  }

  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error?: { message?: unknown } }).error?.message ?? '')
        : '';
    throw new StripeError(message || `Stripe-API-Fehler (${response.status})`, response.status);
  }

  return parsed as T;
}

function appendSessionPlaceholder(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}session_id=STRIPE_SESSION_PLACEHOLDER`;
}

/** Erstellt eine gehostete Stripe-Checkout-Session für genau eine Zahlungsart. */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<StripeCheckoutSession> {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('locale', 'de');
  params.set('customer_email', input.customerEmail);
  params.set('client_reference_id', input.orderNumber);
  params.set('success_url', appendSessionPlaceholder(input.successUrl));
  params.set('cancel_url', input.cancelUrl);
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + 60 * 60));
  // Seit Stripe API 2026-09-30 ist payment_method_types nicht mehr beschreibbar.
  // allowed_payment_method_types filtert die vom Dashboard freigegebenen Methoden.
  params.set('allowed_payment_method_types[0]', input.stripeMethod);
  params.set('metadata[order_id]', String(input.orderId));
  params.set('metadata[order_number]', input.orderNumber);
  params.set('metadata[public_token]', input.publicToken);
  params.set('metadata[payment_method]', input.paymentMethodId);
  params.set('payment_intent_data[metadata][order_id]', String(input.orderId));
  params.set('payment_intent_data[metadata][order_number]', input.orderNumber);

  input.lineItems.forEach((item, index) => {
    params.set(`line_items[${index}][price_data][currency]`, 'eur');
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name.slice(0, 250));
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.amountCents));
    // Preise sind Endpreise (Kleinunternehmer nach § 19 UStG).
    params.set(`line_items[${index}][price_data][tax_behavior]`, 'inclusive');
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
  });

  const body = params.toString().replace('STRIPE_SESSION_PLACEHOLDER', '{CHECKOUT_SESSION_ID}');
  return stripeRequest<StripeCheckoutSession>('/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

/** Ruft eine Checkout-Session ab (Rückleitungs-Fallback und Webhook-Prüfung). */
export async function retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  });
}

function safeEqualHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Prüft die Stripe-Signatur und liefert das Ereignis.
 * `rawBody` muss der unveränderte Request-Body sein.
 */
export function verifyStripeWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret = config.stripe.webhookSecret,
): StripeEvent {
  if (!secret) throw new StripeError('STRIPE_WEBHOOK_SECRET ist nicht gesetzt.');
  if (!signatureHeader) throw new StripeError('Stripe-Signatur fehlt.');

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeError('Stripe-Signatur ist unvollständig.');
  }

  // Toleranz gegen Replay-Angriffe: fünf Minuten.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new StripeError('Stripe-Signatur ist abgelaufen.');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  if (!signatures.some((signature) => safeEqualHex(expected, signature))) {
    throw new StripeError('Stripe-Signatur ist ungültig.');
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new StripeError('Stripe-Ereignis ist kein gültiges JSON.');
  }

  if (!event || typeof event !== 'object' || typeof (event as { id?: unknown }).id !== 'string') {
    throw new StripeError('Stripe-Ereignis ist unvollständig.');
  }

  return event as StripeEvent;
}

/** Liefert die Payment-Intent-ID aus einer Checkout-Session. */
export function paymentIntentId(session: StripeCheckoutSession): string {
  if (typeof session.payment_intent === 'string') return session.payment_intent;
  return session.payment_intent?.id ?? '';
}
