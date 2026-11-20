import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Veröffentlichungsstatus für Shop, Preise, Versand und Rechtstexte.
 *
 * Die Standardwerte stammen aus den Konfigurationsdateien. Im Admin kann der
 * Betreiber die Hinweise nach fachlicher Prüfung ausblenden; die Änderungen
 * werden in der Tabelle `settings` gespeichert und überlagern die Dateien.
 */
export type PublicationStatus = 'PLATZHALTER' | 'AKTIV' | 'FINAL';

export type PublicationSettings = {
  /** Shop-Hinweis „befindet sich im Aufbau“. */
  shopStatus: PublicationStatus;
  /** Preis-/Kalkulations-Platzhalter (Admin-Hinweis). */
  pricingStatus: PublicationStatus;
  /** Versandkosten/Lieferzeiten auf /versand/. */
  shippingStatus: PublicationStatus;
  /** Entwurfshinweis auf den Rechtsseiten. */
  showLegalDraftNotice: boolean;
};

const SETTINGS_KEY = 'publication.settings';

export function defaultPublicationSettings(): PublicationSettings {
  return {
    shopStatus: config.shop.status === 'AKTIV' ? 'AKTIV' : 'PLATZHALTER',
    pricingStatus: config.pricing.meta.status === 'FINAL' ? 'FINAL' : 'PLATZHALTER',
    shippingStatus: config.pricing.shipping.status === 'FINAL' ? 'FINAL' : 'PLATZHALTER',
    showLegalDraftNotice: config.site.legal.showDraftNotice !== false,
  };
}

function status(value: unknown, fallback: PublicationStatus): PublicationStatus {
  return value === 'AKTIV' || value === 'FINAL' || value === 'PLATZHALTER' ? value : fallback;
}

/** Liest den aktuellen Veröffentlichungsstatus inklusive Admin-Overrides. */
export function getPublicationSettings(): PublicationSettings {
  const fallback = defaultPublicationSettings();
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return fallback;

  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(row.value);
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {
    return fallback;
  }

  return {
    shopStatus: status(parsed.shopStatus, fallback.shopStatus),
    pricingStatus: status(parsed.pricingStatus, fallback.pricingStatus),
    shippingStatus: status(parsed.shippingStatus, fallback.shippingStatus),
    showLegalDraftNotice:
      typeof parsed.showLegalDraftNotice === 'boolean'
        ? parsed.showLegalDraftNotice
        : fallback.showLegalDraftNotice,
  };
}

/** Speichert den Veröffentlichungsstatus. */
export function savePublicationSettings(settings: PublicationSettings): void {
  const value = JSON.stringify({
    shopStatus: status(settings.shopStatus, 'PLATZHALTER'),
    pricingStatus: status(settings.pricingStatus, 'PLATZHALTER'),
    shippingStatus: status(settings.shippingStatus, 'PLATZHALTER'),
    showLegalDraftNotice: Boolean(settings.showLegalDraftNotice),
  });
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, value);
}

/** Ein Eintrag in der Livegang-Checkliste unter „Veröffentlichung“. */
export type PublicationChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

const CHECKLIST_KEY = 'publication.checklist';
const CHECKLIST_LIMIT = 100;
const CHECKLIST_ID = /^[a-zA-Z0-9_-]{1,80}$/;

/** Vorschläge, die nur erscheinen, solange noch keine eigene Liste gespeichert wurde. */
export const defaultPublicationChecklist: PublicationChecklistItem[] = [
  {
    id: 'todo-stripe-live',
    text: 'Stripe live schalten: Live-Key, Webhook-Secret, PAYMENT_BASE_URL und Live-Testbestellung',
    done: false,
    createdAt: '',
  },
  { id: 'todo-shop-live', text: 'Shop nach Freigabe im Admin auf „live“ schalten', done: false, createdAt: '' },
  {
    id: 'todo-backup',
    text: 'Externes Backup-Ziel festlegen und täglichen Backup-Timer prüfen',
    done: false,
    createdAt: '',
  },
  {
    id: 'todo-recht-spam',
    text: 'Rechtliche Bestätigung der pseudonymen Spam-Abwehr einholen',
    done: false,
    createdAt: '',
  },
  {
    id: 'todo-recht-stats',
    text: 'Rechtliche Bestätigung der cookie-freien Besucherstatistik einholen',
    done: false,
    createdAt: '',
  },
  { id: 'todo-consent', text: 'Einschätzung zum Consent-Banner rechtlich bestätigen', done: false, createdAt: '' },
  { id: 'todo-abnahme', text: 'Abnahme-Protokoll unterschreiben', done: false, createdAt: '' },
  {
    id: 'todo-testbestellung',
    text: 'Nach der Auslieferung eine Testbestellung prüfen',
    done: false,
    createdAt: '',
  },
];

function copyDefaults(): PublicationChecklistItem[] {
  return defaultPublicationChecklist.map((item) => ({ ...item }));
}

/** Liest die Checkliste inklusive der Vorschläge für eine noch unberührte Installation. */
export function getPublicationChecklist(): PublicationChecklistItem[] {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(CHECKLIST_KEY) as
    | { value: string }
    | undefined;
  if (!row) return copyDefaults();

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return copyDefaults();
  }
  if (!Array.isArray(parsed)) return copyDefaults();

  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .filter((item) => typeof item.id === 'string' && CHECKLIST_ID.test(item.id) && typeof item.text === 'string')
    .slice(0, CHECKLIST_LIMIT)
    .map((item) => ({
      id: item.id as string,
      text: (item.text as string).slice(0, 200),
      done: item.done === true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    }));
}

/** Speichert die Checkliste; eine leere Liste bleibt auch nach dem Speichern leer. */
export function savePublicationChecklist(items: PublicationChecklistItem[]): void {
  const value = JSON.stringify(
    items.slice(0, CHECKLIST_LIMIT).map((item) => ({
      id: CHECKLIST_ID.test(item.id) ? item.id : crypto.randomUUID(),
      text: String(item.text ?? '').slice(0, 200),
      done: Boolean(item.done),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    })),
  );
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(CHECKLIST_KEY, value);
}
