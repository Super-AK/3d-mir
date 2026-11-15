# Phasenplan und Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Analyse, Systemprüfung, Projektgerüst, NGINX, systemd, Git | ✅ abgeschlossen |
| 2 | Design-System, statische Seiten, Rechtsseiten, Kontakt | ✅ abgeschlossen |
| 3 | Rechner: Upload, 3D-Vorschau, Preis, Angebotsanfrage | ✅ abgeschlossen |
| 4 | Shop: Produkte, Warenkorb, Checkout, E-Mails | ✅ abgeschlossen |
| 5 | Admin: Login, Produkte, Bestellungen, Anfragen, Preise | ✅ abgeschlossen |
| 6 | Konto (optional), SEO, Redirects, Performance, Security | ✅ abgeschlossen |
| 7 | Deployment-Paket und Test auf frischer VM | ✅ abgeschlossen |
| 8 | Abnahme und Abschlussbericht | ✅ abgeschlossen |

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

## Phase 7 – Bericht

**Fertig**
- Deployment-Paket in `deploy/`:
  - `install.sh` – geführte Installation (whiptail oder Umgebungsvariablen), installiert Pakete, legt Dienstbenutzer und Verzeichnisse an, erzeugt `.env` mit zufälligem `SESSION_SECRET`, baut die Anwendung, richtet systemd, NGINX, UFW und optional TLS ein, legt optional den Admin-Zugang an und prüft den Health-Endpunkt.
  - `update.sh` – Backup, optionaler Git-Pull, `npm ci`, Build, Neustart, Health-Check und automatischer Rollback auf Commit und Build-Artefakte.
  - `backup.sh` – konsistente SQLite-Sicherung mit Integritätsprüfung, Uploads, `config/*.json`, `.env` und Git-Commit; Aufbewahrung 14 Tage.
  - `restore.sh` – Sicherung des aktuellen Stands, Wiederherstellung von Datenbank, Uploads, Konfiguration und `.env`, Health-Check.
  - `verify.sh` – lesende Betriebsprüfung (Dienst, NGINX, Seiten, Header, Redirects, DB, Rechte, TLS-Ablauf), Exit-Code für Monitoring.
  - `nginx.conf.tpl` und `3d-mir.service.tpl` als Vorlagen.
- `docs/DEPLOYMENT.md` mit Erstinstallation, DNS/TLS, Updates, Backup/Restore, Logs, Fehlersuche und Checkliste für die frische VM.
- Installer und Update sind idempotent; vorhandene `.env`- und NGINX-Dateien werden vor Änderungen gesichert.

**Getestet**
- `install.sh --non-interactive` auf dem vorhandenen Ubuntu-26.04-System erneut ausgeführt: Paketprüfung, `npm ci`, Build, systemd-Unit, NGINX-Vhost, Health-Check erfolgreich; bestehende NGINX-Konfiguration automatisch gesichert.
- `update.sh` erfolgreich: Backup, Build, Neustart und Health-Check ohne Ausfall.
- `backup.sh` erzeugt ein 13-KiB-Archiv mit Datenbank, Upload, Konfiguration und `.env`; SQLite-Integritätsprüfung `ok`.
- `verify.sh`: 26 Prüfungen bestanden, 0 fehlgeschlagen (TLS erwartungsgemäß noch offen).
- Nach dem Re-Install alle 7 ausführbaren E2E-Tests und 19 Unit-Tests erfolgreich.

**Offen**
- Ein Test auf einer wirklich frischen VM ist in dieser Umgebung nicht möglich; die Checkliste in `docs/DEPLOYMENT.md` ist dafür vorbereitet. Der idempotente Re-Run auf dem Produktionssystem wurde vollständig geprüft.
- DNS-Umstellung und Let's-Encrypt-Zertifikat stehen aus (F30–F33).

## Phase 8 – Bericht

**Fertig**
- `docs/ABNAHME.md`: Umfang, Prüfergebnisse, Abnahmekriterien, offene Punkte und Abnahmeerklärung mit Unterschriftenfeldern.
- `docs/ABSCHLUSSBERICHT.md`: Zusammenfassung, Architektur, Phasen, Messwerte, Datenschutz, Betrieb, Risiken und Übergabe.
- Abschließende Prüfung von Build, Unit- und E2E-Tests, Betriebsprüfung, 404-Seite, Admin-Headern, Rechtstext-Hinweisen und Platzhalter-Kennzeichnung.
- Statusübersicht und README auf den finalen Stand gebracht.

**Getestet**
- `npm run typecheck` und `npm run build` erfolgreich.
- `npm test`: 19/19 Unit-Tests bestanden.
- `npm run test:e2e`: 7/7 ausführbare Tests bestanden (Admin-Test ohne Zugangsdaten übersprungen).
- `sudo deploy/verify.sh`: 26/26 Prüfungen bestanden.
- Lighthouse mobil: Start 100/100/100/100, Shop 99/100/100/100, Rechner 97/100/100/100, Kontakt 99/100/100/100.
- 404-Seite liefert 404; Admin-Antworten tragen `X-Robots-Tag: noindex, nofollow`; Rechtsseiten zeigen den Prüfhinweis; Shop und Rechner weisen auf Platzhalterpreise hin.

