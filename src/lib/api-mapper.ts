import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import type { ApiSettings } from './api-settings.js';

export type OrderRow = {
  id: number;
  order_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  street: string;
  zip: string;
  city: string;
  address_extra: string;
  country: string;
  phone: string;
  payment_method: string;
  shipping_method: string;
  shipping_cents: number;
  subtotal_cents: number;
  total_cents: number;
  customer_note: string;
  user_id: number | null;
  options_cents: number;
  payment_status: string;
  payment_reference: string;
  paid_at: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_url: string;
  delivery_note_number: string;
  tracking_number: string;
  api_first_exposed_at: string | null;
};

export type OrderItemRow = {
  id: number;
  product_id: number | null;
  name: string;
  variant: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  color: string;
  personalization: string;
};

export type ProductRow = {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price_from_cents: number;
  price_to_cents: number;
  sku: string;
  weight_g: number;
  active: number;
  created_at: string;
  updated_at: string;
};

type VariantRow = { label: string; price_cents: number; stock: number };

/** SQLite-Zeitstempel (UTC) in ISO 8601 mit Z überführen. */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.includes('T')) return value.endsWith('Z') ? value : `${value}Z`;
  return `${value.replace(' ', 'T')}Z`;
}

/** Interne Bestellstatus auf das Vertrags-Enum abbilden. */
export function apiOrderStatus(status: string, paymentStatus: string): string {
  if (paymentStatus === 'erstattet' || status === 'erstattet') return 'refunded';
  if (status === 'storniert') return 'cancelled';
  switch (status) {
    case 'bezahlt':
      return 'paid';
    case 'in_druck':
      return 'processing';
    case 'versandt':
      return 'shipped';
    case 'abgeschlossen':
      return 'completed';
    case 'neu':
      return paymentStatus === 'bezahlt' ? 'paid' : 'awaiting_payment';
    default:
      return 'pending';
  }
}

