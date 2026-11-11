# Phasenplan und Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Analyse, Systemprüfung, Projektgerüst, NGINX, systemd, Git | ✅ abgeschlossen |
| 2 | Design-System, statische Seiten, Rechtsseiten, Kontakt | ✅ abgeschlossen |
| 3 | Rechner: Upload, 3D-Vorschau, Preis, Angebotsanfrage | ⬜ offen |
| 4 | Shop: Produkte, Warenkorb, Checkout, E-Mails | ⬜ offen |
| 5 | Admin: Login, Produkte, Bestellungen, Anfragen, Preise | ⬜ offen |
| 6 | Konto (optional), SEO, Redirects, Performance, Security | ⬜ offen |
| 7 | Deployment-Paket und Test auf frischer VM | ⬜ offen |
| 8 | Abnahme und Abschlussbericht | ⬜ offen |

## Phase 1 – Bericht

**Fertig**
- Alte Seite vollständig ausgelesen (13 URLs), Rechts- und Produkttexte gesichert (`docs/alt-inhalte/`).
- 21 Bilder heruntergeladen, EXIF/GPS beim Bild-Build entfernt, AVIF/WebP/JPG-Varianten erzeugt.
- Projektgerüst: Fastify 5 + TypeScript, Nunjucks, Vite, SQLite mit Migrationen, systemd, NGINX.
- Startseite (Grundgerüst), Health-Endpunkt `/api/health`, 404-/Fehlerseiten, Security-Header.
- NGINX-Vhost `3d-mir.de` (Port 80) mit Reverse Proxy, gzip, Cache-Headern; UFW nur 22/80/443.
- Benutzer `mir3d`, Datenverzeichnisse `/var/lib/3d-mir` und `/var/log/3d-mir`, `.env` unter `/etc/3d-mir` (chmod 600).
- Dokumentation: README, ANALYSE, OFFENE-FRAGEN, REDIRECTS.

**Getestet**
- `npm run typecheck`, `npm run build` fehlerfrei.
- `curl /` → 200, `/api/health` → 200 mit DB-Status, unbekannte URL → 404.
- `nginx -t` erfolgreich, Dienst `3d-mir.service` aktiv, Port 3000 nur auf 127.0.0.1.

**Offen**
- Beantwortung der Fragen in `docs/OFFENE-FRAGEN.md` (Preise, Zahlung, Versand, SMTP, GitHub, DNS).
- Inhalte/Design der Phase 2.

## Phase 2 – Bericht

**Fertig**
- Design-System in eigenem CSS (rund 1.000 Zeilen): Typografie, Farben, Buttons, Karten, Formulare, Tabellen, Galerie, CTA, Druckansicht; keine externen Frameworks, Fonts oder CDNs.
- Startseite ausgebaut: Hero, Vertrauensleiste, Leistungen, Ablauf, Materialauswahl, Galerie, FAQ, Kontakt-CTA; `LocalBusiness`-JSON-LD.
- Neue Seiten: `/leistungen/` (Materialvergleich, Drucker, Vorbereitung), `/kontakt/` mit Formular, `/kontakt/danke/`.
- Rechtsseiten aus den gesicherten Altinhalten: Impressum, AGB, Widerruf, Versand, Zahlung, Datenschutz, Cookie-Hinweis – jeweils mit Prüfhinweis (`site.legal.showDraftNotice`).
- Kontaktformular: Zod-Validierung, Honeypot, Origin-Prüfung, Rate-Limit (5 Anfragen/Stunde/IP), Speicherung in `contact_messages` (neue Spalte `phone` via Migration `002`), E-Mail an den Betreiber mit Reply-To.
- Ohne SMTP-Konfiguration werden Mails als `.eml` unter `/var/log/3d-mir/mail/` abgelegt.
- 301-Weiterleitungen der alten Slugs (u. a. `/versandarten/`, `/bezahlmoeglichkeiten/`, `/widerrufsbelehrung/`, `/wp-login.php`, `/produkt/*`) zusätzlich in der App – unabhängig von der NGINX-Konfiguration.
- Build-Skript korrigiert: Migrationen werden als Verzeichnisinhalt kopiert (vorher entstand `dist/db/migrations/migrations/`).

**Getestet**
- `npm run typecheck` und `npm run build` fehlerfrei.
- Alle neuen Seiten liefern 200; alte Slugs liefern 301 mit korrektem Ziel.
- Kontaktformular: gültige Anfrage → 303 auf `/kontakt/danke/` und Datensatz in der DB; ungültige Eingabe → 400 mit Fehlermeldung; Honeypot → 303 ohne Speicherung; 6. Anfrage → 429.
- E-Mail-Fallback erzeugt eine `.eml`-Datei; Sicherheits-Header sind auf HTML-Antworten gesetzt.

**Offen**
- Rechtliche Prüfung der übernommenen Texte (TODO-Recht).
- Preise, Zahlungsarten und Versandangaben sind weiterhin Platzhalter (F1–F20).
- SMTP-Zugangsdaten, DNS/TLS und Repository-Zugang fehlen (F21–F33).