**Offen**
- Fachliche Freigaben des Auftraggebers (Preise, Versand, Zahlung, SMTP, Recht) und DNS-/TLS-Umstellung – siehe `docs/ABNAHME.md` und `docs/OFFENE-FRAGEN.md`.

## Nachtrag – Katalogverwaltung und Produktbilder

**Fertig**
- Admin → Preise: Materialien, Drucker, Nachbearbeitung, Versandarten und Mengenrabatt lassen sich vollständig bearbeiten, löschen und neu anlegen. Die Verwaltung erfolgt in einer gemeinsamen Maske mit Löschmarkierungen und „Neu“-Zeilen; IDs werden aus der Bezeichnung erzeugt.
- Neue Materialien erhalten Farben, Eigenschaften, Anwendungen und Hinweise; Drucker bekommen Bauraum, Maschinenstunde und Materialzuordnung. Beim Löschen eines Materials werden Verweise in Druckern bereinigt.
- Der komplette Katalog wird als `catalog` in `pricing.overrides` gespeichert und überlagert `config/pricing.json`; Zurücksetzen stellt die Grundeinstellung wieder her. Mindestens ein Material, ein Drucker, eine Nachbearbeitung und eine Versandart bleiben erforderlich.
- Admin → Produkte: Bilder können hochgeladen, mit Alternativtext und Sortierung versehen und gelöscht werden. Erlaubt sind JPG, PNG, WebP und AVIF bis 12 MB, maximal 12 Bilder je Produkt.
- Hochgeladene Bilder werden automatisch gedreht, von Metadaten befreit und als AVIF/WebP/JPG in 480/800/1200 px erzeugt. Ablage unter `/var/lib/3d-mir/uploads/media/products/…`, Auslieferung über `/media/…` mit Cache-Headern; 3D-Uploads bleiben weiterhin privat.
- Dokumentation in `docs/ADMIN.md`.

**Getestet**
- Preisformular speichern, Material/Versand/Mengenrabatt anlegen und wieder löschen; Validierung „mindestens ein Material“ liefert 400.
- Bild-Upload (JPG) inkl. Varianten, Vorschau und Auslieferung über `/media/`; Alternativtext/Sortierung ändern; Bild löschen entfernt Datenbankeintrag und Dateien.
- Sicherheit: Upload ohne gültiges CSRF-Token → 403, fremde Origin → 403, ungültige Bilddatei wird abgelehnt.
- 19 Unit-Tests und 7 ausführbare E2E-Tests weiterhin erfolgreich.

## Nachtrag – Produktgalerie und Mehrfach-Upload

**Fertig**
- Produktseite zeigt eine Galerie: ein großes Bild, alle weiteren als Miniaturen; Auswahl per Klick oder Pfeiltasten.
- Klick auf das große Bild öffnet eine vergrößerte Ansicht als modaler Dialog (natives `<dialog>`) mit Schließen-Button, Backdrop-Klick und Escape. Ohne JavaScript öffnen die Verweise direkt die Bilddatei.
- Im Admin können mehrere Bilder gleichzeitig hochgeladen werden; das Limit von 12 Bildern pro Produkt gilt für den gesamten Upload. Teilfehler werden verständlich gemeldet, erfolgreiche Bilder bleiben erhalten.
- Gemeinsamer Alternativtext pro Upload, danach einzeln editierbar.

**Getestet**
- Mehrfach-Upload von drei Bildern: alle Varianten erzeugt, Datenbankeinträge mit fortlaufender Sortierung.
- Galerie im Browser geprüft: eine sichtbare Großansicht, Miniaturenwechsel, Dialog öffnen/schließen, Pfeiltasten, keine Konsolenfehler.
- Aufräumen der Testbilder; vorhandenes Betreiber-Bild blieb unangetastet.

## Nachtrag – Kompaktere Galerie, Blätterfunktion und Upload-Fortschritt

**Fertig**
- Hauptbild der Produktgalerie auf maximal ca. 430 px Breite begrenzt und zentriert; Miniaturen etwas kompakter.
- Vergrößerte Ansicht mit Blätterfunktion: Zurück-/Weiter-Buttons, Pfeiltasten, Zähler „Bild X von Y“, Wrap-around. Das große Bild der Seite folgt beim Blättern mit.
- Bild-Upload zeigt eine Fortschrittsanzeige (Prozent, Fortschrittsbalken) über XMLHttpRequest; Button ist während des Uploads gesperrt. Die Route antwortet für diese Anfragen mit JSON und leitet anschließend weiter; ohne JavaScript bleibt der normale Formular-Upload erhalten.