function apiPaymentStatus(paymentStatus: string): string {
  switch (paymentStatus) {
    case 'bezahlt':
      return 'paid';
    case 'in_bearbeitung':
      return 'processing';
    case 'fehlgeschlagen':
      return 'failed';
    case 'erstattet':
      return 'refunded';
    case 'storniert':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function apiPaymentMethod(method: string): string {
  const value = method.toLowerCase();
  if (value.includes('paypal')) return 'paypal';
  if (value.includes('karte') || value.includes('card')) return 'card';
  if (value.includes('vorkasse') || value.includes('bank') || value.includes('überweisung')) {
    return 'bank_transfer';
  }
  if (value.includes('klarna')) return 'klarna';
  if (value.includes('ideal')) return 'ideal';
  if (value.includes('amazon')) return 'amazon_pay';
  return value || 'unknown';
}

/** Stabile Kunden-ID: angemeldete Kunden bevorzugt, sonst Hash der E-Mail. */
export function customerExternalId(email: string, userId: number | null): string {
  if (userId) return `usr_${userId}`;
  const digest = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return `cus_${digest.slice(0, 16)}`;
}

function address(row: OrderRow): Record<string, unknown> {
  return {
    name: `${row.first_name} ${row.last_name}`.trim(),
    company: row.company || null,
    street: row.street,
    address_2: row.address_extra || null,
    postal_code: row.zip,
    city: row.city,
    country_code: row.country || 'DE',
  };
}

function customFields(settings: ApiSettings, target: 'order' | 'item'): Record<string, string> {
  return Object.fromEntries(
    settings.customFields.filter((field) => field.target === target).map((field) => [field.key, field.value]),
  );
}

function itemsOf(orderId: number, settings: ApiSettings): Record<string, unknown>[] {
  const items = getDb()
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .all(orderId) as OrderItemRow[];
  const products = new Map<number, { sku: string; material: string }>();
  return items.map((item) => {
    let product = item.product_id ? products.get(item.product_id) : undefined;
    if (item.product_id && !product) {
      product = getDb()
        .prepare('SELECT sku, material FROM products WHERE id = ?')
        .get(item.product_id) as { sku: string; material: string } | undefined;
      if (product) products.set(item.product_id, product);
    }
    const attributes: Record<string, unknown> = {};
    if (settings.fields.attributes3d) {
      attributes.material = product?.material || 'PLA';
      attributes.color = item.color || null;
      attributes.infill_percent = null;
      if (settings.fields.modelFile) attributes.model_file = null;
    }
    const description = [item.variant, item.color && `Farbe: ${item.color}`, item.personalization]
      .filter(Boolean)
      .join(' · ');
    return {
      line_id: `${orderId}-${item.id}`,
      product_id: item.product_id ? String(item.product_id) : null,
      sku: product?.sku || null,
      name: item.name,
      description: description || null,
      quantity: item.quantity,
      unit: 'Stk',
      unit_price_net_cents: item.unit_price_cents,
      unit_price_gross_cents: item.unit_price_cents,
      tax_rate_percent: 0,
      line_total_net_cents: item.line_total_cents,
      line_total_gross_cents: item.line_total_cents,
      attributes: { ...attributes, ...customFields(settings, 'item') },
    };
  });
}

/** Übersetzt eine Bestellzeile in das Order-Modell des API-Vertrags. */
export function mapOrder(row: OrderRow, settings: ApiSettings): Record<string, unknown> {
  const items = itemsOf(row.id, settings);
  const itemsSum = items.reduce((sum, item) => sum + Number(item.line_total_gross_cents ?? 0), 0);
  let subtotal = itemsSum + row.options_cents;
  let discount = 0;
  const difference = row.total_cents - subtotal - row.shipping_cents;
  if (difference > 0) subtotal += difference;
  if (difference < 0) discount = -difference;

  const customerSnapshot: Record<string, unknown> = {
    type: row.company ? 'business' : 'private',
    company: row.company || null,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
  };
  if (settings.fields.phone) customerSnapshot.phone = row.phone || null;
  if (settings.fields.vatId) customerSnapshot.vat_id = null;

  const customerNote = settings.fields.customerNote ? row.customer_note || null : undefined;
  const billing = address(row);
  const shipping = address(row);

  return {
    id: String(row.id),
    order_number: row.order_number,
    status: apiOrderStatus(row.status, row.payment_status),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    currency: 'EUR',
    customer_id: customerExternalId(row.email, row.user_id),
    customer_snapshot: customerSnapshot,
    billing_address: billing,
    shipping_address: shipping,
    items,
    shipping: {
      method: row.shipping_method,
      cost_net_cents: row.shipping_cents,
      cost_gross_cents: row.shipping_cents,
      tax_rate_percent: 0,
      tracking_number: row.tracking_number || null,
      shipped_at: row.status === 'versandt' || row.status === 'abgeschlossen' ? toIso(row.updated_at) : null,
    },
    discounts: discount ? [{ label: 'Rabatt', amount_net_cents: discount, amount_gross_cents: discount }] : [],
    totals: {
      subtotal_net_cents: subtotal,
      shipping_net_cents: row.shipping_cents,
      discount_net_cents: discount,
      tax_cents: 0,
      total_net_cents: row.total_cents,
      total_gross_cents: row.total_cents,
    },
    tax_info: {
      small_business_19_ustg: config.site.business.smallBusiness,
      note: config.site.business.vatNote || 'Kein Mehrwertsteuerausweis nach § 19 UStG.',
    },
    payment: {
      method: apiPaymentMethod(row.payment_method),
      status: apiPaymentStatus(row.payment_status),
      paid_at: toIso(row.paid_at),
      transaction_ref: row.payment_reference || null,
    },
    ...(customerNote !== undefined ? { customer_note: customerNote } : {}),
    meta: { source_channel: 'shop', ...customFields(settings, 'order') },
    invoice: {
      number: row.invoice_number || null,
      date: row.invoice_date || null,
      url: settings.showInvoiceLink && row.invoice_url ? row.invoice_url : null,
      delivery_note_number: row.delivery_note_number || null,
    },
  };
}

/** Kunden aus den Bestell-Snapshots ableiten (siehe VERTRAGS-ANMERKUNGEN A1). */
export function mapCustomer(orders: OrderRow[], settings: ApiSettings): Record<string, unknown> | null {
  const latest = orders[orders.length - 1];
  const first = orders[0];
  if (!latest || !first) return null;
  const customer: Record<string, unknown> = {
    id: customerExternalId(latest.email, latest.user_id),
    created_at: toIso(first.created_at),
    updated_at: toIso(latest.updated_at),
    type: latest.company ? 'business' : 'private',
    company: latest.company || null,
    first_name: latest.first_name,
    last_name: latest.last_name,
    email: latest.email,
    billing_address: address(latest),
    default_shipping_address: null,
    is_guest: !latest.user_id,
  };
  if (settings.fields.phone) customer.phone = latest.phone || null;
  if (settings.fields.vatId) customer.vat_id = null;
  if (settings.fields.marketingConsent) customer.marketing_consent = false;
  return customer;
}

/** Produkt inklusive Varianten in das Vertragsmodell übersetzen. */
export function mapProduct(
  row: ProductRow,
  variants: VariantRow[],
  settings: ApiSettings,
): Record<string, unknown> {
  const price = row.price_from_cents || row.price_to_cents;
  return {
    id: String(row.id),
    sku: row.sku || null,
    name: row.name,
    description: row.short_description || row.description || null,
    unit: 'Stk',
    price_net_cents: price,
    price_gross_cents: price,
    tax_rate_percent: 0,
    active: Boolean(row.active),
    weight_grams: Math.round(row.weight_g || 0),
    variants: variants.map((variant) => ({
      id: variant.label,
      name: variant.label,
      sku: null,
      price_net_cents: variant.price_cents,
      price_gross_cents: variant.price_cents,
      stock: variant.stock,
    })),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    categories: settings.products.categories.length ? settings.products.categories : [],
  };
}
