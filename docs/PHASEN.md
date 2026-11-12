# Phasenplan und Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Analyse, Systemprüfung, Projektgerüst, NGINX, systemd, Git | ✅ abgeschlossen |
| 2 | Design-System, statische Seiten, Rechtsseiten, Kontakt | ✅ abgeschlossen |
| 3 | Rechner: Upload, 3D-Vorschau, Preis, Angebotsanfrage | ✅ abgeschlossen |
| 4 | Shop: Produkte, Warenkorb, Checkout, E-Mails | ✅ abgeschlossen |
| 5 | Admin: Login, Produkte, Bestellungen, Anfragen, Preise | ✅ abgeschlossen |
| 6 | Konto (optional), SEO, Redirects, Performance, Security | ✅ abgeschlossen |
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

## Phase 3 – Bericht

**Fertig**
- Rechner unter `/3d-druck-rechner/`: Drag-and-drop-Upload für STL, OBJ und 3MF (max. 50 MB), Analyse von Volumen, Oberfläche und Maßen direkt auf dem Server.
- Eigene, abhängigkeitsfreie Parser in `src/lib/mesh.ts` (STL binär/ASCII, OBJ, 3MF via fflate und fast-xml-parser); Schutzgrenzen für Dateigröße und Dreieckszahl.
- Gemeinsame Preisformel `src/lib/pricing.ts` für Browser (Live-Schätzung) und Server (verbindliche Nachrechnung); Dokumentation in `docs/KALKULATION.md`.
- Druckerwahl nach Bauraum und Material, Warnungen bei zu großen Modellen, Skalierung, sehr kleinen Volumen und großen Stückzahlen.
- 3D-Vorschau mit three.js (lokal gebündelt, inkl. OrbitControls), Drehen/Zoomen, Raster und automatischer Kamera; bei fehlendem WebGL bleibt der Rechner nutzbar.
- Live-Anzeige von Maßen, Gewicht, Druckzeit und Preis inklusive Aufschlüsselung; Material, Farbe, Füllgrad, Schichthöhe, Stückzahl, Nachbearbeitung und Skalierung wählbar.
- Angebotsanfrage mit Zod-Validierung, Honeypot, Origin-Prüfung, Rate-Limit (5/Stunde), Speicherung in `quote_requests`, Modellablage unter `/var/lib/3d-mir/uploads/quotes/` (SHA-256, Dateiname, Größe) und Bestätigungsseite `/3d-druck-rechner/danke/`.
- E-Mail an Betreiber und Kunde mit allen Angaben und Kalkulationspositionen; ohne SMTP weiterhin `.eml`-Fallback.
- Responsive Gestaltung, Barrierefreiheit (Labels, Statusmeldungen, Tastaturbedienung) und deutsche Texte.

**Getestet**
- `npm run typecheck`, `npm run build`, `npm test` (13 Unit-Tests) und `npm run test:e2e` (3 Playwright-Tests) erfolgreich.
- Playwright: Startseite ohne Konsolenfehler, Stylesheet wird geladen, STL-Upload zeigt 10 × 10 × 10 mm, Preis ≥ 15 €, 3D-Vorschau wird eingeblendet, Absenden-Button aktiv; alle Rechtsseiten erreichbar.
- API-Tests: STL, OBJ und 3MF liefern identische Metriken (1 cm³, 6 cm², 12 Dreiecke); Anfrage erzeugt Referenz `ANF-…`, speichert Datei und Datensatz, Mail-Fallback wird geschrieben, Danke-Seite liefert 200.
- Fehlerfälle: zu große Datei (413), ungültiges Modell (422), fehlende Zustimmung (400), fremde Origin (403), Rate-Limit (429).

**Offen**
- Bestätigung der Kalkulationsparameter und Material-/Maschinenpreise (F1–F8, F66).
- Rechtliche Prüfung des Widerrufsausschlusses für individuell gefertigte Drucke (F58).
- Speicherdauer für Uploads und Löschroutine (F59, F62) – folgt in Phase 5/6.
- Verbindliche Angebote/Preisübernahme in den Shop (Phase 4).

## Phase 4 – Bericht