**Getestet**
- Galerie im Browser: Hauptbild 430 × 538 px, Blättern per Button und Pfeiltasten, Zähler 4/11 → 5/11 → 4/11, Dialog schließt per Escape, keine Konsolenfehler.
- Upload mit gedrosselter Verbindung: Fortschritt bei 12 %, Button deaktiviert, anschließend Weiterleitung mit Erfolgsmeldung.
- Testbilder anschließend entfernt; die vom Betreiber hochgeladenen Bilder blieben erhalten.

## Nachtrag – Versandanzeige, Versandseite und Aktiv-Schalter

**Fertig**
- Fehlerhafte Euro-Anzeige behoben: Versandkosten und Schwellenwerte wurden als Cent interpretiert („ab 0,05 €“). Jetzt erscheinen korrekte Beträge („ab 4,99 €, frei ab 50,00 €“); auch Nachbearbeitungspreise im Rechner nutzen den Euro-Filter.
- Versandübersicht zeigt den günstigsten aktiven Paketversand statt starr der ersten Versandart; ohne kostenlosen Versand entfällt der Hinweis.
- Die öffentliche Seite „Versandarten und Kosten“ (`/versand/`) wird vollständig aus den im Admin gepflegten Versandarten erzeugt (Bezeichnung, Lieferzeit, Preis, kostenloser Versand ab). Die alten erfundenen Versandarten (Express, International) sind entfernt.
- Materialien, Drucker, Nachbearbeitung und Versandarten haben im Admin eine Checkbox „Aktiv“. Inaktive Einträge bleiben bearbeitbar, werden aber im Rechner, Shop, Checkout und auf der Versandseite nicht angezeigt. Mindestens ein aktiver Eintrag je Bereich ist erforderlich.
- Drucker-Materialzuordnungen werden beim Ausblenden inaktiver Materialien automatisch bereinigt.

**Getestet**
- Anzeige auf Shop- und Produktseite: „ab 4,99 € · frei ab 50,00 €“; Rechner zeigt „+ 4,00 €“ für Glätten.
- Versandseite listet DHL Paket und Abholung aus der Datenbank.
- Aktiv-Test: PLA, Anycubic, Glätten und Abholung deaktiviert → nicht mehr auf Rechner/Versandseite; nach Reaktivierung wieder sichtbar.
- Typecheck, Build, Unit- und E2E-Tests erfolgreich.

## Nachtrag – Preisanzeige aus Varianten

**Fertig**
- Shop-Übersicht und Produktseite zeigen keinen Preisbereich mehr („11,00 € – 12,50 €“), sondern automatisch „ab <kleinster Variantenpreis>“.
- Sind alle Variantenpreise gleich oder gibt es keine Varianten, wird ein einzelner Preis ohne „ab“ angezeigt.
- Produktseite startet mit „ab …“ (Farbwahl noch offen); nach Auswahl einer Farbe erscheint der konkrete Variantenpreis. Ohne JavaScript bleibt der „ab“-Preis sichtbar, die Auswahl funktioniert weiterhin.
- JSON-LD (`lowPrice`/`highPrice`) nutzt jetzt ausschließlich die Variantenpreise; veraltete Preisbereichsfelder am Produkt werden dafür ignoriert.
- Hinweis „Farbzuordnung noch nicht bestätigt“ ohne fest verdrahtete Beispielpreise.

**Getestet**
- Shop-Karte: „ab 11,00 €“; Produktseite initial „ab 11,00 €“, nach Auswahl von „Random-Verlauf“ „12,00 €“.
- Auswahl-Platzhalter „Bitte Farbe wählen“ ist vorausgewählt und deaktiviert.
- E2E-Shop-Test angepasst; 19 Unit-Tests und 7 E2E-Tests erfolgreich.

## Nachtrag – 3D-Vorschau steht aufrecht

**Fertig**
- Hochgeladene Modelle werden in der 3D-Vorschau von Z-up (3D-Druck-Standard bei STL/OBJ/3MF) auf Y-up (three.js) gedreht. Dadurch liegen sie nicht mehr flach auf der Seite, sondern stehen auf dem Raster.
- Die Zentrierung, Kameraposition und Bodenfläche werden nach der Drehung aus der tatsächlichen Bounding-Box berechnet.

**Getestet**
- Testmodell 10 × 10 × 40 mm hochgeladen: Analyse meldet korrekte Maße, Vorschau zeigt das Modell aufrecht auf dem Raster.
- Typecheck, 19 Unit-Tests, 7 E2E-Tests erfolgreich.

## Nachtrag – Produktverwaltung und Vorschau-Umschaltung

**Fertig**
- Admin → Produkte: Einzel-Löschen mit Bestätigungsseite, Massenlöschung per Checkbox (inkl. „Alle auswählen“ und Bestätigungsseite), Kopieren inklusive Varianten und Bilder (Kopie zunächst inaktiv) sowie Export und Import als JSON.
- Export enthält Produktdaten, Varianten und Bilder (hochgeladene Bilder als Base64-JPG); Import prüft das Format, vergibt eindeutige Slugs, verarbeitet Bilder neu und überschreibt keine bestehenden Produkte.
- Bilder einer Kopie werden physisch dupliziert, damit Löschen der Kopie die Originalbilder nicht entfernt.
- 3D-Vorschau: Umschalter „Liegend anzeigen“ / „Stehend anzeigen“. Standard bleibt die Z-up→Y-up-Drehung; beim Umschalten werden Zentrierung, Raster und Kamera neu berechnet.

