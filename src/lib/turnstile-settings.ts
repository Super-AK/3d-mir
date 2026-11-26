import { config } from '../config.js';
import { getDb } from '../db/index.js';

const SETTINGS_KEY = 'bot.turnstile';

export type TurnstileSettings = { siteKey: string; secret: string };

/** Env-Werte sind der Fallback; im Admin gespeicherte Werte haben Vorrang. */
export function getTurnstileSettings(): TurnstileSettings {
  const fallback: TurnstileSettings = {
    siteKey: config.turnstile.siteKey,
    secret: config.turnstile.secret,
  };
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    return {
      siteKey: typeof parsed.siteKey === 'string' ? parsed.siteKey.trim().slice(0, 200) : fallback.siteKey,
      secret: typeof parsed.secret === 'string' ? parsed.secret.trim().slice(0, 200) : fallback.secret,
    };
  } catch {
    return fallback;
  }
}

/** Leere Felder übernehmen den bisherigen Wert (Secret bleibt unsichtbar). */
export function saveTurnstileSettings(input: { siteKey?: string; secret?: string }): void {
  const current = getTurnstileSettings();
  const next: TurnstileSettings = {
    siteKey: input.siteKey?.trim() ? input.siteKey.trim().slice(0, 200) : current.siteKey,
    secret: input.secret?.trim() ? input.secret.trim().slice(0, 200) : current.secret,
  };
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, JSON.stringify(next));
}

/** Löscht den Admin-Override; danach gelten wieder die Env-Werte. */
export function resetTurnstileSettings(): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(SETTINGS_KEY);
}

export function maskedSecret(secret: string): string {
  if (!secret) return '';
  return `${secret.slice(0, 4)}… (${secret.length} Zeichen)`;
}
