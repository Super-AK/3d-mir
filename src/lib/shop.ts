import type { PricingConfig } from '../config.js';

export type OrderLine = { unitPriceCents: number; quantity: number };

export type ShippingMethod = PricingConfig['shipping']['methods'][number];

/** Zwischensumme aller Positionen in Cent. */
export function subtotalCents(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, line.unitPriceCents) * Math.max(0, line.quantity), 0);
}

/** Findet eine Versandart anhand der ID. */
export function findShippingMethod(shipping: PricingConfig['shipping'], id: string): ShippingMethod | null {
  return shipping.methods.find((method) => method.id === id) ?? null;
}

/**
 * Versandkosten in Cent. Ab dem konfigurierten Mindestwert entfallen sie;
 * Abholung bleibt immer kostenlos.
 */
export function shippingCents(
  shipping: PricingConfig['shipping'],
  method: ShippingMethod,
  subtotal: number,
): number {
  if (method.price <= 0) return 0;
  const threshold = Math.round(shipping.freeShippingFrom * 100);
  if (threshold > 0 && subtotal >= threshold) return 0;
  return Math.round(method.price * 100);
}

export type OrderTotals = {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  freeShipping: boolean;
};

export function orderTotals(
  lines: OrderLine[],
  shipping: PricingConfig['shipping'],
  method: ShippingMethod,
): OrderTotals {
  const subtotal = subtotalCents(lines);
  const shippingValue = shippingCents(shipping, method, subtotal);
  return {
    subtotalCents: subtotal,
    shippingCents: shippingValue,
    totalCents: subtotal + shippingValue,
    freeShipping: shippingValue === 0 && method.price > 0,
  };
}

/** Formatiert Cent als deutschen Euro-Betrag (ohne Intl-Abhängigkeit im Browser). */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