**Getestet**
- Export aller Produkte (1 Produkt, 14 Varianten, 9 Bilder) und Einzel-Export.
- Kopieren von Produkt 1: 14 Varianten, 9 Bilder, 80 duplizierte Bilddateien; Kopie inaktiv.
- Import einer Testdatei mit zwei Varianten und einem Bild; anschließende Massenlöschung von Kopie und Importprodukt inklusive Dateien.
- Vorschau-Umschalter: „Liegend anzeigen“ → Modell liegt flach, „Stehend anzeigen“ → Modell steht wieder; keine Konsolenfehler.
- Typecheck, Build, 19 Unit-Tests, 7 E2E-Tests und Betriebsprüfung erfolgreich.

## Nachtrag – Versandarten und Versandoptionen pro Produkt

**Fertig**
- Produkte speichern ausgewählte Versandarten (`shipping_method_ids`) und Versand-Zusatzoptionen (`shipping_option_ids`). Ohne Versandarten-Auswahl gelten alle aktiven Versandarten.
- Neue Katalogliste „Versandoptionen“ unter Admin → Preise → Versandoptionen: Bezeichnung, Preis, Hinweis, Aktiv-Status, Löschen und Neu anlegen.
- Produktformular bietet Checkboxen für Versandarten und Versandoptionen; inaktive Einträge sind gekennzeichnet.
- Checkout: Es werden nur die für alle Warenkorb-Produkte erlaubten Versandarten angeboten; passende Zusatzoptionen erscheinen als Checkboxen mit Preis. Die Summe aktualisiert sich sofort, Optionen werden in `order_options` und `orders.options_cents` gespeichert.
- Bestellbestätigung, Kunden-/Betreiber-E-Mail und Admin-Bestelldetail zeigen die gewählten Optionen und den Gesamtbetrag.
- Produktkopie, Export und Import übernehmen die Versandzuordnungen.
- Datenbankmigrationen `005_product_shipping.sql` und `006_order_options.sql`.

**Getestet**
- Zwei Versandoptionen (Express 9,50 €, Geschenk 2,00 €) angelegt, Produkt 1 zugewiesen (nur DHL) und im Checkout geprüft: nur DHL sichtbar, beide Optionen wählbar.
- Bestellung mit Geschenkverpackung: Zwischensumme 11,00 € + Versand 4,99 € + Option 2,00 € = 17,99 €; Option in DB, Danke-Seite und Admin-Bestellung sichtbar.
- Testoptionen, Testbestellung und Produktzuordnung anschließend entfernt.
- Typecheck, Build, Unit-Tests und E2E-Tests erfolgreich.

## Nachtrag – Zahlungsarten und Stripe

**Fertig**
- Zahlungsstatus getrennt vom Fulfillment-Status: `offen`, `in_bearbeitung`, `bezahlt`, `fehlgeschlagen`, `erstattet`, `storniert`.
- Migration `007_payments.sql` mit Zahlungsfeldern, `order_payments`, `payment_events` (Idempotenz), sicheren Bestelllinks (`public_token`), Bestandsreservierung und `variant_id` in Bestellpositionen.
- Vorkasse: Bankverbindung im Admin pflegbar; Bankdaten werden aus Sicherheitsgründen nur in der Bestätigungs-E-Mail mitgeteilt (nicht auf der öffentlichen Zahlungsseite und nicht auf der Danke-Seite); manuelle Bestätigung des Zahlungseingangs; Zahlungsbestätigung per E-Mail.
- Stripe Checkout für Karte, PayPal, Amazon Pay, Klarna und iDEAL: gehostete Weiterleitung, keine Zahlungsdaten auf dem eigenen Server, Erfolgs-/Abbruch-URLs, Webhook mit Signaturprüfung und Idempotenz, Rückleitungs-Fallback, Betragsprüfung, erneuter Zahlungsversuch.
- Admin: neue Seite „Zahlungen“ mit Bankdaten, Zahlungsarten, Stripe-Status und Webhook-URL; Bestellliste mit Zahlungsstatus-Filter; Bestelldetail mit Zahlungsstatus, Referenz, Zahlungseingang und Aktionen „Zahlungseingang bestätigen“, „Als fehlgeschlagen markieren“, „Erstattung vermerken“.
- Öffentliche Seite `/zahlung/` wird aus den aktiven Zahlungsarten erzeugt; AGB, Datenschutz, Widerruf und Cookie-Tabelle angepasst.
- Stripe-Methoden erscheinen erst, wenn `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` gesetzt sind. Vorkasse funktioniert unabhängig davon.
- Betriebsprüfung `deploy/verify.sh` prüft `/zahlung/` und die Ablehnung unsignierter Webhooks.
- Dokumentation in `docs/ADMIN.md`, `docs/DEPLOYMENT.md` und `docs/OFFENE-FRAGEN.md`.

