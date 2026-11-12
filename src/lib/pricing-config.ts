import { config, type PricingConfig } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Preisparameter aus der Datenbank überlagern die Werte aus `config/pricing.json`.
 * So kann der Betreiber Preise im Admin-Bereich ändern, ohne die Anwendung neu zu starten.
 * Die JSON-Datei bleibt die dokumentierte Grundeinstellung und dient zum Zurücksetzen.
 */
export type PricingOverrides = {
  meta?: {
    minOrderValue?: number;
    setupFee?: number;
    setupFeePerExtraPart?: number;
    roundTo?: number;
  };
  calculation?: {
    wallThicknessMm?: number;
    materialCm3PerHour?: number;
    wastePercent?: number;
  };
  materials?: Record<string, { pricePerGram?: number; density?: number }>;
  printers?: Record<string, { hourlyRate?: number }>;
  coatings?: Record<string, { pricePerPart?: number }>;
  shipping?: {
    freeShippingFrom?: number;
    methods?: Record<string, { price?: number }>;
  };
  quantityDiscounts?: { minQuantity: number; percent: number }[];
};

const SETTINGS_KEY = 'pricing.overrides';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function applyIfNumber(target: Record<string, unknown>, key: string, value: unknown): void {
  if (isNumber(value)) target[key] = value;
}

/** Liest die gespeicherten Überlagerungen (leer, wenn nichts gespeichert ist). */
export function getPricingOverrides(): PricingOverrides {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
      | { value: string }
      | undefined;
    if (!row) return {};
    const parsed: unknown = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? (parsed as PricingOverrides) : {};
  } catch {
    return {};
  }
}

/** Liefert die wirksame Preis-Konfiguration inklusive Admin-Änderungen. */
export function getPricingConfig(): PricingConfig {
  const result = structuredClone(config.pricing) as PricingConfig;
  const overrides = getPricingOverrides();

  if (overrides.meta) {
    const meta = result.meta as unknown as Record<string, unknown>;
    applyIfNumber(meta, 'minOrderValue', overrides.meta.minOrderValue);
    applyIfNumber(meta, 'setupFee', overrides.meta.setupFee);
    applyIfNumber(meta, 'setupFeePerExtraPart', overrides.meta.setupFeePerExtraPart);
    applyIfNumber(meta, 'roundTo', overrides.meta.roundTo);
  }

  if (overrides.calculation) {
    const calculation = result.calculation as unknown as Record<string, unknown>;
    applyIfNumber(calculation, 'wallThicknessMm', overrides.calculation.wallThicknessMm);
    applyIfNumber(calculation, 'materialCm3PerHour', overrides.calculation.materialCm3PerHour);
    applyIfNumber(calculation, 'wastePercent', overrides.calculation.wastePercent);
  }

  for (const material of result.materials) {
    const override = overrides.materials?.[material.id];
    if (!override) continue;
    if (isNumber(override.pricePerGram)) material.pricePerGram = override.pricePerGram;
    if (isNumber(override.density)) material.density = override.density;
  }

  for (const printer of result.printers) {
    const override = overrides.printers?.[printer.id];
    if (override && isNumber(override.hourlyRate)) printer.hourlyRate = override.hourlyRate;
  }

  for (const coating of result.coatings) {
    const override = overrides.coatings?.[coating.id];
    if (override && isNumber(override.pricePerPart)) coating.pricePerPart = override.pricePerPart;
  }

  if (overrides.shipping) {
    applyIfNumber(result.shipping as unknown as Record<string, unknown>, 'freeShippingFrom', overrides.shipping.freeShippingFrom);
    for (const method of result.shipping.methods) {
      const override = overrides.shipping.methods?.[method.id];
      if (override && isNumber(override.price)) method.price = override.price;
    }
  }

  if (Array.isArray(overrides.quantityDiscounts) && overrides.quantityDiscounts.length > 0) {
    result.quantityDiscounts = overrides.quantityDiscounts
      .filter((tier) => isNumber(tier.minQuantity) && isNumber(tier.percent))
      .map((tier) => ({ minQuantity: Math.max(1, Math.round(tier.minQuantity)), percent: Math.min(100, Math.max(0, tier.percent)) }))
      .sort((a, b) => a.minQuantity - b.minQuantity);
  }

  return result;
}

export function savePricingOverrides(overrides: PricingOverrides): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, JSON.stringify(overrides));
}

export function clearPricingOverrides(): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(SETTINGS_KEY);
}
