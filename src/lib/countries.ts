/**
 * Länderliste für das Kontaktformular und die Länderprüfung.
 *
 * Bewusst eine feste Liste statt einer externen Geo-IP-Datenbank: Die Auswahl
 * im Formular ist nachvollziehbar, datenschutzfreundlich und funktioniert ohne
 * zusätzliche Dienste. Liefert ein vorgeschalteter Proxy ein Länderkürzel
 * (z. B. `CF-IPCountry`), wird dieses zusätzlich geprüft.
 */
const COUNTRY_CODES = [
  'DE', 'AT', 'CH', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
  'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO',
  'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'US', 'CA', 'AU', 'NZ', 'TR', 'UA', 'RS',
  'BA', 'MK', 'AL', 'ME', 'XK', 'MC', 'SM', 'AD', 'VA',
] as const;

export type CountryOption = { code: string; name: string };

const displayNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** Alle auswählbaren Länder, nach deutschem Namen sortiert. */
export const countries: CountryOption[] = COUNTRY_CODES.map((code) => ({
  code,
  name: displayNames.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name, 'de'));

const known = new Set<string>(COUNTRY_CODES);

export function isKnownCountry(code: string): boolean {
  return known.has(code.toUpperCase());
}

/** Deutscher Ländername zu einem ISO-3166-1-alpha-2-Code. */
export function countryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return code;
  return displayNames.of(normalized) ?? normalized;
}

/** Normalisiert ein Länderkürzel aus einem Formular oder Header. */
export function normalizeCountry(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
}
