import { config, type Material, type PricingConfig } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Preisparameter aus der Datenbank überlagern die Werte aus `config/pricing.json`.
 * So kann der Betreiber Preise im Admin-Bereich ändern, ohne die Anwendung neu zu starten.
 * Die JSON-Datei bleibt die dokumentierte Grundeinstellung und dient zum Zurücksetzen.
 */
export type PricingCatalog = {
  materials: PricingConfig['materials'];
  printers: PricingConfig['printers'];
  coatings: PricingConfig['coatings'];
  shippingMethods: PricingConfig['shipping']['methods'];
  quantityDiscounts: PricingConfig['quantityDiscounts'];
};

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
  /** Vollständige Kataloge, sobald der Betreiber Einträge anlegt oder löscht. */
  catalog?: PricingCatalog;
};

const SETTINGS_KEY = 'pricing.overrides';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function applyIfNumber(target: Record<string, unknown>, key: string, value: unknown): void {
  if (isNumber(value)) target[key] = value;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function positive(value: unknown, fallback: number): number {
  return isNumber(value) && value > 0 ? value : fallback;
}

function nonNegative(value: unknown, fallback: number): number {
  return isNumber(value) && value >= 0 ? value : fallback;
}

/** Wendet einen vollständig im Admin gepflegten Katalog an und ersetzt die JSON-Listen. */
function applyCatalog(result: PricingConfig, catalog: PricingCatalog): void {
  if (Array.isArray(catalog.materials) && catalog.materials.length > 0) {
    result.materials = catalog.materials.map((material) => ({
      id: text(material.id),
      label: text(material.label) || text(material.id),
      density: positive(material.density, 1),
      pricePerGram: nonNegative(material.pricePerGram, 0),
      maxTempC: nonNegative(material.maxTempC, 0),
      colors: Array.isArray(material.colors) && material.colors.length > 0
        ? material.colors.filter((color): color is string => typeof color === 'string' && color.trim() !== '')
        : ['Schwarz'],
      properties: text(material.properties),
      useCases: text(material.useCases),
      notes: text(material.notes),
      active: material.active !== false,
    })).filter((material) => material.id !== '') as Material[];
  }

  if (Array.isArray(catalog.printers) && catalog.printers.length > 0) {
    const materialIds = new Set(result.materials.map((material) => material.id));
    result.printers = catalog.printers.map((printer) => {
      const ids = Array.isArray(printer.materialIds)
        ? printer.materialIds.filter((id): id is string => typeof id === 'string' && materialIds.has(id))
        : [];
      return {
        id: text(printer.id),
        label: text(printer.label) || text(printer.id),
        buildVolume: {
          x: positive(printer.buildVolume?.x, 200),
          y: positive(printer.buildVolume?.y, 200),
          z: positive(printer.buildVolume?.z, 200),
        },
        hourlyRate: nonNegative(printer.hourlyRate, 0),
        materialIds: ids.length > 0 ? ids : [...materialIds],
        note: text(printer.note),
        active: printer.active !== false,
      };
    }).filter((printer) => printer.id !== '');
  }

  if (Array.isArray(catalog.coatings) && catalog.coatings.length > 0) {
    result.coatings = catalog.coatings.map((coating) => ({
      id: text(coating.id),
      label: text(coating.label) || text(coating.id),
      surchargePercent: nonNegative(coating.surchargePercent, 0),
      pricePerPart: nonNegative(coating.pricePerPart, 0),
      active: coating.active !== false,
    })).filter((coating) => coating.id !== '');
  }

  if (Array.isArray(catalog.shippingMethods) && catalog.shippingMethods.length > 0) {
    result.shipping.methods = catalog.shippingMethods.map((method) => ({
      id: text(method.id),
      label: text(method.label) || text(method.id),
      price: nonNegative(method.price, 0),
      deliveryDays: text(method.deliveryDays),
      active: method.active !== false,
    })).filter((method) => method.id !== '');
  }

  if (Array.isArray(catalog.quantityDiscounts)) {
    const seen = new Set<number>();
    result.quantityDiscounts = catalog.quantityDiscounts
      .filter((tier) => isNumber(tier.minQuantity) && isNumber(tier.percent))
      .map((tier) => ({
        minQuantity: Math.max(1, Math.round(tier.minQuantity)),
        percent: Math.min(100, Math.max(0, tier.percent)),
      }))
      .filter((tier) => {
        if (seen.has(tier.minQuantity)) return false;
        seen.add(tier.minQuantity);
        return true;
      })
      .sort((a, b) => a.minQuantity - b.minQuantity);
  }
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
export function getPricingConfig(options: { includeInactive?: boolean } = {}): PricingConfig {
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

  if (overrides.catalog) {
    applyCatalog(result, overrides.catalog);
  }

  if (!options.includeInactive) {
    const activeMaterials = new Set(
      result.materials.filter((material) => material.active !== false).map((material) => material.id),
    );
    result.materials = result.materials.filter((material) => material.active !== false);
    result.printers = result.printers
      .filter((printer) => printer.active !== false)
      .map((printer) => ({
        ...printer,
        materialIds: printer.materialIds.filter((id) => activeMaterials.has(id)),
      }))
      .filter((printer) => printer.materialIds.length > 0);
    result.coatings = result.coatings.filter((coating) => coating.active !== false);
    result.shipping.methods = result.shipping.methods.filter((method) => method.active !== false);
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
