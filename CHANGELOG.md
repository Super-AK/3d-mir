# Changelog

Alle wesentlichen Änderungen an der 3D-MIR-Webseite. Die Versionierung folgt
[Semantic Versioning](https://semver.org/lang/de/).

## [1.0.0-rc.4] – 2026-11-14

### Behoben

- **Galeriebilder entfernen:** Nach dem Löschen des letzten eigenen Bildes
  wurden im Admin wieder die Standardbilder angezeigt, obwohl die Galerie
  faktisch leer war. Jetzt gilt: `null` = Standardgalerie, leere Liste =
  keine Galerie (Referenzbereich wird auf der Startseite ausgeblendet).
- Der Admin zeigt die Standardgalerie nicht mehr als löschbare eigene Bilder
  an und bietet „Standardgalerie wiederherstellen“ an.

## [1.0.0-rc.3] – 2026-11-14

### Geändert

- **Preise und Kalkulation vom Betreiber bestätigt** (14.11.2026):
  `meta.status` und `calculation.status` in `config/pricing.json` auf
  `FINAL` gesetzt.
- Platzhalter-Hinweise für Preise verschwinden auf Produktseiten, unter
  „Leistungen“ und im Admin-Bereich „Preise“.
- Shop-Hinweis und Kassen-Hinweis nennen nur noch die Versandkosten als
  offenen Platzhalter.
- TODO-Marker aus den Drucker-Hinweisen und den Live-Preis-Overrides entfernt.

## [1.0.0-rc.2] – 2026-11-14

### Hinzugefügt

- **Admin → Stammdaten:** Geschäftsdaten (Name, Inhaber, Adresse, Telefon,
  E-Mail, Steuerhinweis), Kanäle (Etsy, Kleinanzeigen), Kontakt- und
  SEO-Angaben sowie Startseiten-Texte bearbeiten.
- **Bilder im Admin:** Logo (PNG/JPG/WebP), Hero-Bild, Service-Bild und
  Galerie mit bis zu acht Bildern hochladen, ersetzen und zurücksetzen.
- Neue Auslieferung für Stammdaten-Logos unter `/site-media/`.
- JSON-LD und alle Templates verwenden die im Admin gespeicherten Werte.

### Geändert

- `config/site.json` enthält einen leeren `images`-Block als Grundeinstellung.
- Telefon-Link wird beim Ändern der Telefonnummer automatisch aktualisiert,
  sofern er nicht bewusst abweichend gesetzt wurde.

## [1.0.0-rc.1] – 2026-11-14

Erster Release-Kandidat: Alle geplanten Funktionen sind umgesetzt. Offen sind
vor allem betriebliche und fachliche Freigaben (siehe unten).

### Hinzugefügt

- **Webseite:** Start, Leistungen, Kontakt, Über-uns-Inhalte, Rechtsseiten,
  Redirects der alten WordPress-URLs, Sitemap, robots.txt, JSON-LD und
  strukturierte Daten.
- **3D-Druck-Rechner:** Upload von STL/OBJ/3MF, Mesh-Analyse, Preisberechnung
  aus Material, Druckzeit, Nachbearbeitung und Versand, 3D-Vorschau mit
  lokal gebündeltem three.js, Angebotsanfrage.
- **Shop:** Produktübersicht und -details, Farbvarianten, Warenkorb, Kasse,
  Bestellbestätigung, Bestellübersicht mit sicherem Token, Bestandsführung.
- **Zahlungen:** Vorkasse per Überweisung, Karte, PayPal, Amazon Pay, Klarna
  und iDEAL über Stripe Checkout; Zahlungsstatus, Webhook, Retry und
  Zahlungsbestätigung.
- **Produktverwaltung:** Produkte anlegen, bearbeiten, löschen, kopieren,
  exportieren und importieren; Bilder mit AVIF/WebP/JPEG-Varianten;
  Versandarten und Versandoptionen je Produkt.
- **Kategorien:** Produktkategorien mit Mehrfachzuordnung, Filter im Shop und
  Anzeige auf Produktkarten und Produktseiten.
- **Kontakt:** Kontaktformular mit Spam-Schutz, IP-basierter Länderprüfung
  (lokale GeoIP-Datenbank), Zeit-Token, Honeypot, Rate-Limit und
  Inhaltsprüfung; Prüfmodus und Freigabe/Spam-Markierung im Admin.
- **Admin:** Dashboard, Bestellungen, Anfragen, Kontaktnachrichten mit
  Direktantwort, Produkte, Kategorien, Preise/Kalkulation, Zahlungen,
  Benachrichtigungen, Veröffentlichung und Passwortänderung.
- **Benachrichtigungen:** E-Mail (SMTP) und Telegram, Kanal im Admin wählbar,
  Testnachrichten und `.eml`-Fallback ohne SMTP.
- **Etsy-Import:** CSV-Import und API-Import (inkl. Variationen) im Admin und
  per Kommandozeile; idempotent, mit Testlauf und Bildübernahme.
- **Betrieb:** Installer, Setup-Menü (durchgehend TUI mit Text-Fallback),
  Update/Rollback, Backup/Restore, GeoIP-Aktualisierung, Systemcheck,
  Portprüfung, eigene NGINX-Konfiguration und systemd-Härtung.

### Geändert

- Bankdaten erscheinen nur noch in der Vorkasse-Bestellbestätigung, nicht auf
  der öffentlichen Zahlungsseite oder der Danke-Seite.
- Zahlungsarten im Shop folgen den im Admin aktivierten Methoden.
- „Versand ab“ berücksichtigt die kostenlose Abholung (0 €).
- Platzhalter-Hinweise lassen sich im Admin unter **Veröffentlichung**
  ausblenden, sobald Preise, Versand und Rechtstexte geprüft sind.
- Produkt-Slugs werden auf 80–90 Zeichen begrenzt; der Router akzeptiert
  Parameter bis 300 Zeichen.
- Setup-Menü: Einheitliche whiptail-Dialoge für Eingaben, Hinweise, Fehler,
  Fortschritt und Dateiauswahl; „Beenden“ ist Punkt 0.

### Behoben

- Zu lange Produkt-URLs führten zu `FST_ERR_MAX_PARAM_LENGTH` (HTTP 414).
- Auf Shop- und Produktseiten wurden alle Zahlungsarten statt der aktiven
  angezeigt.
- Hardcodierte Kategorie „Aufbewahrung“ auf Produktseiten.
- „Versand ab 4,99 €“ trotz möglicher Abholung.
- Warnung „Shop im Aufbau“ wurde im Warenkorb auch nach der Freigabe angezeigt.

### Sicherheit

- CSP ohne Inline-Skripte, Security-Header, CSRF-Schutz, Argon2id-Passwörter,
  Rate-Limits, gehärteter systemd-Dienst, keine externen CDNs oder Tracking.
- Länder-Header werden nur von vertrauenswürdigen Proxies und nur nach
  ausdrücklicher Konfiguration (`COUNTRY_HEADER`) ausgewertet.
- Etsy-Zugangsdaten werden nicht gespeichert; der Import läuft als separater
  Prozess mit Zeitlimit.

### Dokumentation

- `docs/INSTALLATION.md`, `docs/DEPLOYMENT.md`, `docs/ADMIN.md`,
  `docs/OFFENE-FRAGEN.md`, `docs/PHASEN.md`, `docs/ABNAHME.md` und
  `docs/KALKULATION.md` auf dem aktuellen Stand.
- Neue Installations-, Update- und Backup-Anleitungen inklusive GeoIP,
  Stripe, Benachrichtigungen und Etsy-Import.

### Offen bis zum Livegang

- Fachliche Freigabe von Preisen, Versandkosten und Rechtstexten.
- SMTP- und Telegram-Zugangsdaten, Bankverbindung für Vorkasse.
- Stripe-Live-Schlüssel, Live-Webhook und Live-Test.
- DNS-Umstellung, TLS-Zertifikat und HSTS.
- Freigabe der Länder-Allowlist und ggf. des Proxy-Länderkopfs.
- Etsy-App-Freigabe („Pending Personal Approval“) für den API-Import.
- Portkonflikt auf dem Zielserver `kap-srv` beheben.
- Abnahme auf frischer VM anhand `docs/INSTALLATION.md`.

[1.0.0-rc.4]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.1
