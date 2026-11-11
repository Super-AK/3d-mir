/**
 * Preisberechnung für den 3D-Druck-Rechner.
 * Bewusst frei von Node- und Browser-Abhängigkeiten, damit Server und Browser
 * dieselbe Formel verwenden (Live-Schätzung im Browser, verbindliche Prüfung am Server).
 */

export type PriceMaterial = {
  id: string;
  label: string;
  density: number;
  pricePerGram: number;
};

export type PricePrinter = {
  id: string;
  label: string;
  buildVolume: { x: number; y: number; z: number };
  hourlyRate: number;
  materialIds: string[];
};

export type PriceCoating = {
  id: string;
  label: string;
  surchargePercent: number;
  pricePerPart: number;
};

export type PricingData = {
  meta: {
    roundTo: number;
    minOrderValue: number;
    setupFee: number;
    setupFeePerExtraPart: number;
  };
  calculation: {
    wallThicknessMm: number;
    materialCm3PerHour: number;
    wastePercent: number;
  };
  materials: PriceMaterial[];
  printers: PricePrinter[];
  coatings: PriceCoating[];
  quantityDiscounts: { minQuantity: number; percent: number }[];
};

export type PriceOptions = {
  materialId: string;
  printerId: string;
  infill: number;
  layerHeight: number;
  quantity: number;
  coatingId: string;
  scalePercent: number;
};

export type PriceMetrics = {
  volumeCm3: number;
  surfaceCm2: number;
  dimensionsMm: { x: number; y: number; z: number };
};

export type PriceBreakdownItem = { label: string; cents: number };

export type PriceResult = {
  totalCents: number;
  breakdown: PriceBreakdownItem[];
  weightG: number;
  materialCm3: number;
  printHours: number;
  discountPercent: number;
  dimensionsMm: { x: number; y: number; z: number };
  fitsPrinter: boolean;
  warnings: string[];
};

const DEFAULT_SCALE = 100;
const MIN_SCALE = 10;
const MAX_SCALE = 400;
const MAX_QUANTITY = 500;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Wählt den kleinsten Drucker, der Material und Modellmaße abdeckt. */
export function choosePrinter(
  dimensionsMm: { x: number; y: number; z: number },
  materialId: string,
  printers: PricePrinter[],
  scalePercent = DEFAULT_SCALE,
): string | null {
  const scale = clamp(scalePercent, MIN_SCALE, MAX_SCALE) / 100;
  const dims = [dimensionsMm.x * scale, dimensionsMm.y * scale, dimensionsMm.z * scale];
  const supports = printers.filter((printer) => printer.materialIds.includes(materialId));
  const candidates = supports.length > 0 ? supports : printers;
  const fits = candidates
    .filter((printer) =>
      dims.every(
        (dimension, index) =>
          dimension <= [printer.buildVolume.x, printer.buildVolume.y, printer.buildVolume.z][index]! + 0.5,
      ),
    )
    .sort(
      (a, b) =>
        a.buildVolume.x * a.buildVolume.y * a.buildVolume.z - b.buildVolume.x * b.buildVolume.y * b.buildVolume.z,
    );
  return (fits[0] ?? candidates[0])?.id ?? null;
}

/**
 * Schätzt Material, Druckzeit und Preis.
 *
 * Modell:
 * - Wandvolumen = Oberfläche × Wandstärke, Restvolumen × Füllgrad
 * - Material inkl. Verschnitt
 * - Druckzeit = Materialvolumen / Durchsatz, korrigiert nach Schichthöhe
 * - Preis = Material + Maschinenzeit + Nachbearbeitung + Rüstkosten − Mengenrabatt
 * - Mindestauftragswert und Rundung werden anschließend angewendet.
 */
