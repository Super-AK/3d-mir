import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
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

/* -------------------------------------------------------------------------
 * Absender-Erkennung und automatische Sperren
 *
 * Die vollständige IP-Adresse wird bewusst nicht gespeichert. Für Sperren
 * genügt eine HMAC-Prüfsumme; die gekürzte Adresse dient nur der Diagnose.
 * ---------------------------------------------------------------------- */

export type ContactBlockRow = {
  id: number;
  ip_hash: string;
  ip_prefix: string;
  country: string;
  user_agent: string;
  reason: string;
  attempts: number;
  first_seen: string;
  last_seen: string;
  blocked: number;
  blocked_until: string | null;
  last_notified_at: string | null;
  created_at: string;
};

export type ContactAttemptInput = {
  ipHash: string;
  ipPrefix: string;
  country: string;
  userAgent: string;
  reason: string;
  settings: ContactSettings;
  now?: number;
};

export type ContactAttemptResult = {
  block: ContactBlockRow;
  attempts: number;
  blocked: boolean;
  newlyBlocked: boolean;
  /** Nur die erste Meldung je Absender und Tag sowie eine neue Sperre melden. */
  shouldNotify: boolean;
};

function sqliteTime(value: string | null): number {
  if (!value) return 0;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function sqliteNow(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** HMAC-Prüfsumme der IP-Adresse; ohne das Server-Secret nicht rückführbar. */
export function contactIpHash(address: string): string {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`contact-ip:${normalizeAddress(address)}`)
    .digest('base64url');
}

/** Gekürzte IP-Adresse für die Anzeige im Admin (IPv4 /24, IPv6 /48). */
export function contactIpPrefix(address: string): string {
  const ip = normalizeAddress(address);
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return '';
  }
  if (ip.includes(':')) {
    const [head = '', tail = ''] = ip.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = Math.max(0, 8 - headParts.length - tailParts.length);
    const full = [...headParts, ...Array.from({ length: missing }, () => '0'), ...tailParts];
    return `${full.slice(0, 3).map((part) => part || '0').join(':')}::/48`;
  }
  return '';
}

/** Browserkennung bereinigen und auf 300 Zeichen begrenzen. */
export function contactUserAgent(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string'
    ? raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 300)
    : '';
}

/** Liefert eine aktuell aktive Sperre für die IP-Prüfsumme. */
export function getActiveContactBlock(ipHash: string, now = Date.now()): ContactBlockRow | null {
  const row = getDb()
    .prepare('SELECT * FROM contact_blocks WHERE ip_hash = ?')
    .get(ipHash) as ContactBlockRow | undefined;
  if (!row || row.blocked !== 1) return null;
  if (row.blocked_until && sqliteTime(row.blocked_until) <= now) return null;
  return row;
}

export function isContactBlockActive(row: ContactBlockRow, now = Date.now()): boolean {
  return row.blocked === 1 && (!row.blocked_until || sqliteTime(row.blocked_until) > now);
}

/**
 * Zählt einen auffälligen Versuch und sperrt den Absender bei Erreichen der
 * eingestellten Schwelle. Normale Anfragen rufen diese Funktion nicht auf.
 */
export function registerContactAttempt(input: ContactAttemptInput): ContactAttemptResult {
  const db = getDb();
  const now = input.now ?? Date.now();
  const nowSql = sqliteNow(now);
  const windowMs = input.settings.spamBanWindowMinutes * 60_000;
  const existing = db
    .prepare('SELECT * FROM contact_blocks WHERE ip_hash = ?')
    .get(input.ipHash) as ContactBlockRow | undefined;

  const withinWindow = existing ? now - sqliteTime(existing.last_seen) <= windowMs : false;
  let attempts = withinWindow ? existing!.attempts + 1 : 1;
  let firstSeen = withinWindow ? existing!.first_seen : nowSql;
  let blocked = existing ? existing.blocked === 1 : false;
  let blockedUntil = existing?.blocked_until ?? null;

  // Abgelaufene Sperre aufheben und den Zähler neu beginnen.
  if (blocked && blockedUntil && sqliteTime(blockedUntil) <= now) {
    blocked = false;
    blockedUntil = null;
    attempts = 1;
    firstSeen = nowSql;
  }

  const newlyBlocked =
    input.settings.spamBanEnabled && !blocked && attempts >= input.settings.spamBanThreshold;

  if (newlyBlocked) {
    blocked = true;
    blockedUntil =
      input.settings.spamBanHours > 0
        ? sqliteNow(now + input.settings.spamBanHours * 60 * 60 * 1000)
        : null;
  }

  const lastNotifiedAt = existing ? sqliteTime(existing.last_notified_at) : 0;
  const shouldNotify =
    newlyBlocked ||
    (!blocked && (lastNotifiedAt === 0 || now - lastNotifiedAt >= 24 * 60 * 60 * 1000));

  const values: (string | number | null)[] = [
    input.ipPrefix || existing?.ip_prefix || '',
    input.country || existing?.country || '',
    input.userAgent || existing?.user_agent || '',
    input.reason || existing?.reason || '',
    attempts,
    firstSeen,
    nowSql,
    blocked ? 1 : 0,
    blockedUntil,
    shouldNotify ? nowSql : (existing?.last_notified_at ?? null),
    input.ipHash,
  ];

  let id: number;
  if (existing) {
    db.prepare(
      `UPDATE contact_blocks
          SET ip_prefix = ?, country = ?, user_agent = ?, reason = ?, attempts = ?,
              first_seen = ?, last_seen = ?, blocked = ?, blocked_until = ?,
              last_notified_at = ?
        WHERE ip_hash = ?`,
    ).run(...values);
    id = existing.id;
  } else {
    const info = db
      .prepare(
        `INSERT INTO contact_blocks
           (ip_prefix, country, user_agent, reason, attempts, first_seen, last_seen,
            blocked, blocked_until, last_notified_at, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...values);
    id = Number(info.lastInsertRowid);
  }

  const block = db
    .prepare('SELECT * FROM contact_blocks WHERE id = ?')
    .get(id) as ContactBlockRow;
  return { block, attempts, blocked, newlyBlocked, shouldNotify };
}

/** Listet beobachtete und gesperrte Absender für den Admin. */
export function listContactBlocks(limit = 50): ContactBlockRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM contact_blocks
        ORDER BY blocked DESC, last_seen DESC, id DESC
        LIMIT ?`,
    )
    .all(limit) as ContactBlockRow[];
}

/** Hebt eine Sperre auf und setzt den Versuchszähler zurück. */
export function unblockContactBlock(id: number): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE contact_blocks
            SET blocked = 0, blocked_until = NULL, attempts = 0, reason = ''
          WHERE id = ?`,
      )
      .run(id).changes > 0
  );
}

/** Entfernt alte Beobachtungen und abgelaufene Sperren (Datenschutz). */
export function pruneContactBlocks(days = 30): number {
  return getDb()
    .prepare(
      `DELETE FROM contact_blocks
        WHERE (blocked = 0 AND last_seen < datetime('now', ?))
           OR (blocked = 1 AND blocked_until IS NOT NULL AND blocked_until < datetime('now', ?))`,
    )
    .run(`-${days} days`, `-${days} days`).changes;
}
