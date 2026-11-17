import { describe, expect, it } from 'vitest';
import {
  deliveryTimeText,
  formatEuro,
  orderTotals,
  pickupShippingMethod,
  shippingCents,
  shippingPriceText,
  subtotalCents,
  type ShippingMethod,
} from '../../src/lib/shop.js';

const shipping = {
  status: 'PLATZHALTER',
  note: '',
  freeShippingFrom: 50,
  methods: [
    { id: 'dhl-paket', label: 'DHL Paket', price: 4.99, deliveryDays: '2–5' },
    { id: 'abholung', label: 'Abholung', price: 0, deliveryDays: 'nach Absprache' },
  ],
};

const dhl: ShippingMethod = shipping.methods[0]!;
const pickup: ShippingMethod = shipping.methods[1]!;

describe('Warenkorb-Summen', () => {
  it('summiert Positionen in Cent', () => {
    expect(subtotalCents([{ unitPriceCents: 1100, quantity: 2 }, { unitPriceCents: 499, quantity: 1 }])).toBe(2699);
  });

  it('berechnet Versand unter dem Mindestwert', () => {
    expect(shippingCents(shipping, dhl, 2200)).toBe(499);
  });

  it('macht den Versand ab dem Mindestwert kostenlos', () => {
    expect(shippingCents(shipping, dhl, 5000)).toBe(0);
    expect(shippingCents(shipping, dhl, 7000)).toBe(0);
  });

  it('lässt Abholung immer kostenlos', () => {
    expect(shippingCents(shipping, pickup, 100)).toBe(0);
  });

  it('liefert Zwischensumme, Versand und Gesamt', () => {
    const totals = orderTotals([{ unitPriceCents: 1100, quantity: 2 }], shipping, dhl);
    expect(totals).toEqual({
      subtotalCents: 2200,
      shippingCents: 499,
      optionsCents: 0,
      totalCents: 2699,
      freeShipping: false,
    });
  });

  it('addiert Versandoptionen auf den Gesamtbetrag', () => {
    const totals = orderTotals([{ unitPriceCents: 1100, quantity: 1 }], shipping, dhl, 700);
    expect(totals.optionsCents).toBe(700);
    expect(totals.totalCents).toBe(2299);
  });

  it('markiert kostenlosen Versand ab dem Mindestwert', () => {
    const totals = orderTotals([{ unitPriceCents: 2500, quantity: 2 }], shipping, dhl);
    expect(totals.shippingCents).toBe(0);
    expect(totals.freeShipping).toBe(true);
    expect(totals.totalCents).toBe(5000);
  });
});

describe('Produktseite: Versand und Lieferzeit', () => {
  it('zeigt bei einer Versandart den genauen Preis ohne „ab“', () => {
    expect(shippingPriceText([dhl])).toBe(formatEuro(499));
    expect(shippingPriceText([pickup])).toBe('kostenlos');
  });

  it('zeigt bei mehreren Versandarten den günstigsten Preis mit „ab“', () => {
    expect(shippingPriceText([dhl, pickup])).toBe(`ab ${formatEuro(0)}`);
  });

  it('erkennt die Abholung nur, wenn sie angeboten wird', () => {
    expect(pickupShippingMethod([dhl])).toBeNull();
    expect(pickupShippingMethod([dhl, pickup])?.id).toBe('abholung');
  });

  it('ergänzt bei reinen Zahlenangaben „Werktage“', () => {
    expect(deliveryTimeText([dhl])).toBe('2–5 Werktage');
    expect(deliveryTimeText([pickup])).toBe('nach Absprache');
  });

  it('nennt bei mehreren Versandarten jede Lieferzeit mit Bezeichnung', () => {
    expect(deliveryTimeText([dhl, pickup])).toBe('DHL Paket: 2–5 Werktage · Abholung: nach Absprache');
  });
});
