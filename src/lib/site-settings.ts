import { config, type SiteConfig } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Im Admin pflegbare Stammdaten.
 *
 * Die Standardwerte stehen in `config/site.json`. Änderungen werden in der
 * Tabelle `settings` (`site.settings`) gespeichert und beim Start sowie nach
 * jedem Speichern in `config.site` übernommen. Dadurch sehen alle Templates,
 * JSON-LD-Ausgaben und E-Mails sofort die aktuellen Werte.
 */
type SiteOverrides = {
  business?: Partial<SiteConfig['business']>;
  channels?: {
    etsy?: Partial<SiteConfig['channels']['etsy']>;
    classifieds?: Partial<SiteConfig['channels']['classifieds']>;
  };
  contact?: Partial<SiteConfig['contact']>;
  seo?: Partial<SiteConfig['seo']>;
  images?: Partial<SiteConfig['images']>;
};

const SETTINGS_KEY = 'site.settings';
const defaults = structuredClone(config.site);

function readOverrides(): SiteOverrides {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return {};
  try {
    const parsed: unknown = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? (parsed as SiteOverrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: SiteOverrides): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, JSON.stringify(overrides));
}

/** Übernimmt die gespeicherten Werte in `config.site` (in-place). */
export function applySiteSettings(): void {
  const overrides = readOverrides();
  const merged = structuredClone(defaults);

  if (overrides.business) merged.business = { ...merged.business, ...overrides.business };
  if (overrides.channels?.etsy) {
    merged.channels.etsy = { ...merged.channels.etsy, ...overrides.channels.etsy };
  }
  if (overrides.channels?.classifieds) {
    merged.channels.classifieds = { ...merged.channels.classifieds, ...overrides.channels.classifieds };
  }
  if (overrides.contact) merged.contact = { ...merged.contact, ...overrides.contact };
  if (overrides.seo) merged.seo = { ...merged.seo, ...overrides.seo };
  if (overrides.images) {
    merged.images = {
      logo: overrides.images.logo ?? merged.images.logo,
      hero: overrides.images.hero ?? merged.images.hero,
      service: overrides.images.service ?? merged.images.service,
      gallery: Object.prototype.hasOwnProperty.call(overrides.images, 'gallery')
        ? Array.isArray(overrides.images.gallery)
          ? overrides.images.gallery
          : null
        : merged.images.gallery,
    };
  }

  config.site.business = merged.business;
  config.site.channels = merged.channels;
  config.site.contact = merged.contact;
  config.site.seo = merged.seo;
  config.site.images = merged.images;
}

export function getSiteSettings(): SiteConfig {
  return config.site;
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeUrl(value: unknown, fallback = ''): string {
  const url = clean(value, 500);
  if (!url) return fallback;
  return /^https?:\/\//i.test(url) ? url : fallback;
}

/** Speichert Geschäftsdaten, Kanäle, Kontakt- und SEO-Angaben. */
export function saveSiteSettings(input: {
  business: Record<string, unknown>;
  channels: Record<string, unknown>;
  contact: Record<string, unknown>;
  seo: Record<string, unknown>;
}): void {
  const current = readOverrides();
  const business = input.business;
  const channels = input.channels;
  const contact = input.contact;
  const seo = input.seo;

  const phone = clean(business.phone, 60);
  const derivedHref = phone.replace(/[^\d+]/g, '');
  const rawHref = clean(business.phoneHref, 60);
  // Leer oder noch der alte automatische Wert: aus der neuen Nummer ableiten.
  const phoneHref =
    !rawHref || rawHref === config.site.business.phoneHref ? derivedHref : rawHref;
  const countryCode = (clean(business.countryCode, 2) || defaults.business.countryCode).toUpperCase();

  const overrides: SiteOverrides = {
    ...current,
    business: {
      name: clean(business.name, 80) || defaults.business.name,
      legalName: clean(business.legalName, 160) || defaults.business.legalName,
      owner: clean(business.owner, 120),
      street: clean(business.street, 120),
      zip: clean(business.zip, 20),
      city: clean(business.city, 120),
      country: clean(business.country, 120) || defaults.business.country,
      countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : defaults.business.countryCode,
      phone,
      phoneHref,
      email: clean(business.email, 200) || defaults.business.email,
      vatNote: clean(business.vatNote, 300),
      smallBusiness: business.smallBusiness === '1' || business.smallBusiness === 'on',
    },
    channels: {
      etsy: {
        label: clean(channels.etsyLabel, 80) || defaults.channels.etsy.label,
        url: safeUrl(channels.etsyUrl, defaults.channels.etsy.url),
        reviewsUrl: safeUrl(channels.etsyReviewsUrl),
      },
      classifieds: {
        label: clean(channels.classifiedsLabel, 80) || defaults.channels.classifieds.label,
        url: safeUrl(channels.classifiedsUrl, defaults.channels.classifieds.url),
      },
    },
    contact: {
      responseTime: clean(contact.responseTime, 200) || defaults.contact.responseTime,
      appointmentNote: clean(contact.appointmentNote, 200) || defaults.contact.appointmentNote,
    },
    seo: {
      siteName: clean(seo.siteName, 120) || defaults.seo.siteName,
      defaultTitle: clean(seo.defaultTitle, 200) || defaults.seo.defaultTitle,
      defaultDescription: clean(seo.defaultDescription, 400) || defaults.seo.defaultDescription,
    },
  };

  writeOverrides(overrides);
  applySiteSettings();
}

/** Speichert die im Admin hinterlegten Bilder. */
export function saveSiteImages(images: SiteConfig['images']): void {
  const current = readOverrides();
  writeOverrides({
    ...current,
    images: {
      logo: clean(images.logo, 300),
      hero: clean(images.hero, 300),
      service: clean(images.service, 300),
      gallery: images.gallery === null
        ? null
        : images.gallery.map((entry) => clean(entry, 300)).filter(Boolean).slice(0, 8),
    },
  });
  applySiteSettings();
}

/** Setzt alle Stammdaten auf die Werte aus `config/site.json` zurück. */
export function resetSiteSettings(): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(SETTINGS_KEY);
  applySiteSettings();
}
