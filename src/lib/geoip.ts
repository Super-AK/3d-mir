import fs from 'node:fs';
import { isIP } from 'node:net';
import { open, type CountryResponse, type Reader } from 'maxmind';
import { config } from '../config.js';
import { normalizeCountry } from './countries.js';

/**
 * Ländererkennung anhand der IP-Adresse.
 *
 * Die Daten stammen aus einer lokalen GeoIP-Datenbank im MaxMind-Format
 * (z. B. DB-IP Lite oder GeoLite2 Country). Es werden keine externen Dienste
 * aufgerufen und keine IP-Adressen an Dritte übermittelt.
 */

export type GeoipStatus = {
  /** Datenbank vorhanden und lesbar. */
  available: boolean;
  /** Pfad zur erwarteten Datenbank. */
  path: string;
  /** Letzter Ladefehler, falls die Datei vorhanden, aber unbrauchbar ist. */
  error: string;
};

let readerPromise: Promise<Reader<CountryResponse> | null> | null = null;
let loadError = '';

/** Setzt den internen Cache zurück (z. B. nach Austausch der Datenbank). */
export function resetGeoipCache(): void {
  readerPromise = null;
  loadError = '';
}

/** Status für die Anzeige im Admin-Bereich (ohne die Datei zu laden). */
export function geoipStatus(): GeoipStatus {
  let available = false;
  try {
    available = fs.existsSync(config.geoip.dbPath) && fs.statSync(config.geoip.dbPath).size > 0;
  } catch {
    available = false;
  }
  return { available, path: config.geoip.dbPath, error: loadError };
}

async function loadReader(): Promise<Reader<CountryResponse> | null> {
  if (!readerPromise) {
    readerPromise = (async () => {
      try {
        if (!fs.existsSync(config.geoip.dbPath)) {
          loadError = 'Datenbankdatei nicht gefunden.';
          return null;
        }
        const reader = await open<CountryResponse>(config.geoip.dbPath, { cache: { max: 10_000 } });
        loadError = '';
        return reader;
      } catch (error) {
        loadError = error instanceof Error ? error.message : String(error);
        return null;
      }
    })();
  }
  return readerPromise;
}

/** Erkennt lokale und private Adressen, für die keine Länderangabe existiert. */
export function isPrivateAddress(address: string): boolean {
  const value = address.trim().replace(/^::ffff:/i, '');
  if (!value || value === '::' || value === '::1' || value === '0.0.0.0') return true;

  const parts = value.split('.');
  if (parts.length === 4) {
    const numbers = parts.map((part) => Number(part));
    if (numbers.every((number) => Number.isInteger(number) && number >= 0 && number <= 255)) {
      const [a, b] = numbers as [number, number, number, number];
      return (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      );
    }
    return false;
  }

  return /^f[cd][0-9a-f]{2}:/i.test(value);
}

/** Ermittelt das Land zu einer IP-Adresse; liefert einen leeren String, wenn unbekannt. */
export async function countryFromIp(address: string): Promise<string> {
  const ip = address.trim().replace(/^::ffff:/i, '');
  if (!isIP(ip) || isPrivateAddress(ip)) return '';

  const reader = await loadReader();
  if (!reader) return '';

  try {
    const record = reader.get(ip);
    return normalizeCountry(record?.country?.iso_code ?? record?.registered_country?.iso_code);
  } catch {
    return '';
  }
}
