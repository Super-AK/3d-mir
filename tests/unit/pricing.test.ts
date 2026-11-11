import { describe, expect, it } from 'vitest';
import { calculatePrice, choosePrinter, type PricingData } from '../../src/lib/pricing.js';

const config: PricingData = {
  meta: {
    roundTo: 0.1,
    minOrderValue: 15,
    setupFee: 3.5,
    setupFeePerExtraPart: 0.75,
  },
  calculation: {
    wallThicknessMm: 1.2,
    materialCm3PerHour: 10,
    wastePercent: 5,
  },
  materials: [
    { id: 'pla', label: 'PLA', density: 1.24, pricePerGram: 0.05 },
    { id: 'abs', label: 'ABS', density: 1.04, pricePerGram: 0.05 },
  ],
  printers: [
    {
      id: 'small',
      label: 'Klein',
      buildVolume: { x: 100, y: 100, z: 100 },
      hourlyRate: 1.2,
      materialIds: ['pla'],
    },
    {
      id: 'large',
      label: 'Groß',
      buildVolume: { x: 250, y: 250, z: 250 },
      hourlyRate: 2.5,
      materialIds: ['pla', 'abs'],
    },
  ],
  coatings: [
    { id: 'none', label: 'Ohne', surchargePercent: 0, pricePerPart: 0 },
    { id: 'smooth', label: 'Glätten', surchargePercent: 0, pricePerPart: 4 },
  ],
  quantityDiscounts: [
    { minQuantity: 1, percent: 0 },
    { minQuantity: 5, percent: 10 },
  ],
};

const cube = {
  volumeCm3: 1,
  surfaceCm2: 6,
  dimensionsMm: { x: 10, y: 10, z: 10 },
};

const options = {
  materialId: 'pla',
  printerId: 'small',
  infill: 20,
  layerHeight: 0.2,
  quantity: 1,
  coatingId: 'none',
  scalePercent: 100,
};

describe('calculatePrice', () => {
  it('wendet den Mindestauftragswert an', () => {
    const result = calculatePrice(cube, options, config);
    expect(result.totalCents).toBe(1500);
    expect(result.breakdown.some((item) => item.label.includes('Mindestauftrag'))).toBe(true);
  });

  it('skaliert Volumen und Maße mit dem Faktor', () => {
    const result = calculatePrice(cube, { ...options, scalePercent: 200 }, config);
    expect(result.dimensionsMm).toEqual({ x: 20, y: 20, z: 20 });
    expect(result.weightG).toBeGreaterThan(5);
  });

  it('zieht den Mengenrabatt ab und rundet auf zehn Cent', () => {
    const result = calculatePrice(cube, { ...options, quantity: 5, coatingId: 'smooth' }, config);
    expect(result.discountPercent).toBe(10);
    expect(result.breakdown.some((item) => item.label.includes('Mengenrabatt'))).toBe(true);
    expect(result.totalCents % 10).toBe(0);
  });

  it('warnt bei zu großem Modell und falschem Material', () => {
    const result = calculatePrice(
      { ...cube, dimensionsMm: { x: 300, y: 20, z: 20 } },
      { ...options, materialId: 'abs' },
      config,
    );
    expect(result.fitsPrinter).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it('wirft bei unbekanntem Material', () => {
    expect(() => calculatePrice(cube, { ...options, materialId: 'nope' }, config)).toThrow();
  });
});

describe('choosePrinter', () => {
  it('wählt den kleinsten passenden Drucker', () => {
    expect(choosePrinter({ x: 50, y: 50, z: 50 }, 'pla', config.printers)).toBe('small');
  });

  it('wählt den großen Drucker für ABS', () => {
    expect(choosePrinter({ x: 50, y: 50, z: 50 }, 'abs', config.printers)).toBe('large');
  });

  it('berücksichtigt die Skalierung', () => {
    expect(choosePrinter({ x: 80, y: 80, z: 80 }, 'pla', config.printers, 200)).toBe('large');
  });
});