**Fertig**
- Shop-Übersicht `/shop/` und Produktseite `/shop/recycling-box-batterien/` aus der Datenbank; Produkt, 14 Farbvarianten und Bild per Migration `003_shop_seed.sql` übernommen.
- Produktdaten aus dem Altbestand: SKU `KAP-202308`, Maße 110 × 65 × 87 mm, Beschreibung und Pflegehinweise; fehlerhaftes Gewicht („0,70 g“) bewusst nicht übernommen.
- Warenkorb im signierten, httpOnly-Cookie (`warenkorb`): nur Varianten-IDs und Mengen, keine Preise; Preise und Verfügbarkeit werden bei jeder Anzeige und bei der Bestellung neu aus der Datenbank gelesen.
- Warenkorb-Funktionen: Hinzufügen, Menge ändern, Entfernen, Warenkorb-Zähler im Header, Versandkosten-Hinweis und Mindestwert für kostenlosen Versand.
- Kasse `/kasse/`: Kontakt- und Lieferadresse, Versandart, Zahlungsart, Anmerkung, AGB-/Widerrufs-Checkbox, Honeypot, Origin-Prüfung, Rate-Limit (5/Stunde), serverseitige Zod-Validierung.
- Button „zahlungspflichtig bestellen“; Bestellung wird in einer SQLite-Transaktion mit Positionen, Zwischensumme, Versand und Gesamtbetrag gespeichert; Bestandsführung wird bei gepflegtem Lagerbestand berücksichtigt.
- Bestellnummern im Format `B-JJJJ-XXXXX`; Bestätigungsseite `/bestellung/danke/` zeigt Nummer und Positionen ohne personenbezogene Adressdaten.
- E-Mails an Betreiber und Kunde mit Bestellübersicht, Zahlungs- und Versandart; ohne SMTP weiterhin `.eml`-Fallback.
- Konfiguration `config/shop.json` für Shop-Status, Zahlungsarten, Lieferländer und Rechtstext-Hinweis; Versandkosten aus `config/pricing.json`.
- Klare Platzhalter-Kennzeichnung in Shop, Produkt, Warenkorb und Kasse (Preise, Versand, Zahlung); keine erfundenen Preise oder Zahlungsanbieter.
- Responsive Shop-, Warenkorb- und Kassen-Gestaltung; kleine Vanilla-TS-Ergänzung aktualisiert die Gesamtsumme bei Wechsel der Versandart.

**Getestet**
- `npm run typecheck`, `npm run build`, `npm test` (19 Unit-Tests) und `npm run test:e2e` (5 Playwright-Tests) erfolgreich.
- E2E: Produktseite → Warenkorb → Kasse → Bestellung → Danke-Seite; Versandwechsel aktualisiert die Summe (11,00 € Abholung, 15,99 € DHL); leerer Warenkorb leitet von `/kasse/` zum Warenkorb.
- API-Tests: Hinzufügen, Menge ändern und Entfernen funktionieren; ungültige Kassendaten → 400 mit Fehlermeldung; fremde Origin → 403; leere Kasse → 303 zum Warenkorb.
- Bestellung in der DB geprüft (`orders`, `order_items`, Summen, Zahlungs-/Versandart); Warenkorb-Cookie wird nach der Bestellung gelöscht; beide E-Mails werden als `.eml` abgelegt.
- 301: alte Produkt-URL leitet auf `/shop/recycling-box-batterien/` um.

**Offen**
- Farbabhängige Preise (11,00–12,50 €) und endgültige Produktpreise bestätigen (F48, F67).
- Zahlungsarten und Bankverbindung festlegen (F9–F13, F67); aktuell nur Platzhalter „Vorkasse“/„Zahlung nach Vereinbarung“.
- Versandkosten, Lieferzeiten und Lieferländer bestätigen (F14–F20); derzeit nur Deutschland.
- Lagerbestand: aktuell ohne Bestandsführung (F50).
- Weitere Produkte, Fotos und Freigaben (F35, F36, F51).
- Bestellverwaltung im Admin-Bereich (Phase 5), inklusive Statuswechsel und Rechnungsgrundlage.



## Phase 5 – Bericht

**Fertig**
- Admin-Anmeldung unter `/admin/login/` mit E-Mail und Passwort; Passwörter als Argon2id-Hash, Sitzungen serverseitig in `sessions`, Cookie `mir3d_admin` (httpOnly, SameSite=Lax, signiert, Path `/admin`, 8 Stunden).
- Schutz aller Admin-Seiten: fehlende Sitzung → 303 zur Anmeldung, CSRF-Token pro Sitzung in allen Formularen, Origin-/Referer-Prüfung, Login-Rate-Limit (5 Versuche / 15 Minuten), Audit-Log für Anmeldung, Änderungen und Löschungen.
- Dashboard mit offenen Bestellungen, neuen Anfragen, offenen Kontaktnachrichten und erfasstem Umsatz sowie den letzten Vorgängen.
- Bestellungen: Liste mit Statusfilter und Suche, Detailseite mit Kunden-, Liefer- und Positionsdaten, Statuswechsel, interne Notiz, optionaler Status-E-Mail an den Kunden und Statusverlauf (`order_status_history`).
- Anfragen: Liste und Detailseite inklusive Modellparametern, Preisschätzung, Datei-Download (nur innerhalb des Upload-Verzeichnisses), Statuswechsel, Notiz, Verlauf und endgültigem Löschen inklusive Upload-Datei.
- Kontaktnachrichten: Übersicht, Als-erledigt-Markierung, Wiederöffnen und Löschen.
- Produkte: Anlegen und Bearbeiten (Name, Slug, Beschreibung, Preise, SKU, Gewicht, Maße, Bestand, Sortierung, Sichtbarkeit), Farbvarianten einzeln bearbeiten, ergänzen und löschen.
- Preise: Grundwerte, technische Schätzwerte, Materialpreise und -dichten, Maschinenstunden, Nachbearbeitung, Versandkosten, Schwelle für kostenlosen Versand und Mengenrabatt. Änderungen werden als `pricing.overrides` in `settings` gespeichert und überlagern `config/pricing.json` ohne Neustart; „Auf Grundeinstellung zurücksetzen“ löscht die Überlagerung.
- Passwortänderung im Admin-Bereich (mindestens 12 Zeichen); andere Sitzungen des Benutzers werden dabei beendet.
- Admin-Zugang per CLI: `npm run admin:create -- --email … --name …` (Passwort interaktiv oder einmalig über `ADMIN_PASSWORD`), kein Passwort im Repository.
- Eigenes Admin-Layout und Stylesheet (`web/css/admin.css`), ohne externes Framework; `X-Robots-Tag: noindex, nofollow` für alle Admin-Antworten.

