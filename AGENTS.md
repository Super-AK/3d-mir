# AGENTS.md

Kurzbriefing für KI-Agenten (OpenCode, Claude, Codex, Cursor …). Ziel: Änderungen
schnell und sicher umsetzen, ohne das Repository breit zu durchsuchen. **Diese
Datei zuerst lesen** – sie ersetzt die meisten Erkundungsläufe.

## Projekt

Webseite, 3D-Druck-Preisrechner, Shop und Admin-Bereich für **3D-MIR 3D-Druck
Service** (Schömberg).

| | |
| --- | --- |
| Stack | Node.js ≥ 22, TypeScript (strict, ESM), Fastify 5, SQLite (WAL, `better-sqlite3`), Nunjucks, Vite, three.js |
| Produktion | `/var/www/3d-mir.de`, Dienst `3d-mir.service`, Benutzer `mir3d`, Port 3000 hinter NGINX |
| Daten | DB `/var/lib/3d-mir/db/3d-mir.sqlite`, Uploads `/var/lib/3d-mir/uploads`, Logs `/var/log/3d-mir` |
| Geheimnisse | ausschließlich `/etc/3d-mir/3d-mir.env` (chmod 600) bzw. lokale `.env`; **nie im Repo** |
| Git | `origin` = `github.com:Super-AK/3d-mir`; Release-Tags `v1.0.0-rc.N` |

**Sprache:** UI-Texte, Mails, Doku und Kommentare auf **Deutsch**; Bezeichner
(Variablen, Funktionen, Dateien) auf **Englisch**.

## Befehle

```bash
npm ci                 # Abhängigkeiten
npm run dev            # http://127.0.0.1:3000 (tsx watch)
npm run typecheck      # tsc --noEmit
npm test               # Vitest, tests/unit
npm run test:e2e       # Playwright, braucht laufenden Server
npm run build          # Fonts + Backend (tsc) + Frontend (Vite)
npm run migrate        # SQL-Migrationen anwenden
npm run admin:create -- --email … --name …    # Admin anlegen/Passwort setzen
npm run uploads:cleanup -- --dry-run          # Löschfristen prüfen
npm run orders:cleanup                        # Bestell-Cleanup
```

`npm run build` erzeugt `dist/` und `public/assets/`. Beide sind **generiert**
und nicht im Git – nie direkt bearbeiten.

## Wo suchen

| Aufgabe | Dateien |
| --- | --- |
| Seiten, SEO, Favicon, Rechtsseiten | `src/routes/public.ts`, `src/templates/pages/**` |
| Rechner, Upload, Angebotsanfrage | `src/routes/calculator.ts`, `src/lib/mesh.ts`, `src/lib/pricing.ts`, `config/pricing.json` |
| Shop, Warenkorb, Checkout, Bestellungen | `src/routes/shop.ts`, `src/lib/shop.ts`, `src/lib/cart.ts`, `config/shop.json` |
| Zahlungen, Stripe-Webhook | `src/routes/payments.ts`, `src/lib/payments/*` |
| Shop-API v1 (Faktura-App) | `src/routes/api-v1.ts`, `src/lib/api-*.ts`, `openapi.yaml`, `VERTRAGS-ANMERKUNGEN.md` |
| Admin-Oberfläche und Aktionen | `src/routes/admin.ts`, `src/templates/admin/**`, `web/ts/admin*.ts` |
| Login, 2FA, Passkeys, CSRF | `src/lib/auth.ts`, `src/lib/totp.ts`, `src/lib/passkeys.ts` |
| Mails und Layout | `src/lib/mailer.ts`, `src/lib/mail-layout.ts`, `src/lib/contact-mail.ts`, `src/lib/notifications.ts`, `src/lib/telegram.ts` |
| Einstellungen (JSON in SQLite) | `src/lib/*-settings.ts`, Tabelle `settings` |
| Datenbank | `src/db/migrations/*.sql`, `src/db/index.ts`, `src/db/migrate.ts` |
| Styles/Frontend | `web/css/*.css`, `web/ts/*.ts` |
| Bilder und Varianten | `scripts/prepare-images.mjs`, `src/lib/render.ts` (`image()`), `src/lib/product-images.ts` |
| Deployment | `deploy/*.sh`, `deploy/*.tpl`, `docs/DEPLOYMENT.md` |
| Offene Punkte | `docs/OFFENE-FRAGEN.md` (F-Nummern) |