export function calculatePrice(metrics: PriceMetrics, options: PriceOptions, config: PricingData): PriceResult {
  const material = config.materials.find((item) => item.id === options.materialId);
  const printer = config.printers.find((item) => item.id === options.printerId);
  const coating = config.coatings.find((item) => item.id === options.coatingId) ?? config.coatings[0];
  if (!material || !printer) {
    throw new Error('Unbekanntes Material oder unbekannter Drucker.');
  }

  const scale = clamp(Number.isFinite(options.scalePercent) ? options.scalePercent : DEFAULT_SCALE, MIN_SCALE, MAX_SCALE) / 100;
  const infill = clamp(Number.isFinite(options.infill) ? options.infill : 20, 0, 100);
  const layerHeight = clamp(Number.isFinite(options.layerHeight) ? options.layerHeight : 0.2, 0.05, 0.6);
  const quantity = clamp(Math.round(Number.isFinite(options.quantity) ? options.quantity : 1), 1, MAX_QUANTITY);

  const volumeCm3 = metrics.volumeCm3 * scale ** 3;
  const surfaceCm2 = metrics.surfaceCm2 * scale ** 2;
  const dimensionsMm = {
    x: round(metrics.dimensionsMm.x * scale, 1),
    y: round(metrics.dimensionsMm.y * scale, 1),
    z: round(metrics.dimensionsMm.z * scale, 1),
  };

  const wallCm = config.calculation.wallThicknessMm / 10;
  const shellCm3 = Math.min(volumeCm3, surfaceCm2 * wallCm);
  const interiorCm3 = Math.max(0, volumeCm3 - shellCm3);
  const partMaterialCm3 = (shellCm3 + interiorCm3 * (infill / 100)) * (1 + config.calculation.wastePercent / 100);
  const materialCm3 = partMaterialCm3 * quantity;
  const weightG = materialCm3 * material.density;

  const flow = Math.max(0.1, config.calculation.materialCm3PerHour);
  const printHours = (materialCm3 / flow) * (0.2 / layerHeight) ** 0.3;

  const materialCents = Math.round(weightG * material.pricePerGram * 100);
  const machineCents = Math.round(printHours * printer.hourlyRate * 100);
  const coatingCents = Math.round((coating?.pricePerPart ?? 0) * (1 + (coating?.surchargePercent ?? 0) / 100) * 100) * quantity;
  const setupCents = Math.round(
    (config.meta.setupFee + config.meta.setupFeePerExtraPart * (quantity - 1)) * 100,
  );

  const discountPercent =
    config.quantityDiscounts
      .filter((tier) => quantity >= tier.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0]?.percent ?? 0;
  const discountCents = Math.round(((materialCents + machineCents + coatingCents) * discountPercent) / 100);

  const subtotalCents = materialCents + machineCents + coatingCents + setupCents - discountCents;
  const minOrderCents = Math.round(config.meta.minOrderValue * 100);
  const minAdjustCents = Math.max(0, minOrderCents - subtotalCents);
  const rawTotalCents = subtotalCents + minAdjustCents;
  const step = Math.max(1, Math.round(config.meta.roundTo * 100));
  const totalCents = Math.ceil(rawTotalCents / step) * step;
  const roundingCents = totalCents - rawTotalCents;

  const breakdown: PriceBreakdownItem[] = [
    { label: `Material (${round(weightG, 0)} g ${material.label})`, cents: materialCents },
    { label: `Maschinenzeit (${round(printHours, 1)} h)`, cents: machineCents },
  ];
  if (coatingCents > 0) breakdown.push({ label: coating?.label ?? 'Nachbearbeitung', cents: coatingCents });
  if (setupCents > 0) breakdown.push({ label: 'Rüstkosten', cents: setupCents });
  if (discountCents > 0) breakdown.push({ label: `Mengenrabatt (${discountPercent} %)`, cents: -discountCents });
  if (minAdjustCents > 0) breakdown.push({ label: 'Anpassung an Mindestauftragswert', cents: minAdjustCents });
  if (roundingCents > 0) breakdown.push({ label: 'Rundung', cents: roundingCents });

  const fitsPrinter =
    dimensionsMm.x <= printer.buildVolume.x + 0.5 &&
    dimensionsMm.y <= printer.buildVolume.y + 0.5 &&
    dimensionsMm.z <= printer.buildVolume.z + 0.5;

  const warnings: string[] = [];
  if (!fitsPrinter) {
    warnings.push(
      `Das Modell überschreitet den Bauraum des ${printer.label} (${printer.buildVolume.x} × ${printer.buildVolume.y} × ${printer.buildVolume.z} mm). Bitte wählen Sie einen anderen Drucker oder verkleinern Sie das Modell.`,
    );
  }
  if (!printer.materialIds.includes(material.id)) {
    warnings.push(`${material.label} ist für den ${printer.label} nicht freigegeben.`);
  }
  if (quantity >= 100) {
    warnings.push('Bei großen Stückzahlen lohnt sich ein individuelles Angebot – wir prüfen Mengen und Fertigungszeit separat.');
  }
  if (scale !== 1) {
    warnings.push(`Die angezeigten Maße und der Preis beziehen sich auf ${round(scale * 100, 0)} % der Originalgröße.`);
  }
  if (volumeCm3 < 0.1) {
    warnings.push('Das Modell ist sehr klein. Bitte prüfen Sie die Einheit der Datei (Millimeter).');
  }

  return {
    totalCents,
    breakdown,
    weightG: round(weightG, 1),
    materialCm3: round(materialCm3, 2),
    printHours: round(printHours, 2),
    discountPercent,
    dimensionsMm,
    fitsPrinter,
    warnings,
  };
}