**Getestet**
- Vorkasse-Bestellung inkl. Bestellübersicht, Bankdaten, Admin-Bestätigung, Statuswechsel und Zahlungsbestätigung per E-Mail.
- Stripe-Test mit Mock-API: Checkout-Weiterleitung, signierter Webhook, Statuswechsel auf „bezahlt“, doppelter Webhook ohne Doppelbuchung, Betragsabweichung mit manueller Prüfnotiz, erneuter Zahlungsversuch, Rückleitung ohne Webhook.
- Unsignierter Webhook wird mit HTTP 400 abgelehnt.
- Zusätzlich Amazon Pay und Klarna als Stripe-Zahlungsarten im Checkout geprüft (Weiterleitung, `tax_behavior=inclusive`).
- Stripe-API-Migration: `payment_method_types` ist ab API-Version 2026-09-30 nicht mehr beschreibbar; die App verwendet jetzt `allowed_payment_method_types`. Karte, PayPal, Amazon Pay, Klarna und iDEAL wurden mit den Stripe-Testschlüsseln erfolgreich als Checkout-Sessions angelegt.
- 25 Unit-Tests, 8 E2E-Tests (inkl. Admin) und Betriebsprüfung erfolgreich.
- Noch nicht getestet: echter Stripe-Testmodus mit Stripe-Konto, echte PayPal-/Amazon-Pay-/Klarna-/iDEAL-Zahlung und Live-Schlüssel. Dafür sind Konto, Schlüssel und öffentliche HTTPS-Erreichbarkeit nötig.

## Nachtrag – Interaktives Setup und Benachrichtigungen

**Fertig**
- Neues Menü `deploy/setup.sh` (auch über `deploy/install.sh --menu`): Installation/Reparatur, Voraussetzungen, Systemcheck, Mail-Setup, Benachrichtigungs-Hilfe, SSL/TLS, Backup/Restore, GitHub-Update, Admin-Zugang, Dienst-Neustart, Logs, Konfiguration und Menü-Neuladen.
- Admin-Seite **Benachrichtigungen**: Kanalwahl Nur E-Mail / Nur Telegram / Beides; SMTP-Konfiguration inkl. Test-E-Mail; Telegram-Bot-Token und Chat-ID inkl. Testnachricht.
- Admin-Benachrichtigungen für Bestellungen, Kontaktanfragen, Angebotsanfragen und Zahlungseingänge laufen über den gewählten Kanal. Kunden-E-Mails bleiben unabhängig davon E-Mail.
- SMTP-Transport wird bei Änderungen im Admin automatisch neu aufgebaut; ohne SMTP weiterhin `.eml`-Fallback.
- Telegram Bot API mit Token-Formatprüfung, Timeout und Fehlerbehandlung.
- Neue Umgebungsvariablen `NOTIFICATION_CHANNEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` als Fallback; Admin-Einstellungen haben Vorrang.
- Dokumentation in `docs/ADMIN.md`, `docs/INSTALLATION.md`, `docs/DEPLOYMENT.md` und README.

**Getestet**
- Admin-Seite speichert Kanal, SMTP- und Telegram-Werte; Test-E-Mail erzeugt ohne SMTP eine `.eml`; fehlendes Telegram wird verständlich gemeldet.
- Unit-Tests für Telegram-Versand, API-Fehler, fehlende Konfiguration und ungültigen Token.
- Typecheck, Unit-Tests und Admin-E2E-Tests erfolgreich.

## Nachtrag – Shared-Server-Portprüfung und eigene NGINX-Konfiguration

**Fertig**
- Installer prüft vor der Einrichtung, ob der Anwendungsport belegt ist. Ohne explizite `PORT`-Vorgabe wählt er automatisch einen freien Port im Bereich 3000–3099 und schreibt ihn in `/etc/3d-mir/3d-mir.env` sowie in die NGINX-Konfiguration.
- Ein explizit gesetzter `PORT` wird respektiert; ist er belegt, bricht der Installer mit einem konkreten Port-Vorschlag ab.
- Bestehende Installationen: Wird der bisherige Port von einer anderen Web-App blockiert, wählt der Installer einen freien Port und aktualisiert `.env` und NGINX-Proxy.
- Eigene NGINX-Datei `/etc/nginx/sites-available/<domain>.conf`; die NGINX-Default-Site und andere Vhosts bleiben unangetastet.
- Setup-Menü: neuer Punkt „Port prüfen / freien Port setzen“, der Port, `.env` und `proxy_pass` aktualisiert, Dienst neu startet und den Health-Check prüft.
- Voraussetzungen und Systemcheck zeigen bei belegtem Port einen freien Vorschlag.