## Architektur

- **Start:** `src/server.ts` → `src/app.ts`. Dort werden Plugins, Security-Header,
  statische Assets, Fehlerbehandlung und die Migrationen registriert.
- **Routing:** je Bereich eine Datei in `src/routes/`; Templates liegen unter
  `src/templates/pages/` (öffentlich) bzw. `src/templates/admin/`.
- **Rendering:** `render(reply, template, context)` in `src/lib/render.ts` injiziert
  u. a. Preise, Zahlungsarten, Veröffentlichungsstatus, Warenkorb und Favicon-Version.
- **Konfiguration:** `src/config.ts` validiert Umgebungsvariablen mit Zod und liest
  `config/site.json`, `config/pricing.json`, `config/shop.json`. Neue Variablen
  immer dort **und** in `.env.example` ergänzen.
- **Datenbank:** synchrones `better-sqlite3` über `getDb()`. Migrationen laufen in
  Dateinamen-Reihenfolge und werden beim Start automatisch angewendet.
- **Einstellungen:** werden als JSON-Strings in der Tabelle `settings` gespeichert
  (z. B. `publication.settings`, `contact.settings`). Immer über die Helfer in
  `src/lib/*-settings.ts` lesen/schreiben, nicht roh in Templates.
- **Admin-Formulare:** alle Admin-POSTs nach dem Login brauchen `_csrf`
  (Hidden-Feld, Prüfung mit `verifyCsrfToken`). Login, Logout und Passkey-POSTs
  prüfen stattdessen die Origin (`isSameOrigin`); das Kontaktformular nutzt
  zusätzlich Honeypot und Rate-Limit.
- **Uploads:** nur `uploads/media` ist öffentlich; Modelldateien bleiben privat.

## Unverhandelbare Regeln

1. **Keine externen CDNs, Fonts, Tracker oder Social-Einbettungen.** Alles lokal
   ausliefern; die CSP in `src/app.ts` erlaubt nur `'self'`.
2. **Keine Geheimnisse** in Code, `config/*.json`, Doku oder Commits. Stripe-, SMTP-
   und Telegram-Zugänge nur über Umgebungsvariablen.
3. **Keine erfundenen Geschäftsdaten, Preise oder Rechtstexte.** Unbekanntes bleibt
   Platzhalter (`placeholder()`), offene Punkte kommen mit F-Nummer in
   `docs/OFFENE-FRAGEN.md`.
4. **Angewendete Migrationen nie ändern.** Neue Migration als
   `src/db/migrations/NNN_name.sql` anlegen.
5. **Generierte Dateien nicht bearbeiten:** `dist/`, `public/`,
   `web/static/img/gen/`, `node_modules/`, `test-results/`.
6. **Keine neuen Laufzeit-Abhängigkeiten ohne klaren Grund.** Wenn nötig, lokal
   bündeln und in `package.json` dokumentieren.
7. **Bestehende Benutzeränderungen nicht überschreiben.** Vor dem Löschen oder
   Ersetzen unbekannter Dateien prüfen, ob sie zum Auftrag gehören.

## Code-Stil

- Kein Linter/Formatter konfiguriert: am umgebenden Stil orientieren (2 Leerzeichen,
  einfache Anführungszeichen, Semikolons, trailing commas, ~100 Zeichen).
- ESM mit `NodeNext`: **Importe in TypeScript brauchen `.js`-Endung**
  (`import { config } from './config.js'`).
- `strict` + `noUncheckedIndexedAccess`: Array-Zugriffe liefern `T | undefined`.
- Kommentare erklären das **Warum**, nicht das Offensichtliche.
- Logik in `src/lib/` testbar halten; Routen bleiben dünn.
- Neue Unit-Tests unter `tests/unit/*.test.ts`; E2E nur für echte Nutzerflüsse.

## Arbeitsablauf (Definition of Done)

1. Ziel und betroffene Dateien über die Tabelle oben eingrenzen.
2. Änderung umsetzen, dabei Stil und bestehende Muster übernehmen.
3. `npm run typecheck` und `npm test` ausführen.
4. Bei UI-/Build-Änderungen zusätzlich `npm run build`.
5. Verhalten, Fristen oder öffentliche Texte geändert? Doku und ggf.
   `docs/OFFENE-FRAGEN.md` aktualisieren.
