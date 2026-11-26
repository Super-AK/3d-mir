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
| `TURNSTILE_SITE_KEY` | öffentlich, optionaler Fallback | Wird in alle Formular-Templates gerendert. |
| `TURNSTILE_SECRET_KEY` | **geheim**, optionaler Fallback, nur serverseitig | Serverseitige Verifizierung. |

Beide leer = Schutz deaktiviert. **Komfortabler:** Die Keys können jetzt unter
**Admin → Bot-Schutz** im Formular „Turnstile-Keys" eingetragen werden. Diese
Werte haben Vorrang vor den Env-Variablen, wirken sofort ohne Neustart und
werden in der `settings`-Tabelle gespeichert. Das Secret wird nie angezeigt
(nur als gekürzter Hinweis im Platzhalter). „Auf Umgebungsvariablen
zurücksetzen" entfernt den Admin-Override wieder.

## Admin-Ansicht

Unter **Admin → Bot-Schutz** sind Status (Keys gesetzt/fehlen, Site-Key-Präfix),
die aktiven Rate-Limits und die letzten 100 Bot-Ereignisse (Zeit, Formular,
Grund, gekürztes IP-Präfix, Details) sichtbar. Das Protokoll kann dort geleert
werden. Vollständige IPs, E-Mail-Adressen und Tokens werden nicht gespeichert.