**Getestet**
- Voraussetzungsprüfung erkennt belegten Port und schlägt den nächsten freien Port vor.
- Systemcheck zeigt, ob der Port von `3d-mir.service` oder einem anderen Prozess genutzt wird.
- `bash -n` für Installer und Setup-Menü erfolgreich.

## Nachtrag – Kontakt, Antworten und Spam-Schutz

**Fertig**
- Migration `008_contact.sql`: Länderkürzel, Prüfstatus (`ok`/`pruefen`/`spam`), Prüfgrund, Antwortzeitpunkt und gespeicherter Antworttext.
- Kontaktformular mit signiertem Zeit-Token (HMAC mit `SESSION_SECRET`, 24 Stunden gültig, Mindestalter 3 Sekunden), Honeypot und Rate-Limit; der Besucher gibt kein Land an.
- IP-basierte Ländererkennung: lokale GeoIP-Datenbank im MaxMind-Format (DB-IP Lite, Standard `/var/lib/3d-mir/geoip/dbip-country-lite.mmdb`). Optional kann ein CDN-Länderheader über `COUNTRY_HEADER` freigeschaltet werden; er wird nur von Adressen aus `TRUST_PROXY` akzeptiert. Ohne Konfiguration werden Header ignoriert.
- Spam-Prüfung: erlaubte Länder (Standard nur `DE`), eigenes Verhalten für nicht ermittelbares Land (`review`/`block`/`allow`), Inhaltsprüfung auf Spam-Begriffe, viele Links, Großschreibung und Zeichenwiederholungen.
- Admin unter **Nachrichten**: Einstellungen für Länderprüfung, erlaubte Länder, Prüfmodus (`review`/`block`), Umgang mit unbekanntem Land, Zeit- und Inhaltsprüfung; Statusanzeige zur GeoIP-Datenbank; Prüfstatus je Nachricht; Freigeben/Als Spam markieren; direkte Antwort per E-Mail inkl. Speicherung und `.eml`-Fallback.
- `deploy/update-geoip.sh` und Setup-Menüpunkt zum Installieren/Aktualisieren der GeoIP-Datenbank (Restart des Dienstes inklusive).
- Auffällige Nachrichten werden im Prüfmodus gespeichert, aber nicht automatisch an den Betreiber weitergeleitet; stattdessen gibt es einen Prüfhinweis mit Link in den Admin.
- Preis-Admin: Add-Buttons in allen Kategorien; mehrere neue Materialien, Drucker, Nachbearbeitungen, Versandarten, Versandoptionen und Rabattstaffeln pro Speichervorgang.
- Bankdaten aus der öffentlichen Seite „Zahlungsarten“ und der Bestell-Danke-Seite entfernt; sie stehen nur in der Vorkasse-Bestätigungsmail.
- Setup-Menü: „Beenden“ ist jetzt Punkt 0.
- Etsy-CSV-Import (`npm run etsy:import`): Titel, Beschreibung, Preis, Bestand, SKU, Materialien, Tags und Bilder; idempotent über SKU/Slug, Testlauf mit `--dry-run`.
- Produktbild-Verarbeitung in `src/lib/product-images.ts` ausgelagert, damit Admin und Import-Skript dieselbe Logik nutzen.
- Dokumentation in `docs/ADMIN.md` und `docs/OFFENE-FRAGEN.md`.

**Getestet**
- Kontaktformular im Browser: Token, Honeypot und Zeitprüfung; Anfrage aus Deutschland (IP `80.187.100.20`) wird als `DE`/`ok` gespeichert und an den Betreiber gemeldet.
- Anfrage aus gesperrtem Land (IP `8.8.8.8` → `US`) wird als `pruefen` gespeichert; nicht ermittelbares Land wird je Einstellung geprüft oder abgelehnt; Freigeben setzt auf `ok`; Als Spam markieren setzt `spam` und `handled`.
- Antwort aus dem Admin speichert Betreff/Text und erzeugt ohne SMTP eine `.eml`-Datei.
- Add-Buttons im Browser: jede Kategorie erhält weitere, korrekt indizierte Zeilen ohne `__INDEX__`-Reste.
- Preisformular per HTTP: zwei neue Einträge je Kategorie werden in einem Speichervorgang angelegt.
- Unit-Tests für Token, Länder-Allowlist, Prüfmodus und Inhaltsprüfung (11 Tests).
- Typecheck, Build und 40 Unit-Tests erfolgreich.

## Nachtrag – Veröffentlichung, Kategorien und Etsy-Import im Admin

