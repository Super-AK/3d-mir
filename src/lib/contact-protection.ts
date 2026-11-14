import crypto from 'node:crypto';
import { config } from '../config.js';
import type { ContactSettings } from './contact-settings.js';
import { normalizeCountry } from './countries.js';
import { countryFromIp } from './geoip.js';

/**
 * Spam-Schutz für das Kontaktformular.
 *
 * Die Prüfungen sind bewusst konservativ: Auffällige Nachrichten werden im
 * Standardmodus nicht verworfen, sondern zur manuellen Prüfung gespeichert.
 * So gehen keine echten Anfragen verloren und der Betreiber entscheidet.
 */
export type ContactDecision = 'ok' | 'review' | 'block';

export type ContactAssessment = {
  decision: ContactDecision;
  country: string;
  reasons: string[];
};

export type ContactAssessmentInput = {
  settings: ContactSettings;
  /** Anhand der IP-Adresse ermitteltes Land; leer, wenn nicht ermittelbar. */
  ipCountry: unknown;
  token: unknown;
  name: string;
  email: string;
  subject: string;
  message: string;
  now?: number;
};

/** Herkunft der Länderangabe – nur für Protokoll und Diagnose. */
export type ContactCountrySource = 'header' | 'geoip' | 'none';

export type ContactCountry = {
  country: string;
  source: ContactCountrySource;
};

const TOKEN_MIN_AGE_MS = 3_000;
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

const SPAM_PATTERNS: RegExp[] = [
  /\b(viagra|cialis|levitra|casino|poker|porn|sexcam|escort|krypto|bitcoin|forex|binary\s*options)\b/i,
  /\b(seo\s*service|backlink|guest\s*post|link\s*aufbau|kredit\s*ohne\s*schufa|replica\s*watch)\b/i,
  /\[url=|\[link=|<a\s+href=/i,
];

function signature(timestamp: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(`contact:${timestamp}`).digest('base64url');
}

/** Erzeugt ein signiertes Zeit-Token für das Kontaktformular. */
export function createContactToken(now = Date.now()): string {
  const timestamp = String(now);
  return `${timestamp}.${signature(timestamp)}`;
}

/** Prüft Alter und Signatur des Formular-Tokens. */
export function verifyContactToken(
  token: unknown,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (typeof token !== 'string' || !/^\d{10,16}\.[A-Za-z0-9_-]{20,}$/.test(token)) {
    return { ok: false, reason: 'Formular-Token fehlt oder ist ungültig.' };
  }
  const [timestamp, provided] = token.split('.') as [string, string];
  const expected = signature(timestamp);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: 'Formular-Token ist ungültig.' };
  }

  const age = now - Number(timestamp);
  if (!Number.isFinite(age) || age < TOKEN_MIN_AGE_MS) {
    return { ok: false, reason: 'Formular wurde zu schnell abgesendet.' };
  }
  if (age > TOKEN_MAX_AGE_MS) {
    return { ok: false, reason: 'Formular ist abgelaufen.' };
  }
  return { ok: true };
}

/** Liest ein Länderkürzel aus den angegebenen Proxy-/CDN-Headern. */
export function headerCountry(
  headers: Record<string, unknown>,
  names: string[] = ['cf-ipcountry', 'x-country-code', 'x-vercel-ip-country', 'x-geo-country'],
): string {
  for (const name of names) {
    const raw = headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const normalized = normalizeCountry(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/^::ffff:/, '');
}

/**
 * Prüft, ob die direkte Gegenstelle ein vertrauenswürdiger Proxy ist.
 *
 * Länder-Header werden nur ausgewertet, wenn die Verbindung von einem in
 * `TRUST_PROXY` eingetragenen Proxy stammt. So kann ein Besucher das Land
 * nicht über einen selbst gesetzten Header fälschen.
 */
export function isTrustedProxyPeer(remoteAddress: string | undefined): boolean {
  const address = normalizeAddress(remoteAddress ?? '');
  const configured = String(config.trustProxy ?? '').trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false' || configured === '') return false;
  return configured
    .split(',')
    .map((entry) => normalizeAddress(entry))
    .some((entry) => entry === address);
}

/**
 * Ermittelt das Land eines Besuchers anhand der IP-Adresse.
 *
 * Ein Proxy-/CDN-Header wird nur ausgewertet, wenn er in `COUNTRY_HEADER`
 * ausdrücklich konfiguriert ist und die Verbindung von einem vertrauenswürdigen
 * Proxy stammt. Standardmäßig entscheidet ausschließlich die lokale
 * GeoIP-Datenbank. Der Besucher selbst gibt kein Land an.
 */
export async function resolveContactCountry(input: {
  ip: string;
  headers: Record<string, unknown>;
  trustedProxy: boolean;
}): Promise<ContactCountry> {
  if (input.trustedProxy && config.geoip.countryHeader) {
    const fromHeader = headerCountry(input.headers, [config.geoip.countryHeader]);
    if (fromHeader) return { country: fromHeader, source: 'header' };
  }

  const fromIp = await countryFromIp(input.ip);
  if (fromIp) return { country: fromIp, source: 'geoip' };

  return { country: '', source: 'none' };
}

function contentReasons(name: string, email: string, subject: string, message: string): string[] {
  const reasons: string[] = [];
  const text = `${name}\n${email}\n${subject}\n${message}`;

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push('Nachricht enthält typische Spam-Begriffe oder Link-Auszeichnungen.');
      break;
    }
  }

  const links = message.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 2) reasons.push(`Nachricht enthält auffällig viele Links (${links}).`);

  const letters = message.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  const upper = message.replace(/[^A-ZÄÖÜ]/g, '');
  if (letters.length >= 40 && upper.length / letters.length > 0.7) {
    reasons.push('Nachricht ist überwiegend in Großbuchstaben geschrieben.');
  }

  if (message.length > 200 && /(.)\1{30,}/.test(message)) {
    reasons.push('Nachricht enthält auffällig lange Zeichenwiederholungen.');
  }

  return reasons;
}

/** Bewertet eine Kontaktanfrage anhand der Admin-Einstellungen. */
export function assessContact(input: ContactAssessmentInput): ContactAssessment {
  const now = input.now ?? Date.now();
  const country = normalizeCountry(input.ipCountry);
  const reasons: string[] = [];
  const countryUnknown = input.settings.countryCheck && !country;

  if (input.settings.countryCheck) {
    if (!country) {
      if (input.settings.unknownCountry !== 'allow') {
        reasons.push('Land konnte nicht ermittelt werden.');
      }
    } else if (!input.settings.allowedCountries.includes(country)) {
      reasons.push(`Land ${country} ist nicht für Kontaktanfragen freigegeben.`);
    }
  }

  if (input.settings.timeCheck) {
    const result = verifyContactToken(input.token, now);
    if (!result.ok) reasons.push(result.reason);
  }

  if (input.settings.contentCheck) {
    reasons.push(...contentReasons(input.name, input.email, input.subject, input.message));
  }

  let decision: ContactDecision = reasons.length === 0 ? 'ok' : input.settings.mode === 'block' ? 'block' : 'review';

  // Ein unbekanntes Land wird unabhängig vom allgemeinen Modus behandelt.
  if (countryUnknown) {
    if (input.settings.unknownCountry === 'block') decision = 'block';
    else if (input.settings.unknownCountry === 'review' && decision !== 'block') decision = 'review';
  }

  return { decision, country, reasons: [...new Set(reasons)] };
}
