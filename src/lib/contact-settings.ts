import { getDb } from '../db/index.js';
import { isKnownCountry } from './countries.js';

/**
 * Einstellungen für den Spam-Schutz des Kontaktformulars.
 *
 * Die Werte werden im Admin unter „Nachrichten“ gepflegt und in der Tabelle
 * `settings` gespeichert. Es gibt keine Umgebungs-Fallbacks: Ohne gespeicherte
 * Einstellungen gelten die datenschutzfreundlichen Standardwerte.
 */
export type ContactReviewMode = 'review' | 'block';

/** Verhalten, wenn sich das Land der IP-Adresse nicht ermitteln lässt. */
export type UnknownCountryBehavior = 'review' | 'block' | 'allow';

export type ContactSettings = {
  /** Länderprüfung aktiv. */
  countryCheck: boolean;
  /** Erlaubte Länder als ISO-3166-1-alpha-2-Codes. */
  allowedCountries: string[];
  /** Verhalten bei Auffälligkeiten: zur Prüfung speichern oder direkt ablehnen. */
  mode: ContactReviewMode;
  /** Verhalten, wenn das Land nicht ermittelt werden kann. */
  unknownCountry: UnknownCountryBehavior;
  /** Zeitprüfung: Formular muss einige Sekunden offen gewesen sein. */
  timeCheck: boolean;
  /** Inhaltsprüfung: Links, Spam-Begriffe und Großschreibung. */
  contentCheck: boolean;
  /** Absender nach wiederholten auffälligen Versuchen automatisch sperren. */
  spamBanEnabled: boolean;
  /** Anzahl auffälliger Versuche bis zur Sperre (3 oder 5). */
  spamBanThreshold: number;
  /** Zeitfenster in Minuten, in dem die Versuche gezählt werden. */
  spamBanWindowMinutes: number;
  /** Sperrdauer in Stunden; 0 bedeutet dauerhaft. */
  spamBanHours: number;
  /** Gesperrte Absender werden mit HTTP 404 („Datei nicht gefunden“) beantwortet. */
  spamBlockResponseEnabled: boolean;
};

export const defaultContactSettings: ContactSettings = {
  countryCheck: true,
  allowedCountries: ['DE'],
  mode: 'review',
  unknownCountry: 'review',
  timeCheck: true,
  contentCheck: true,
  spamBanEnabled: true,
  spamBanThreshold: 5,
  spamBanWindowMinutes: 60,
  spamBanHours: 24,
  spamBlockResponseEnabled: true,
};

const SETTINGS_KEY = 'contact.settings';

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'off') return false;
  return fallback;
}

function countryList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\s]+/) : [];
  return [...new Set(values.map((entry) => String(entry).trim().toUpperCase()).filter(isKnownCountry))];
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

/** Nur 3 oder 5 Versuche sind als Sperrschwelle vorgesehen. */
function banThreshold(value: unknown): number {
  return Number(value) === 3 ? 3 : 5;
}

/** Liest die aktuellen Einstellungen inklusive Standardwerten. */
export function getContactSettings(): ContactSettings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return { ...defaultContactSettings, allowedCountries: [...defaultContactSettings.allowedCountries] };

  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(row.value);
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {
    return { ...defaultContactSettings, allowedCountries: [...defaultContactSettings.allowedCountries] };
  }

  const allowed = countryList(parsed.allowedCountries);
  return {
    countryCheck: bool(parsed.countryCheck, defaultContactSettings.countryCheck),
    allowedCountries: allowed.length > 0 ? allowed : [...defaultContactSettings.allowedCountries],
    mode: parsed.mode === 'block' ? 'block' : 'review',
    unknownCountry: readUnknownCountry(parsed.unknownCountry),
    timeCheck: bool(parsed.timeCheck, defaultContactSettings.timeCheck),
    contentCheck: bool(parsed.contentCheck, defaultContactSettings.contentCheck),
    spamBanEnabled: bool(parsed.spamBanEnabled, defaultContactSettings.spamBanEnabled),
    spamBanThreshold: banThreshold(parsed.spamBanThreshold),
    spamBanWindowMinutes: wholeNumber(
      parsed.spamBanWindowMinutes,
      defaultContactSettings.spamBanWindowMinutes,
      5,
      1440,
    ),
    spamBanHours: wholeNumber(parsed.spamBanHours, defaultContactSettings.spamBanHours, 0, 8760),
    spamBlockResponseEnabled: bool(parsed.spamBlockResponseEnabled, defaultContactSettings.spamBlockResponseEnabled),
  };
}

function readUnknownCountry(value: unknown): UnknownCountryBehavior {
  return value === 'block' || value === 'allow' ? value : 'review';
}

/** Speichert die Einstellungen für den Kontakt-Spam-Schutz. */
export function saveContactSettings(settings: ContactSettings): void {
  const value = JSON.stringify({
    countryCheck: settings.countryCheck,
    allowedCountries: countryList(settings.allowedCountries),
    mode: settings.mode === 'block' ? 'block' : 'review',
    unknownCountry: readUnknownCountry(settings.unknownCountry),
    timeCheck: settings.timeCheck,
    contentCheck: settings.contentCheck,
    spamBanEnabled: settings.spamBanEnabled,
    spamBanThreshold: banThreshold(settings.spamBanThreshold),
    spamBanWindowMinutes: wholeNumber(
      settings.spamBanWindowMinutes,
      defaultContactSettings.spamBanWindowMinutes,
      5,
      1440,
    ),
    spamBanHours: wholeNumber(settings.spamBanHours, defaultContactSettings.spamBanHours, 0, 8760),
    spamBlockResponseEnabled: settings.spamBlockResponseEnabled,
  });
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, value);
}