**Fertig**
- **Veröffentlichung im Admin:** Schalter für Shop-Hinweis, Preis-/Kalkulations-Platzhalter, Versandhinweis und Entwurfshinweis auf den Rechtsseiten. Status wird in `settings` (`publication.settings`) gespeichert; kein Neustart nötig.
- **Lange Produkt-Slugs:** Fastify akzeptiert Parameter bis 300 Zeichen; neue Slug-Erzeugung ist auf 80–90 Zeichen begrenzt. Bestehende lange Slugs wurden verkürzt.
- **Zahlungsarten im Shop:** Shop- und Produktseite verwenden jetzt die im Admin aktivierten Zahlungsarten statt der statischen Liste aus `config/shop.json`.
- **Kategorien:** Migration `009_categories.sql` mit `product_categories` und `product_category_links`, Startkategorien und Namenszuordnung. Admin-Seite zum Anlegen/Bearbeiten/Löschen, Mehrfachzuordnung im Produkt, Filterleiste im Shop und Kategorie im Produktkopf.
- **Versand ab 0 €:** Abholung (0 €) wird bei „Versand ab …“ berücksichtigt.
- **Etsy-Import im Admin:** CSV-Upload und API-Import direkt unter **Produkte → Aus Etsy importieren**, inklusive Testlauf, Fortschrittsausgabe und Sperre gegen parallele Importe. Der Import läuft als Hintergrundprozess; die Admin-Seite fragt den Status ab und umgeht so das Proxy-Timeout.

**Getestet**
- Shop zeigt 14 Produkte, Kategorie „Bad“ filtert auf 3 Produkte, lange Produkt-URL liefert 200.
- Zahlungsbereich im Shop zeigt nur Vorkasse, Karte und PayPal (die drei im Admin aktiven Arten).
- Produktseite zeigt „Versand: ab 0,00 €, frei ab 50,00 €“.
- Admin: Veröffentlichung schaltet den Shop-Hinweis sofort aus, Kategorie anlegen funktioniert, Produktformular zeigt Kategorie-Checkboxen.
- Etsy-Import im Admin (CSV, Testlauf) erkennt 13 Produkte und endet ohne Fehler.
- Typecheck, Build und 48 Unit-Tests erfolgreich.

## Nachtrag – Stammdaten im Admin

**Fertig**
- Admin-Seite **Stammdaten**: Geschäftsdaten, Kanäle, Kontakt, SEO, Startseiten-Texte sowie Logo, Hero-, Service- und Galeriebilder.
- Werte werden in `settings` (`site.settings`) gespeichert und sofort in Templates, Footer, Rechtsseiten, E-Mails und JSON-LD übernommen.
- Logo-Ablage unter `/var/lib/3d-mir/uploads/site/` mit Auslieferung über `/site-media/`; übrige Bilder als Responsive-Varianten unter `/media/site/`.
- Telefon-Link wird automatisch aus der Telefonnummer abgeleitet, wenn er nicht bewusst gesetzt wurde.

**Getestet**
- Stammdaten ändern: Ort und Telefon erscheinen sofort im Footer.
- Logo, Hero und zwei Galeriebilder hochgeladen; Startseite und Header verwenden sie.
- Startseiten-Überschrift geändert; Logo entfernt und Fallback greift.
- Typecheck, Build und 48 Unit-Tests erfolgreich; Betriebsprüfung 28/28.

## Release 1.0.0-rc.26 – 15. November 2026

Favicon-Auslieferung als PNG mit Cache-Busting; behebt Browser, die
JPEG-Favicons nicht anzeigen.

## Release 1.0.0-rc.25 – 15. November 2026

Favicon unter Stammdaten hochladbar; Browser-Tab, Apple-Touch-Icon und
`/favicon.ico` folgen der hinterlegten Datei.

## Release 1.0.0-rc.24 – 15. November 2026

Status- und Zahlungsbestätigungen nutzen das gemeinsame HTML-Mail-Layout.

## Release 1.0.0-rc.23 – 15. November 2026

Direkter Download-Link in Anfrage-Mails und einheitliche HTML-Formatierung
für Benachrichtigungen und Bestätigungen.

## Release 1.0.0-rc.22 – 15. November 2026

Automatische Eingangsbestätigung für Kontaktanfragen mit rechtlichen Links.

## Release 1.0.0-rc.21 – 15. November 2026

Kassen-Hinweis zur Zahlungsart, rechtliche Links in Kontaktantworten,
Bestätigungen zu WordPress, Rechtstexten, Steuer und LUCID dokumentiert.

## Release 1.0.0-rc.20 – 15. November 2026

LUCID-Registrierung und Systembeteiligung als erledigt dokumentiert.

## Release 1.0.0-rc.19 – 15. November 2026

Rechtstexte und Checkout nach Prüfliste überarbeitet: Impressum/DDG,
dynamische Zahlungsarten, Widerruf, AGB, Datenschutz, GPSR-Herstellerangaben,
Weiterleitungen und WordPress-Ablösung dokumentiert.

## Release 1.0.0-rc.18 – 15. November 2026

Passkeys (WebAuthn) für Registrierung und Anmeldung, parallel zu TOTP.
Monitorstatus auf dem Admin-Dashboard.

## Release 1.0.0-rc.17 – 14. November 2026

Galerie: Reihenfolge und Alternativtexte pflegbar; Bildzuschnitt im
Upload-Modal. Kundenmails optional als BCC an den Betreiber. TOTP-2FA für
den Admin-Zugang. Systemd-Timer für den Uptime-Check.

