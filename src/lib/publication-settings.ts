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
