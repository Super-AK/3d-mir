# Changelog

Alle wesentlichen Änderungen an der 3D-MIR-Webseite. Die Versionierung folgt
[Semantic Versioning](https://semver.org/lang/de/).

## [1.0.0-rc.19] – 2026-11-15

### Geändert

- **Impressum:** § 5 DDG, Haftungsabschnitte §§ 7–10 DDG, „Inhaber“
  statt „Vertreten durch“, veralteten EU-OS-Plattform-Link entfernt,
  § 36 VSBG beibehalten.
- **Zahlungsarten:** AGB § 5 und Datenschutz § 6 werden aus den tatsächlich
  im Checkout aktiven Methoden erzeugt; Apple Pay/Google Pay sind der
  Kartenzahlung zugeordnet. Zahlungsseite und Rechtstexte bleiben konsistent.
- **Widerruf:** Rechtsfragwürdigen Satz zu Verbrauchern außerhalb der EU
  entfernt; Rückzahlungstext verallgemeinert.
- **AGB:** § 14 (Vertragsrücktritt) entfernt; anwaltliche Prüfung bleibt
  offen und ist dokumentiert.
- **Datenschutz:** Kontakt-/Upload-Rechtsgrundlagen zusammengeführt,
  Einwilligungs-Checkbox als Kenntnisnahme präzisiert, Logfile-/IP-Angaben
  vereinheitlicht, LfDI Baden-Württemberg ergänzt, Drittlandübermittlung
  konkretisiert, Aufbewahrungsfristen entschärft, Admin-/2FA-Cookies ergänzt.
- **Kasse:** Lieferzeit und Widerrufshinweis in der Bestellübersicht.
- **E-Mails:** AGB- und Widerrufslinks in Bestell- und Angebotsbestätigung.
- **GPSR:** Herstellerangaben und Produktkennung auf Produktseiten und im
  JSON-LD.
- **Weiterleitungen:** alte Footer-Links auch ohne Schrägstrich; `verify.sh`
  prüft zusätzliche Altpfade.
- **Doku:** Anleitung zum Beenden des WordPress-Mischbetriebs, LUCID und
  steuerliche Aufbewahrung als offene Punkte.

## [1.0.0-rc.18] – 2026-11-15

### Hinzugefügt

- **Passkeys (WebAuthn):** Registrierung mehrerer Geräte unter
  **Passwort und Sicherheit**, Anmeldung über die 2FA-Seite mit
  Fingerabdruck, Gesichtserkennung, Windows Hello, Sicherheitsschlüssel oder
  Passwort-Manager. TOTP und Passkeys können parallel genutzt werden.
- **Systemstatus im Admin-Dashboard:** Erreichbarkeit, letzte Prüfung,
  letzte erfolgreiche Prüfung, Ausfallzeitpunkt und Detailmeldung.
- Neuer Datumsfilter mit Uhrzeit für Statusanzeigen.
- Datenbankmigration `012_passkeys.sql`; WebAuthn-Konfiguration über
  `WEBAUTHN_RP_ID` und `WEBAUTHN_ORIGIN` (Standard aus `site.baseUrl`).

### Geändert

- Uptime-Check schreibt zusätzlich Zeitpunkt, Detail und letzte erfolgreiche
  Prüfung in `monitor-state.json`.
- Anmelde-Layout lädt das Admin-JavaScript, damit Passkeys auch auf der
  Login-Seite funktionieren.

## [1.0.0-rc.17] – 2026-11-14

### Hinzugefügt

- **Galerieverwaltung:** Reihenfolge per Drag & Drop oder Pfeiltasten ändern,
  Alternativtexte pro Bild pflegen; die Texte erscheinen auf der Startseite.
- **Bildzuschnitt im Modal:** Ausschnitt verschieben und an den Ecken
  verkleinern, zurücksetzen; ohne Änderung wird das Original verwendet.
- **Kopie von Kunden-E-Mails:** Checkbox unter **Benachrichtigungen**, um
  Bestell- und Angebotsbestätigungen als BCC an den Betreiber zu senden.
- **TOTP-2FA:** Einrichtung mit QR-Code unter **Passwort und Sicherheit**;
  beim Login ist zusätzlich ein 6-stelliger Code erforderlich.
- **Uptime-Check:** systemd-Timer prüft alle fünf Minuten `/api/health` und
  benachrichtigt über den gewählten Kanal, inklusive Entwarnung.

### Geändert

- Offene-Fragen-Dokumentation: auf dem Produktivserver erledigte Punkte
  (DNS/TLS, Bankverbindung, SMTP, Telegram, Port, Hosting/AVV) nachgetragen.

## [1.0.0-rc.16] – 2026-11-14

### Hinzugefügt

- **Bildbearbeitung per Modalfenster:** Logo, Hero-, Service-, Material- und
  Rechnerbild tragen ein Stiftsymbol. Das Fenster erlaubt Auswahl per Klick
  oder Drag & Drop, zeigt eine Vorschau und lädt erst mit **Speichern** hoch.
- **Galerie-Upload in einem Fenster:** mehrere Bilder gleichzeitig auswählen
  oder hineinziehen, Vorschau der Auswahl, einzelne Bilder entfernen,
  „Alle entfernen“ und optional die vorhandene Galerie ersetzen.
- **Upload-Fortschritt** als Balken mit Prozentanzeige und Statusmeldung.
- Serverseitige JSON-Antworten für die Bild-Uploads, damit Fehler ohne
  Seitenwechsel im Fenster erscheinen.
- Ohne JavaScript bleibt das klassische Upload-Formular verfügbar.

## [1.0.0-rc.15] – 2026-11-14

### Geändert

- **Admin-Navigation als gruppierte Seitenleiste:** Übersicht, Verkauf,
  Katalog, Website und Einstellungen statt einer langen waagerechten Leiste.
  Die Seitenleiste bleibt beim Scrollen sichtbar.
- Auf kleinen Bildschirmen klappt die Schaltfläche **Menü** die Navigation ein
  und aus; nach dem Öffnen einer Seite schließt sie sich automatisch. Ohne
  JavaScript bleibt die Navigation sichtbar.
- Abmelden-Schaltfläche im dunklen Kopfbereich besser lesbar.
- Bestell- und Anfragenfilter nutzen wieder die volle Breite.

## [1.0.0-rc.14] – 2026-11-14

### Hinzugefügt

- **Admin → Stammdaten:** Material-Bild der Leistungsseite und Rechner-Bild
  separat hochladbar, ersetzbar und zurücksetzbar.
- Beide Bilder erscheinen ohne eigene Datei weiterhin als mitgelieferte
  Standardmotive.

## [1.0.0-rc.13] – 2026-11-14

### Geändert

- **AGB umfassend überarbeitet:** Vertragsschluss, Korrektur von Eingaben,
  Vertragstextspeicherung, Preise/§ 19 UStG, Versandkosten, Lieferländer,
  Lieferzeiten, Zahlungsarten, Widerrufsrecht, Eigentumsvorbehalt,
  Gewährleistung, 3D-Druck-Besonderheiten, Datenschutz, Streitbeilegung und
  Schlussbestimmungen.
- Veralteten ODR-Plattform-Link entfernt (Plattform wurde eingestellt).
- Hinweis auf Sonderanfertigungen und das PDF-Widerrufsformular ergänzt.
- AGB-Stand auf 14.11.2026 aktualisiert.

## [1.0.0-rc.12] – 2026-11-14

### Hinzugefügt

- **Muster-Widerrufsformular als PDF** unter `/widerruf/formular.pdf`,
  inklusive aktueller Geschäftsdaten, Bestellnummer, Datum und
  Unterschriftenfeld. Download-Links auf der Widerrufsseite und in der
  Bestellbestätigung.
- Prominenter Hinweis zum Widerrufsausschluss bei Sonderanfertigungen
  (z. B. individuell gefertigte 3D-Druckteile); für alle übrigen Produkte
  bleibt das Widerrufsrecht bestehen.

### Geändert

- Widerrufsbelehrung um Rücksendeadresse, klare E-Mail-Option und
  präzisierte Formulierung zu Sonderanfertigungen ergänzt.
- Hinweis „Ziffern 1-2“ korrigiert; Abschnitt als „Muster-Widerrufsformular“
  bezeichnet.

## [1.0.0-rc.11] – 2026-11-14

### Behoben

- Der Versand-Platzhalter auf `/versand/` blieb sichtbar, wenn im Admin
  zuvor Veröffentlichungseinstellungen gespeichert worden waren: Der
  Datenbank-Override `shippingStatus = PLATZHALTER` überlagerte die neue
  Grundeinstellung. Migration `010_publication_shipping_final.sql` setzt
  diesen Wert einmalig auf `FINAL`.

## [1.0.0-rc.10] – 2026-11-14

### Geändert

- **Versandkosten und Lieferzeiten vom Betreiber bestätigt** (14.11.2026):
  `shipping.status` in `config/pricing.json` auf `FINAL` gesetzt.
- Der Platzhalter-Hinweis auf `/versand/` entfällt.
- Shop- und Kassenhinweis nennen keine offenen Versandkosten mehr; der
  Shop-Hinweis bleibt bis zur Freigabe „Shop ist live“ aktiv.
- Dokumentation und offene Fragen aktualisiert (F14–F20 erledigt).

## [1.0.0-rc.9] – 2026-11-14

### Hinzugefügt

- **Admin → Rechtstexte:** Hosting-Anbieter, SMTP-Dienstleister,
  Versanddienstleister und Löschfrist für Modell-Uploads ausfüllen.
- Noch offene TODO-Stellen in den Rechtstexten werden gelb hervorgehoben;
  nach dem Speichern erscheint der eingegebene Wert an ihrer Stelle.

### Geändert

- Datenschutzerklärung nutzt die neuen Platzhalter statt fest eingebauter
  TODO-Texte.
- Hinweis und Link auf der Seite **Veröffentlichung** ergänzt.

## [1.0.0-rc.8] – 2026-11-14

### Behoben

- **Stripe-Zahlung startet jetzt zuverlässig:** Die CSP-Regel `form-action`
  erlaubte nur die eigene Domain und blockierte im Browser die
  Weiterleitung zur Stripe-Checkout-Seite. `checkout.stripe.com` und
  `pay.stripe.com` sind jetzt ausdrücklich erlaubt.
- **„Status aktualisieren“** auf der Bestellseite verliert nicht mehr die
  Bestellnummer und das Token; der Link enthält wieder beide Parameter.
- Offene Stripe-Zahlungen zeigen auf der Bestellseite einen klaren Button
  **„Jetzt bezahlen“** statt nur eines kleinen Textlinks.
- Die Bestellbestätigung enthält zusätzlich einen direkten Link zum erneuten
  Start der Zahlung.

## [1.0.0-rc.7] – 2026-11-14

### Behoben

- `deploy/verify.sh` erkennt ein vorhandenes Let's-Encrypt-Zertifikat und
  prüft die Seiten automatisch über HTTPS (mit `--resolve` lokal gegen NGINX).
  Die zuvor gemeldeten 301-Fehler auf Produktivservern mit certbot-Redirect
  waren kein Anwendungsfehler.
- Ohne Zertifikat bleibt die Prüfung über HTTP mit `Host`-Header erhalten.

## [1.0.0-rc.6] – 2026-11-14

### Behoben

- `deploy/update.sh` prüft den Health-Endpunkt jetzt direkt am
  Anwendungsport statt über den NGINX-Default-Vhost. Dadurch schlägt das
  Update auf gemeinsam genutzten Servern (z. B. `kap-srv`) nicht mehr
  fälschlich fehl.
- Produktiv-Update-Anleitung für Shared Server, Portprüfung, Nacharbeiten
  und Rollback in `docs/DEPLOYMENT.md` ergänzt.

## [1.0.0-rc.5] – 2026-11-14

### Behoben

- **Galerie-Upload ergänzt jetzt:** Ein neu hochgeladenes Bild entfernt nicht
  mehr die übrigen Galeriebilder. Es wird an die eigene Galerie angehängt
  (maximal 8). Zum vollständigen Ersetzen gibt es die Checkbox „Vorhandene
  eigene Galerie vor dem Hochladen entfernen“.
- „Standardgalerie wiederherstellen“ setzt weiterhin nur ohne neue Uploads
  auf die mitgelieferten Bilder zurück.

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

[1.0.0-rc.19]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.19
[1.0.0-rc.18]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.18
[1.0.0-rc.17]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.17
[1.0.0-rc.16]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.16
[1.0.0-rc.15]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.15
[1.0.0-rc.14]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.14
[1.0.0-rc.13]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.13
[1.0.0-rc.12]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.12
[1.0.0-rc.11]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.11
[1.0.0-rc.10]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.10
[1.0.0-rc.9]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.9
[1.0.0-rc.8]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.8
[1.0.0-rc.7]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.7
[1.0.0-rc.6]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.6
[1.0.0-rc.5]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.5
[1.0.0-rc.4]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.1