## Release 1.0.0-rc.16 – 14. November 2026

Bilder der Stammdaten werden über Modalfenster mit Klick- oder Drag-&-Drop-
Auswahl, Vorschau und Upload-Fortschritt ersetzt. Die Galerie nimmt mehrere
Bilder in einem Fenster entgegen.

## Release 1.0.0-rc.15 – 14. November 2026

Admin-Navigation als gruppierte, beim Scrollen sichtbare Seitenleiste;
auf kleinen Bildschirmen einklappbar. Bestell- und Anfragenfilter wieder
in voller Breite.

## Release 1.0.0-rc.14 – 14. November 2026

Material-Bild der Leistungsseite und Rechner-Bild sind jetzt unter
**Stammdaten** hochladbar, ersetzbar und zurücksetzbar.

## Release 1.0.0-rc.13 – 14. November 2026

AGB überarbeitet: Vertragsschluss, Preise, Versand, Zahlung, Widerruf,
Eigentumsvorbehalt, Gewährleistung, 3D-Druck-Besonderheiten, Datenschutz,
Streitbeilegung und Schlussbestimmungen. Veralteter ODR-Link entfernt.

## Release 1.0.0-rc.12 – 14. November 2026

Widerrufsbelehrung um Sonderanfertigungs-Hinweis, Rücksendeadresse und
PDF-Formular ergänzt. Neues Muster-Widerrufsformular unter
`/widerruf/formular.pdf`, auch in der Bestellbestätigung verlinkt.

## Release 1.0.0-rc.11 – 14. November 2026

Migration `010_publication_shipping_final.sql` sorgt dafür, dass ein älterer
Admin-Override `shippingStatus = PLATZHALTER` die bestätigten Versandkosten
nicht mehr überlagert.

## Release 1.0.0-rc.10 – 14. November 2026

Versandkosten und Lieferzeiten bestätigt; `shipping.status` steht auf `FINAL`,
der Platzhalter-Hinweis auf `/versand/` entfällt.

## Release 1.0.0-rc.9 – 14. November 2026

Ausfüllbare TODO-Platzhalter in den Rechtstexten: gelbe Markierung im
Frontend, Admin-Seite **Rechtstexte** zum Hinterlegen der Werte.

## Release 1.0.0-rc.8 – 14. November 2026

Stripe-Zahlung korrigiert: CSP `form-action` blockierte die Weiterleitung zu
Stripe; Checkout-Domains sind jetzt erlaubt. Zusätzlich enthält die
Bestellseite einen klaren „Jetzt bezahlen“-Button, und „Status aktualisieren“
behält Nummer und Token.

## Release 1.0.0-rc.7 – 14. November 2026

`deploy/verify.sh` prüft bei vorhandenem TLS-Zertifikat automatisch HTTPS.
Die 301-Meldungen auf Produktivservern mit certbot-Redirect waren dadurch
bedingt, dass die Prüfung zuvor über HTTP lief.

## Release 1.0.0-rc.6 – 14. November 2026

Update-Skript prüft den Health-Endpunkt direkt am Anwendungsport; Anleitung
für Produktiv-Updates auf gemeinsam genutzten Servern ergänzt.

## Release 1.0.0-rc.5 – 14. November 2026

Galerie-Upload korrigiert: Neue Bilder werden an die eigene Galerie angehängt
statt sie zu ersetzen; eine Checkbox erlaubt weiterhin das bewusste Ersetzen.

## Release 1.0.0-rc.4 – 14. November 2026

Galerie-Verwaltung korrigiert: Entfernte Bilder bleiben nicht mehr als
scheinbare Standardbilder im Admin; leere Galerie blendet den Referenzbereich
auf der Startseite aus, „Standardgalerie wiederherstellen“ holt die
mitgelieferten Motive zurück.

## Release 1.0.0-rc.3 – 14. November 2026

Preise und Kalkulation vom Betreiber bestätigt. `meta.status` und
`calculation.status` stehen auf `FINAL`; die Preis-Platzhalterhinweise sind
entfernt, Versandkosten bleiben bis zur Freigabe als Platzhalter markiert.

## Release 1.0.0-rc.2 – 14. November 2026

Stammdaten und Bildverwaltung im Admin ergänzt. Versionshistorie in `CHANGELOG.md`.

## Release 1.0.0-rc.1 – 14. November 2026

Erster Release-Kandidat. Alle geplanten Funktionen sind umgesetzt; die
Versionshistorie und die offenen Livegang-Punkte stehen in `CHANGELOG.md`.

- Version in `package.json`: `1.0.0-rc.1`.
- Unit-Tests: 48/48; E2E: 7/7 ausführbare Tests (Admin-Test optional).
- Betriebsprüfung: 28/28.
- Verbleibend: fachliche Freigaben, Zugangsdaten (SMTP, Telegram, Bank,
  Stripe live), DNS/TLS, Etsy-API-Freigabe, Portkonflikt `kap-srv`.
