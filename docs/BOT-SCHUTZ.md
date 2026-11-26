# Bot-Schutz für Formulare

**Stand:** 26. November 2026

## Umsetzung im vorhandenen Stack

Die Anweisung nennt React/Next.js und `@marsidev/react-turnstile`.Dieses
Projekt nutzt jedoch **Fastify 5, TypeScript, Nunjucks und Vanilla-TS/Vite**.
Deshalb wurde der Schutz stackkonform umgesetzt:

- Client: offizielles Turnstile-Skript
  `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`,
  geladen durch `web/ts/turnstile.ts`. Das Widget ist unsichtbar
  (`size: invisible`, `appearance: interaction-only`), der Submit-Button wird
  erst nach Token-Erhalt aktiv und bei Ablauf/Fehler per `reset()` zurückgesetzt.
- Server: `src/lib/turnstile.ts` prüft `cf-turnstile-response` per POST gegen
  **`https://challenges.cloudflare.com/turnstile/v0/siteverify`**. Die in der
  Anweisung genannte URL `https://cloudflare.com` ist keine Verifizierungs-URL.
- Ohne konfigurierte Keys ist die Prüfung deaktiviert (Dev/Test unverändert).

## Betroffene Formulare

Kontakt, 3D-Druck-Rechner/Angebotsanfrage, Newsletter, Registrierung,
Anmelden, Passwort vergessen/neu setzen, Kundenstammdaten, Adresse hinzufügen,
Konto anonymisieren, Warenkorb (Hinzufügen/Ändern/Entfernen), Kasse und
Zahlungsseite. Admin-Formulare sind weiterhin durch Session + CSRF geschützt.

## Silent Fail

Bei Turnstile-Ablehnung oder Honeypot gibt das Kontaktformular die reguläre
Danke-Seite zurück; Angebotsanfrage und Newsletter liefern ebenfalls eine
normale Erfolgsmeldung. Es gibt dadurch kein Feedback für Bots. Die Ablehnung
wird serverseitig ohne personenbezogene Daten geloggt.

## Rate Limiting

Bereits vorhanden: `@fastify/rate-limit` (global `false`, pro Route), IP-basiert
über `request.ip` mit `TRUST_PROXY`. Kontakt und Angebotsanfrage: **3 Anfragen
pro Stunde pro IP** (vorher 5). Weitere Formulare behalten ihre bestehenden
Grenzen (z. B. 5/15 min). Eine zusätzliche Bibliothek wie `@upstash/ratelimit`
ist nicht nötig – der vorhandene, leichtgewichtige Limiter erfüllt die
Anforderung und funktioniert ohne externen Dienst.

## Neue Umgebungsvariablen

| Variable | Ort | Zweck |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | öffentlich, in `.env` / `/etc/3d-mir/3d-mir.env` | Wird in alle Formular-Templates gerendert. |
| `TURNSTILE_SECRET_KEY` | **geheim**, nur serverseitig, chmod 600 | Serverseitige Verifizierung. |

Beide leer = Schutz deaktiviert. Für Produktion beide setzen. Die CSP erlaubt
`challenges.cloudflare.com` jetzt in `script-src`, `connect-src` und `frame-src`.
