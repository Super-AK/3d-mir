# 3D-MIR – Webseite und 3D-Druck-Rechner

Neue Webseite für **3D-MIR, 3D-Druck Service** (Schömberg): Leistungsseite, Sofort-Preisrechner mit 3D-Vorschau, kleiner Shop und Admin-Bereich.

> **Status:** Aufbau (Phasen 1–7 abgeschlossen: Grundgerüst, statische Seiten, Rechner, Shop, Admin, SEO/Performance, Deployment). Rechtstexte und Preise sind Platzhalter bzw. Entwürfe – siehe `docs/OFFENE-FRAGEN.md`.

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
| Tests | Vitest (Unit), Playwright (E2E) |

**Grundsätze:** keine externen CDNs, keine Google Fonts, kein Tracking, keine Social-Media-Einbettungen. Schriften und Skripte werden lokal ausgeliefert. Es werden nur technisch notwendige Cookies gesetzt (Session/Warenkorb).

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
sudo deploy/install.sh        # geführte Installation (whiptail)
sudo deploy/update.sh         # Update mit Rollback
sudo deploy/backup.sh         # Backup von DB und Uploads
```

Details: `docs/DEPLOYMENT.md`.

## Dokumentation

- `docs/ANALYSE.md` – Ist-Zustand der alten WordPress-Seite
- `docs/OFFENE-FRAGEN.md` – gesammelte Fragen an den Auftraggeber
- `docs/KALKULATION.md` – Preisformel und Platzhalter des Rechners
- `docs/REDIRECTS.md` – 301-Weiterleitungen der alten URLs
- `docs/DEPLOYMENT.md` – Installation, Update, Backup, Umzug
- `docs/ABNAHME.md` – Abnahmeprotokoll

## Rechtlicher Hinweis

Die mitgelieferten Rechtstexte (Impressum, AGB, Widerruf, Datenschutz) sind **technische Entwürfe** und müssen vor Veröffentlichung durch den Betreiber bzw. eine Rechtsberatung geprüft werden. Preise, Versandkosten und Zahlungsarten sind Platzhalter, bis der Auftraggeber sie bestätigt.
