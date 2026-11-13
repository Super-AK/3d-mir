import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { isStripeConfigured } from './payments/stripe.js';

/**
 * Vom Betreiber pflegbare Shop-Einstellungen.
 *
 * Die Standardwerte stehen in `config/shop.json`. Änderungen aus dem Admin
 * werden als Overrides in der Tabelle `settings` gespeichert. Geheimnisse
 * (Stripe-Schlüssel) liegen ausschließlich in der Umgebung.
 */
export type PaymentProvider = 'manual' | 'stripe';

export type BankDetails = {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
};

export type PaymentMethodSetting = {
  id: string;
  provider: PaymentProvider;
  stripeMethod: string;
  label: string;
  note: string;
  enabled: boolean;
  sortOrder: number;
};

export type ShopSettings = {
  bank: BankDetails;
  paymentMethods: PaymentMethodSetting[];
};

const SETTINGS_KEY = 'shop.settings';

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function defaultPaymentMethods(): PaymentMethodSetting[] {
  return config.shop.payment.methods.map((method, index) => ({
    id: method.id,
    provider: method.provider === 'stripe' ? 'stripe' : 'manual',
    stripeMethod: text(method.stripeMethod, 40),
    label: method.label,
    note: method.note,
    enabled: method.enabled !== false,
    sortOrder: Number.isFinite(method.sortOrder) ? Math.trunc(method.sortOrder as number) : (index + 1) * 10,
  }));
}

function normalizeBank(value: unknown): BankDetails {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    accountHolder: text(raw.accountHolder, 120),
    iban: text(raw.iban, 34).replace(/\s+/g, '').toUpperCase(),
    bic: text(raw.bic, 11).replace(/\s+/g, '').toUpperCase(),
    bankName: text(raw.bankName, 120),
  };
}

function normalizeMethods(value: unknown): PaymentMethodSetting[] {
  const overrides = new Map<string, Record<string, unknown>>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const raw = entry as Record<string, unknown>;
      const id = text(raw.id, 60);
      if (id) overrides.set(id, raw);
    }
  }

  return defaultPaymentMethods()
    .map((method) => {
      const override = overrides.get(method.id);
      if (!override) return method;
      return {
        ...method,
        label: text(override.label, 120) || method.label,
        note: text(override.note, 300) || method.note,
        enabled: override.enabled === undefined ? method.enabled : override.enabled !== false,
        sortOrder: Number.isFinite(Number(override.sortOrder))
          ? Math.trunc(Number(override.sortOrder))
          : method.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'));
}

/** Liest die aktuellen Shop-Einstellungen inklusive Admin-Overrides. */
export function getShopSettings(): ShopSettings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;

  let parsed: Record<string, unknown> = {};
  if (row) {
    try {
      const value: unknown = JSON.parse(row.value);
      if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
    } catch {
      // Ungültige Overrides werden ignoriert; die Standardwerte greifen.
    }
  }

  return {
    bank: normalizeBank(parsed.bank),
    paymentMethods: normalizeMethods(parsed.paymentMethods),
  };
}

/** Speichert Bankverbindung und Zahlungsarten-Einstellungen. */
export function saveShopSettings(settings: ShopSettings): void {
  const value = JSON.stringify({
    bank: settings.bank,
    paymentMethods: settings.paymentMethods,
  });
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, value);
}

export function isBankConfigured(bank: BankDetails): boolean {
  return bank.accountHolder !== '' && bank.iban !== '';
}

/**
 * Zahlungsarten, die im Checkout und auf der Zahlungsseite angeboten werden.
 * Stripe-Methoden erscheinen erst, wenn Schlüssel und Webhook-Secret gesetzt sind.
 */
export function getPublicPaymentMethods(): PaymentMethodSetting[] {
  return getShopSettings()
    .paymentMethods.filter((method) => method.enabled)
    .filter((method) => method.provider === 'manual' || isStripeConfigured())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'));
}

/** Findet eine Zahlungsart unabhängig von ihrer öffentlichen Verfügbarkeit. */
export function findPaymentMethod(id: string): PaymentMethodSetting | null {
  return getShopSettings().paymentMethods.find((method) => method.id === id) ?? null;
}

/** Findet eine Zahlungsart, die aktuell im Checkout gewählt werden darf. */
export function findCheckoutPaymentMethod(id: string): PaymentMethodSetting | null {
  return getPublicPaymentMethods().find((method) => method.id === id) ?? null;
}

export function paymentMethodLabel(id: string): string {
  return findPaymentMethod(id)?.label ?? id;
}
