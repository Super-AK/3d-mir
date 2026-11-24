import { getDb } from '../db/index.js';

/** Zentrale Konfiguration der Shop-API. Alle Freigaben wirken sofort pro Abruf. */
export const API_SETTINGS_KEY = 'api.settings';
export const API_VERSION = '1.0.0';

export const API_SCOPES = [
  'orders:read',
  'customers:read',
  'products:read',
  'orders:write_status',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Interne Status, die einzeln für die Auslieferung freigegeben werden können. */
export const API_ORDER_STATUSES = [
  'neu',
  'bezahlt',
  'in_druck',
  'versandt',
  'abgeschlossen',
  'storniert',
] as const;

export type ApiSettings = {
  enabled: boolean;
  maintenance: boolean;
  rateLimitPerMinute: number;
  resources: { orders: boolean; customers: boolean; products: boolean };
  orderStatuses: string[];
  onlyPaid: boolean;
  includeGuests: boolean;
  fromDate: string;
  fields: {
    phone: boolean;
    vatId: boolean;
    customerNote: boolean;
    marketingConsent: boolean;
    attributes3d: boolean;
    modelFile: boolean;
  };
  products: { onlyActive: boolean; onlyWithSku: boolean; categories: string[] };
  customFields: { key: string; value: string; target: 'order' | 'item' }[];
  invoiceFeedback: boolean;
  showInvoiceLink: boolean;
  webhooks: { enabled: boolean; url: string; events: string[] };
  configVersion: number;
};

export function defaultApiSettings(): ApiSettings {
  return {
    enabled: true,
    maintenance: false,
    rateLimitPerMinute: 60,
    resources: { orders: true, customers: true, products: true },
    orderStatuses: [...API_ORDER_STATUSES],
    onlyPaid: false,
    includeGuests: true,
    fromDate: '',
    fields: {
      phone: true,
      vatId: false,
      customerNote: false,
      marketingConsent: false,
      attributes3d: true,
      modelFile: false,
    },
    products: { onlyActive: true, onlyWithSku: false, categories: [] },
    customFields: [],
    invoiceFeedback: true,
    showInvoiceLink: false,
    webhooks: { enabled: false, url: '', events: [] },
    configVersion: 1,
  };
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === '1' || value === 'on' || value === 'true') return true;
  if (value === '0' || value === 'off' || value === 'false') return false;
  return fallback;
}

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function whole(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function slugs(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const values = value.filter((item): item is string => typeof item === 'string');
  return [...new Set(values.filter((item) => !allowed || allowed.includes(item)))];
}

function normalize(value: unknown): ApiSettings {
  const defaults = defaultApiSettings();
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const resources = (raw.resources ?? {}) as Record<string, unknown>;
  const fields = (raw.fields ?? {}) as Record<string, unknown>;
  const products = (raw.products ?? {}) as Record<string, unknown>;
  const webhooks = (raw.webhooks ?? {}) as Record<string, unknown>;
  const customFields = Array.isArray(raw.customFields) ? raw.customFields : [];

  return {
    enabled: bool(raw.enabled, defaults.enabled),
    maintenance: bool(raw.maintenance, defaults.maintenance),
    rateLimitPerMinute: whole(raw.rateLimitPerMinute, defaults.rateLimitPerMinute, 1, 600),
    resources: {
      orders: bool(resources.orders, defaults.resources.orders),
      customers: bool(resources.customers, defaults.resources.customers),
      products: bool(resources.products, defaults.resources.products),
    },
    orderStatuses: slugs(raw.orderStatuses, API_ORDER_STATUSES),
    onlyPaid: bool(raw.onlyPaid, defaults.onlyPaid),
    includeGuests: bool(raw.includeGuests, defaults.includeGuests),
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(text(raw.fromDate, 10)) ? text(raw.fromDate, 10) : '',
    fields: {
      phone: bool(fields.phone, defaults.fields.phone),
      vatId: bool(fields.vatId, defaults.fields.vatId),
      customerNote: bool(fields.customerNote, defaults.fields.customerNote),
      marketingConsent: bool(fields.marketingConsent, defaults.fields.marketingConsent),
      attributes3d: bool(fields.attributes3d, defaults.fields.attributes3d),
      modelFile: bool(fields.modelFile, defaults.fields.modelFile),
    },
    products: {
      onlyActive: bool(products.onlyActive, defaults.products.onlyActive),
      onlyWithSku: bool(products.onlyWithSku, defaults.products.onlyWithSku),
      categories: slugs(products.categories),
    },
    customFields: customFields
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        key: text(item.key, 60).replace(/[^a-zA-Z0-9_.-]/g, ''),
        value: text(item.value, 500),
        target: item.target === 'item' ? ('item' as const) : ('order' as const),
      }))
      .filter((item) => item.key && item.value),
    invoiceFeedback: bool(raw.invoiceFeedback, defaults.invoiceFeedback),
    showInvoiceLink: bool(raw.showInvoiceLink, defaults.showInvoiceLink),
    webhooks: {
      enabled: bool(webhooks.enabled, defaults.webhooks.enabled),
      url: text(webhooks.url, 500),
      events: slugs(webhooks.events, [
        'order.created',
        'order.updated',
        'customer.updated',
        'product.updated',
      ]),
    },
    configVersion: whole(raw.configVersion, defaults.configVersion, 1, 1_000_000),
  };
}

function readRaw(): unknown {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(API_SETTINGS_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as unknown;
  } catch {
    return null;
  }
}

/** Liest die Freigaben; fehlt oder beschädigt die Konfiguration, gelten die Defaults. */
export function getApiSettings(): ApiSettings {
  const raw = readRaw();
  return raw ? normalize(raw) : defaultApiSettings();
}

function write(settings: ApiSettings): ApiSettings {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(API_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

/** Speichert Freigaben und erhöht config_version (Änderungen wirken sofort). */
export function saveApiSettings(input: unknown): ApiSettings {
  const current = getApiSettings();
  const next = normalize(input);
  return write({ ...next, configVersion: current.configVersion + 1 });
}

export function resetApiSettings(): ApiSettings {
  const current = getApiSettings();
  return write({ ...defaultApiSettings(), configVersion: current.configVersion + 1 });
}

/** Export ohne Tokens/Secrets (nur Freigaben und Metadaten). */
export function exportApiConfig(): Record<string, unknown> {
  return {
    contract: '3d-mir-api',
    api_version: API_VERSION,
    exported_at: new Date().toISOString(),
    settings: getApiSettings(),
    note: 'Tokens werden nicht exportiert; bitte auf jeder Umgebung neu anlegen.',
  };
}

/** Import der Freigaben aus einer JSON-Datei (ohne Tokens). */
export function importApiConfig(payload: unknown): ApiSettings {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const settings = raw.settings ?? payload;
  return saveApiSettings(settings);
}