**Getestet**
- `npm run typecheck`, `npm run build`, `npm test` (19 Unit-Tests) und `npm run test:e2e` (6 Playwright-Tests, davon 1 Admin-Test) erfolgreich.
- Alle Admin-Seiten liefern 200: Dashboard, Bestellungen (Liste/Detail), Anfragen (Liste/Detail), Nachrichten, Produkte (Liste/Detail/Neu), Preise, Passwort.
- POST-Formulare mit CSRF geprüft: Bestellstatus und Notiz, Anfragestatus und Notiz, Nachricht erledigt, Produkt anlegen und speichern, Variante anlegen und löschen, Preise speichern und zurücksetzen, Passwort ändern.
- Negativtests: POST ohne CSRF → 403, fremde Origin → 403, falsches aktuelles Passwort → 400, ungültige Produktdaten → 400.
- Anmeldung, Abmeldung und erneuter Zugriffsschutz geprüft; Testkonto und Testdaten nach den Tests aus der Produktions-DB entfernt.

**Offen**
- Konkreter Admin-Zugang (Name/E-Mail) muss vom Auftraggeber benannt und per CLI angelegt werden (F64).
- TOTP-2FA ist vorbereitet (Feld `totp_secret`), aber nicht aktiviert (F63).
- Produktbilder werden weiterhin über den Bild-Build und die Datenbankzuordnung gepflegt; eine Upload-Oberfläche im Admin ist nicht Teil dieser Phase.
- Rechnungen, Steuersätze und Buchhaltungsexporte sind nicht umgesetzt (F66).

## Phase 6 – Bericht

**Fertig**
- `robots.txt` und `sitemap.xml` kommen aus der Anwendung. Die Sitemap enthält alle statischen Seiten und alle aktiven Produkte mit `lastmod`; `robots.txt` sperrt Admin, API, Warenkorb, Kasse und Danke-Seiten und verweist auf die Sitemap.
- Kanonische URLs und `og:url` auf allen Seiten; Produktseiten mit `Product`- und `BreadcrumbList`-JSON-LD, Startseite mit `LocalBusiness` und `WebSite`-JSON-LD.
- 301-Weiterleitungen der alten WordPress-URLs vollständig in der Anwendung ergänzt: u. a. `/versandarten/`, `/bezahlmoeglichkeiten/`, `/widerrufsbelehrung/`, `/cookie-richtlinie-eu/`, `/echtheit-von-bewertungen/`, `/kontakt`, `/mein-konto/`, `/wp-sitemap.xml`, `/wp-login.php`; Präfixe `/wp-json/`, `/wp-admin/`, `/wp-sitemap-posts-` und die alte Produkt-URL werden ebenfalls dauerhaft umgeleitet. Alte Upload-URLs laufen bewusst ins 404.
- Performance: Inter-Variable-Schrift auf den tatsächlich genutzten Zeichensatz reduziert (352 kB → 80 kB) und vorgeladen; Logo in 2×-Auflösung; LCP-Bild lädt jetzt `eager` mit `fetchpriority="high"`; Bild- und Schriftdateien mit Cache-Headern.
- Sicherheit: HSTS wird bei HTTPS automatisch gesetzt, `Permissions-Policy` und `Cross-Origin-Opener-Policy` bleiben aktiv, CSP ohne Inline-Skripte; sicherheitsrelevante Header auch für statische Assets.
- Konto-Funktion ist laut `config/site.json` deaktiviert (`customerAccounts: false`); es werden keine Kundenkonten und keine zusätzlichen Cookies eingeführt.

**Getestet**
- Lighthouse (mobil, gedrosselt) auf Startseite, Shop, Rechner und Kontakt: Performance 97–100, Accessibility 100, Best Practices 100, SEO 100.
- Neue E2E-Tests für `robots.txt`, Sitemap, Canonical und die 301-Weiterleitungen; alle 7 ausführbaren E2E-Tests und 19 Unit-Tests erfolgreich.
- `nginx -t` erfolgreich; `robots.txt` und `sitemap.xml` liefern 200 über NGINX, Sitemap ist gültiges XML.
- Keine 404-Ressourcen und keine Konsolenfehler auf der Startseite (vorher fehlendes Web-Manifest).

**Offen**
- Domainumstellung und TLS (F30–F33): HSTS greift erst mit HTTPS; `site.baseUrl` steht bereits auf `https://www.3d-mir.de`.
- Lighthouse-Werte sind Momentaufnahmen der lokalen Umgebung; nach dem Livegang mit echten Netzwerkbedingungen erneut messen.
