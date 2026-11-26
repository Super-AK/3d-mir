import { getLogger } from './logger.js';
import { getTurnstileSettings } from './turnstile-settings.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Ohne konfigurierte Keys bleibt der Schutz im Dev/Test deaktiviert. */
export function turnstileConfigured(): boolean {
  const settings = getTurnstileSettings();
  return Boolean(settings.siteKey && settings.secret);
}

/**
 * Prüft das cf-turnstile-response-Token serverseitig.
 * Das Token wird nie geloggt; bei Netzwerkfehlern wird fail-closed entschieden.
 */
export async function verifyTurnstileToken(token: unknown): Promise<boolean> {
  const settings = getTurnstileSettings();
  if (!turnstileConfigured()) return true;
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret: settings.secret, response: token });
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      getLogger().warn({ status: response.status }, 'Turnstile-Prüfung fehlgeschlagen');
      return false;
    }
    const result = (await response.json()) as { success?: boolean };
    if (!result.success) {
      getLogger().warn({}, 'Turnstile-Token abgelehnt');
      return false;
    }
    return true;
  } catch (error) {
    getLogger().warn(
      { error: error instanceof Error ? error.message : 'unbekannter Fehler' },
      'Turnstile-Verifizierung nicht erreichbar',
    );
    return false;
  }
}

/** Liest das Token aus einem Formular-Body. */
export function turnstileToken(body: unknown): unknown {
  return body && typeof body === 'object' ? (body as Record<string, unknown>)['cf-turnstile-response'] : undefined;
}
