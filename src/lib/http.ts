import type { FastifyRequest } from 'fastify';

/**
 * Einfacher CSRF-Schutz für Formulare: Origin/Referer muss zum Host passen.
 * Zusätzlich schützt ein Honeypot-Feld und das Rate-Limit vor Spam.
 */
export function isSameOrigin(request: FastifyRequest): boolean {
  const host = (request.headers['x-forwarded-host'] as string | undefined) ?? request.headers.host;
  if (!host) return false;

  const origin = request.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.referer;
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Manche Datenschutz-Einstellungen senden weder Origin noch Referer.
  // Dann greifen Rate-Limit und Honeypot.
  return true;
}

/** Entfernt Steuerzeichen und begrenzt die Länge einer Eingabe. */
export function cleanText(value: unknown, maxLength = 5000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** Maskiert HTML für E-Mail-Templates. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Erzeugt eine kurze, zufällige Referenz (z. B. ANF-8F3K2). */
export function createReference(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${code}`;
}
