import nunjucks from 'nunjucks';
import { getDb } from '../db/index.js';

/**
 * Ausfüllbare Platzhalter in den Rechtstexten.
 *
 * Solange ein Wert leer ist, wird der TODO-Text gelb hervorgehoben. Sobald der
 * Betreiber im Admin einen Wert hinterlegt, erscheint dieser an derselben
 * Stelle. Die Werte liegen in der Tabelle `settings`
 * (`legal.placeholders`).
 */
export type PlaceholderDefinition = {
  key: string;
  label: string;
  hint: string;
  fallback: string;
  example: string;
};

export const placeholderDefinitions: PlaceholderDefinition[] = [
  {
    key: 'hosting',
    label: 'Hosting-Anbieter',
    hint: 'Name, Anschrift und Status des Auftragsverarbeitungsvertrags (AVV).',
    fallback: 'TODO-HOSTING: Anbieter, Anschrift und AVV ergänzen',
    example: 'Musterhosting GmbH, Musterstraße 1, 12345 Musterstadt (AVV liegt vor)',
  },
  {
    key: 'smtp',
    label: 'SMTP-/E-Mail-Dienstleister',
    hint: 'Name des Dienstleisters und Status des AVV.',
    fallback: 'TODO-SMTP: Anbieter und AVV ergänzen',
    example: 'Muster-Mail GmbH, Musterstadt (AVV liegt vor)',
  },
  {
    key: 'versand',
    label: 'Versanddienstleister',
    hint: 'Name, Anschrift und Status des AVV.',
    fallback: 'TODO-VERSAND: Anbieter, Anschrift und AVV ergänzen',
    example: 'DHL Paket GmbH, Bonn (AVV liegt vor)',
  },
  {
    key: 'aufbewahrung',
    label: 'Löschfrist Modell-Uploads',
    hint: 'Text, der im Satz „spätestens nach …“ eingesetzt wird.',
    fallback: '90 Tagen (TODO-AUFBEWAHRUNG)',
    example: '90 Tagen',
  },
];

const SETTINGS_KEY = 'legal.placeholders';

export type PlaceholderValues = Record<string, string>;

export function getPlaceholderValues(): PlaceholderValues {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return {};
  try {
    const parsed: unknown = JSON.parse(row.value);
    if (!parsed || typeof parsed !== 'object') return {};
    const values: PlaceholderValues = {};
    for (const definition of placeholderDefinitions) {
      const value = (parsed as Record<string, unknown>)[definition.key];
      if (typeof value === 'string' && value.trim()) {
        values[definition.key] = value.trim().slice(0, 500);
      }
    }
    return values;
  } catch {
    return {};
  }
}

export function savePlaceholderValues(values: Record<string, unknown>): void {
  const stored: PlaceholderValues = {};
  for (const definition of placeholderDefinitions) {
    const raw = values[definition.key];
    const value = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
    if (value) stored[definition.key] = value;
  }
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, JSON.stringify(stored));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Nunjucks-Global: liefert den Wert oder eine gelb markierte TODO-Stelle. */
export function placeholder(key: string, fallback: string): nunjucks.runtime.SafeString {
  const value = getPlaceholderValues()[key];
  if (value) return new nunjucks.runtime.SafeString(escapeHtml(value));
  return new nunjucks.runtime.SafeString(
    `<mark class="placeholder-todo" data-placeholder="${escapeHtml(key)}" title="Vor dem Livegang ergänzen">${escapeHtml(fallback)}</mark>`,
  );
}