6. `git diff` prüfen: keine Geheimnisse, keine generierten Dateien, keine
   versehentlichen Löschungen.
7. Bei Deployment-Aufgaben: `deploy/verify.sh` bzw. `/api/health` prüfen.

## Release und Deployment

Release-Ablauf (bisherige Konvention):

1. `npm version 1.0.0-rc.N --no-git-tag-version`
2. Version in `README.md`, `docs/ABNAHME.md`, `docs/ABSCHLUSSBERICHT.md` angleichen.
3. `CHANGELOG.md` und `docs/PHASEN.md` ergänzen.
4. Commit auf Deutsch, Tag `v1.0.0-rc.N`, `git push origin HEAD` und Tag pushen.

Produktion (nur auf ausdrückliche Anweisung):

```bash
cd /var/www/3d-mir.de
sudo git fetch origin
sudo git merge --ff-only origin/main
sudo deploy/update.sh --no-pull
sudo deploy/verify.sh
curl -s https://www.3d-mir.de/api/health
```

`deploy/update.sh` legt die Timer `3d-mir-monitor.timer` und
`3d-mir-cleanup.timer` bei Bedarf an bzw. aktualisiert sie. Die öffentliche
Produktivdomain kann auf einem **anderen Server** als diesem Arbeitsrechner
laufen – vor dem Ausrollen die Version per Health-Endpunkt prüfen.

## Bekannte Stolperfallen

- **Favicon** wird als transparentes PNG aus der DB geliefert; `/favicon.ico`,
  `/favicon.png` und die Apple-Touch-Pfade zeigen dasselbe Bild. Alte
  Browser-Caches können trotzdem ein altes Icon halten.
- **Stripe-Webhook** benötigt den Rohbody; dieser wird in `src/app.ts` als
  `request.rawBody` erhalten. Nicht durch erneutes JSON-Parsen ersetzen.
- **Mail-Fallback:** Ohne SMTP werden Mails als `.eml` unter
  `/var/log/3d-mir/mail/` abgelegt – das ist kein Fehler.
- **Cleanup:** Modelldateien nach 90 Tagen, Angebotsanfragen und
  Kontaktnachrichten nach 24 Monaten. Bestelldaten bleiben unberührt.
- **E2E-Admin-Tests** brauchen `E2E_ADMIN_EMAIL` und `E2E_ADMIN_PASSWORD`.
- **`deploy/verify.sh`** meldet ggf. „kein Let's-Encrypt-Zertifikat“, obwohl
  öffentlich HTTPS funktioniert – die Host-/Pfadprüfung ist strenger als der
  Live-Betrieb.
- **`src/routes/admin.ts` und `src/routes/shop.ts` sind groß.** Gezielt mit
  `rg`/`grep` suchen, nicht vollständig ausgeben.
- **Port belegt:** Der Server versucht den Start mehrfach; Ursache mit
  `ss -ltnp '( sport = :3000 )'` prüfen.

## Kontext sparen (wichtig für das Nutzungslimit)

- Zuerst diese Datei und die Tabelle „Wo suchen“ nutzen; dann nur die wirklich
  betroffenen Dateien öffnen.
- `rg`/`grep` und `sed -n 'A,Bp'` statt `cat` über große Dateien.
- **Nicht** durchsuchen: `node_modules/`, `dist/`, `public/`, `test-results/`,
  `playwright-report/`, `package-lock.json`, `web/static/img/gen/`.
- Doku nur bei Bedarf öffnen; nicht alle Dateien in `docs/` lesen.
- Antworten knapp halten, Code nicht unnötig wiederholen.
- Gezielte Edits statt kompletter Neuschreibungen.
- Während der Iteration reicht `npm run typecheck`; den vollen Build erst vor
  dem Abschluss.

## Aktueller Stand

**Stand: 26.11.2026** – bei jedem Release aktualisieren. Maßgeblich sind
`package.json` (Version) und `docs/OFFENE-FRAGEN.md` (F-Nummern).

- Version: `1.0.0-rc.81`
- Offen vor dem Livegang: Stripe-Live-Schaltung (Live-Key, Live-Webhook,
  Live-Test), externes Backup-Ziel, Freigabe des Shops im Admin.
- Der Shop zeigt öffentlich noch „Der Shop befindet sich im Aufbau“.
