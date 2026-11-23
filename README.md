# 3D-MIR – Webseite und 3D-Druck-Rechner

Neue Webseite für **3D-MIR, 3D-Druck Service** (Schömberg): Leistungsseite, Sofort-Preisrechner mit 3D-Vorschau, kleiner Shop und Admin-Bereich.

> **Version:** 1.0.0-rc.58 · **Status:** Release-Kandidat; alle geplanten Funktionen umgesetzt, Abnahme und Livegang offen. Preise, Kalkulation und Versand sind bestätigt; Rechtstexte sind anwaltlich geprüft. Offen sind Stripe-Live, externes Backup-Ziel und der Shop-Livegang – siehe `docs/OFFENE-FRAGEN.md`.

Änderungen und Versionshistorie: [`CHANGELOG.md`](CHANGELOG.md).

## Technik

| Bereich | Umsetzung |
| --- | --- |
| Webserver | NGINX 1.28 (Reverse Proxy, statische Assets, gzip, HTTP/2 in Produktion) |
| Backend | Node.js 22 LTS, Fastify 5, TypeScript |
| Datenbank | SQLite (WAL) über `better-sqlite3`, versionierte SQL-Migrationen |
| Templates | Nunjucks (serverseitiges Rendering), Progressive Enhancement |
| Frontend | Vanilla TypeScript + eigenes CSS, gebündelt mit Vite |
| 3D-Vorschau | three.js (lokal gebündelt, kein CDN) |
| Prozess | systemd-Dienst `3d-mir.service`, Benutzer `mir3d` |
| Benachrichtigungen | E-Mail (SMTP) und Telegram, Kanal im Admin wählbar |
| Tests | Vitest (Unit), Playwright (E2E) |

**Grundsätze:** keine externen CDNs, keine Google Fonts, keine externen Tracker und keine Social-Media-Einbettungen. Schriften und Skripte werden lokal ausgeliefert. Es werden nur technisch notwendige Cookies gesetzt (Session/Warenkorb). Die Reichweitenmessung läuft serverseitig ohne Cookies und ohne Speicherung vollständiger IP-Adressen.

## Verzeichnisse

```
/var/www/3d-mir.de/          Git-Arbeitsverzeichnis (Code)
├── src/                     Backend, Templates, Migrationen
├── web/                     Frontend-Quellen (CSS, TS, Bilder, Schriften)
├── public/                  Build-Ausgabe (von NGINX ausgeliefert, nicht im Git)
├── config/                  site.json, pricing.json, shop.json (keine Geheimnisse)
├── deploy/                  Installer, Update, Backup, Nginx-Vorlage, systemd-Unit
├── docs/                    Dokumentation, offene Fragen, Redirects
└── tests/                   Unit- und E2E-Tests

/var/lib/3d-mir/             Datenbank, Uploads (außerhalb des Webroots)
/var/log/3d-mir/             Anwendungs- und Installationslogs
/etc/3d-mir/3d-mir.env       Umgebungsvariablen inkl. Geheimnisse (chmod 600)
```

## Lokale Entwicklung

Voraussetzungen: Node.js ≥ 22, npm, SQLite (nur CLI nötig), optional NGINX.

```bash
cp .env.example .env          # Werte anpassen, SESSION_SECRET setzen
npm ci
npm run build                 # Backend (tsc) + Frontend (Vite) + Schrift-Subset
npm run migrate               # Datenbank anlegen/aktualisieren
npm run dev                   # http://127.0.0.1:3000
```

Nützliche Befehle:

```bash
npm run typecheck             # TypeScript prüfen
npm test                      # Unit-Tests (Vitest)
npm run test:e2e              # E2E-Tests (Playwright, benötigt laufenden Server)
npm run build                 # Produktionsbuild
npm run admin:create -- --email admin@example.de --name "Betreiber"
                              # Admin-Zugang anlegen oder Passwort zurücksetzen
```

Der Admin-Bereich liegt unter `/admin/`. Das Passwort wird bei `admin:create` interaktiv abgefragt (mindestens 12 Zeichen) oder einmalig über `ADMIN_PASSWORD` übergeben; es wird nicht im Repository gespeichert. Für die optionalen Admin-E2E-Tests `E2E_ADMIN_EMAIL` und `E2E_ADMIN_PASSWORD` setzen.

Bilder werden mit `node scripts/prepare-images.mjs` aus `web/static/img/` erzeugt (AVIF/WebP/JPG, Favicons, OG-Bild). Das Skript entfernt dabei EXIF-/GPS-Daten.

## Produktion

```bash
sudo deploy/setup.sh          # interaktives Setup- und Verwaltungsmenü
sudo deploy/install.sh        # geführte Installation (whiptail)
sudo deploy/update.sh         # Update mit Rollback
sudo deploy/backup.sh         # Backup von DB und Uploads
```

**Neuinstallation auf einem frischen oder vorhandenen Server:** vollständige Schritt-für-Schritt-Anleitung in [`docs/INSTALLATION.md`](docs/INSTALLATION.md) – inklusive Node.js 22, DNS/TLS, bestehender NGINX-Sites, WordPress-Umzug, Stripe und Abnahme-Checkliste.

Betrieb, Update, Backup und Fehlersuche: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Dokumentation

- `CHANGELOG.md` – Versionshistorie und Release-Notizen
- `docs/ANALYSE.md` – Ist-Zustand der alten WordPress-Seite
- `docs/OFFENE-FRAGEN.md` – gesammelte Fragen an den Auftraggeber
- `docs/ADMIN.md` – Preise, Katalog, Produktbilder, Zahlungen, Nachrichten und Spam-Schutz im Admin-Bereich
- `docs/KALKULATION.md` – Preisformel und Platzhalter des Rechners
- `docs/REDIRECTS.md` – 301-Weiterleitungen der alten URLs
- `docs/INSTALLATION.md` – Installation auf neuem/vorhandenem Server, DNS/TLS, Abnahme
- `docs/DEPLOYMENT.md` – Betrieb, Update, Backup, Umzug
- `docs/ABNAHME.md` – Abnahmeprotokoll
- `docs/ABSCHLUSSBERICHT.md` – Zusammenfassung und Übergabe

## Rechtlicher Hinweis

Die mitgelieferten Rechtstexte (Impressum, AGB, Widerruf, Datenschutz) sind **technische Entwürfe** und müssen vor Veröffentlichung durch den Betreiber bzw. eine Rechtsberatung geprüft werden. Preise und Kalkulation sind bestätigt. Versandkosten und Zahlungsarten sind bis zur abschließenden Freigabe als Platzhalter gekennzeichnet.
