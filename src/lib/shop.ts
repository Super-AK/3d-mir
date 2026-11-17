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
  optionsCents: number;
  totalCents: number;
  freeShipping: boolean;
};

export function orderTotals(
  lines: OrderLine[],
  shipping: PricingConfig['shipping'],
  method: ShippingMethod,
  optionsCents = 0,
): OrderTotals {
  const subtotal = subtotalCents(lines);
  const shippingValue = shippingCents(shipping, method, subtotal);
  const extra = Math.max(0, Math.round(optionsCents));
  return {
    subtotalCents: subtotal,
    shippingCents: shippingValue,
    optionsCents: extra,
    totalCents: subtotal + shippingValue + extra,
    freeShipping: shippingValue === 0 && method.price > 0,
  };
}

/** Formatiert Cent als deutschen Euro-Betrag (ohne Intl-Abhängigkeit im Browser). */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export const PICKUP_SHIPPING_ID = 'abholung';

/** Findet die Abholung unter den für ein Produkt angebotenen Versandarten. */
export function pickupShippingMethod(methods: ShippingMethod[]): ShippingMethod | null {
  return methods.find((method) => method.id === PICKUP_SHIPPING_ID) ?? null;
}

/** Liefert true, wenn mindestens eine kostenpflichtige Versandart angeboten wird. */
export function hasPaidShippingMethod(methods: ShippingMethod[]): boolean {
  return methods.some((method) => method.price > 0);
}

/** Formatiert die Lieferzeit einer Versandart für die Produktseite. */
export function deliveryDaysText(method: ShippingMethod): string {
  const days = method.deliveryDays.trim();
  if (!days) return 'nach Absprache';
  if (method.id === PICKUP_SHIPPING_ID) return days;
  return /^\d+(\s*[–-]\s*\d+)?$/.test(days) ? `${days} Werktage` : days;
}

/**
 * Fasst die Lieferzeiten der angebotenen Versandarten zusammen. Die Abholung
 * hat keine Lieferzeit und bleibt außen vor. Bei mehreren Versandarten bzw.
 * zusätzlicher Abholung wird jede Lieferzeit mit ihrer Bezeichnung genannt.
 * Ohne Versandart bleibt der Text leer.
 */
export function deliveryTimeText(methods: ShippingMethod[]): string {
  const shippingMethods = methods.filter((method) => method.id !== PICKUP_SHIPPING_ID);
  if (shippingMethods.length === 0) return '';
  const withLabel = shippingMethods.length > 1 || methods.length > shippingMethods.length;
  return shippingMethods
    .map((method) => {
      const time = deliveryDaysText(method);
      return withLabel ? `${method.label}: ${time}` : time;
    })
    .join(' · ');
}

/**
 * Preistext für die Produktseite: Bei genau einer Versandart steht der genaue
 * Preis ohne „ab“, bei mehreren der günstigste Preis mit „ab“.
 */
export function shippingPriceText(methods: ShippingMethod[]): string {
  if (methods.length === 0) return 'kostenlos';
  const prices = methods.map((method) => Math.round(method.price * 100));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max <= 0) return 'kostenlos';
  const price = formatEuro(min);
  return methods.length > 1 ? `ab ${price}` : price;
}
