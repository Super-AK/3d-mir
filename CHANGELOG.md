# Changelog

Alle wesentlichen Änderungen an der 3D-MIR-Webseite. Die Versionierung folgt
[Semantic Versioning](https://semver.org/lang/de/).

## [1.0.0-rc.54] – 2026-11-20

### Hinzugefügt

- **To-do-Liste unter „Veröffentlichung“:** Die offenen Punkte bis zum
  Livegang stehen jetzt direkt im Admin. Jeder Punkt lässt sich abhaken,
  löschen und bei Bedarf über die Schaltfläche **„Übernehmen“** wieder
  öffnen.
- Eigene Punkte können über **„Neuer Punkt“** ergänzt werden; eine
  **„Standardliste wiederherstellen“** setzt die Vorschläge zurück. Der Stand
  wird in der Datenbank gespeichert (`settings`, Schlüssel
  `publication.checklist`).

## [1.0.0-rc.53] – 2026-11-20

### Hinzugefügt

- **Bestellungen drucken:** In der Bestellliste hat jede Zeile einen
  Druckbutton im gleichen Icon-Stil wie die Aktionen bei Produkten und
  Nachrichten. Auf der Detailseite gibt es zusätzlich einen Button
  **„Drucken“**.
- Die Druckansicht enthält Absender, Kunden- und Lieferadresse, Bestellstatus,
  Zahlungs- und Versandangaben, alle Positionen inklusive Varianten, Farben und
  Personalisierung sowie Zwischensumme, Versand, Optionen und Gesamtsumme.
  Kundenanmerkung und interne Notiz erscheinen nur, wenn sie hinterlegt sind.
- Die Ansicht ist als A4-Seite aufbereitet und zeigt am Bildschirm keine Admin-
  Navigation; beim Drucken werden Werkzeugleiste und Schatten ausgeblendet.
  Der Druckdialog lässt sich per Button oder über die Browserfunktion aufrufen.

### Geändert

- Bestellliste und Bestelldetail teilen sich eine gemeinsame Datenquelle; die
  angezeigten Werte sind in beiden Ansichten identisch.

## [1.0.0-rc.52] – 2026-11-20

### Geändert

- Die Karten unter **Admin → Preise** (Grundwerte, Materialien, Drucker,
  Nachbearbeitung, Versand, Versandoptionen und Mengenrabatt) sind jetzt
  initial eingeklappt. Die Zeile zeigt jeweils eine kurze Vorschau, zum Beispiel
  die Anzahl der Materialien oder den Mindestauftrag. Der Speichern-Button
  bleibt immer sichtbar.
- Unter **Admin → Stammdaten** sind Kanäle, Kontakt und SEO, Bilder sowie die
  Startseiten-Texte initial eingeklappt. Die Geschäftsdaten bleiben sofort
  sichtbar; vorhandene Werte werden in der Vorschauzeile zusammengefasst.
- Auf dem **Dashboard** sind nur noch der Besucher-Chart und der Systemstatus
  eingeklappt. Kennzahlen und die Listen offener Bestellungen, Zahlungen und
  Anfragen bleiben sofort sichtbar.
- Auch diese Bereiche funktionieren ohne JavaScript und per Tastatur; Felder
  in geschlossenen Bereichen werden beim Speichern vom Browser aufgeklappt,
  wenn sie Pflichtfelder sind. E2E-Prüfung für alle Bereiche ergänzt.

## [1.0.0-rc.51] – 2026-11-19

### Geändert

- Weitere Bereiche im Admin-Produktformular sind jetzt standardmäßig
  eingeklappt: **Kategorien**, **Versandarten**, **Versand-Zusatzoptionen**,
  **Varianten, Farben und Personalisierung**, die **Varianten-Tabelle** und die
  **Bilder** inklusive Upload. Die Zeile zeigt jeweils eine kurze Vorschau
  (Anzahl bzw. hinterlegte Werte) und lässt sich per Klick öffnen.
- Name, Slug, Kurzbeschreibung, Preise, Artikelnummer, Maße, Lagerbestand,
  Sortierung und Sichtbarkeit bleiben sofort sichtbar. Pflichtfelder in
  geschlossenen Bereichen werden vom Browser beim Speichern automatisch
  aufgeklappt. Funktioniert ohne JavaScript und per Tastatur.

## [1.0.0-rc.50] – 2026-11-19

### Geändert

- Das Feld **Beschreibung** im Admin-Produktformular ist standardmäßig
  eingeklappt. Ein Klick auf die Zeile öffnet das Textfeld zum Bearbeiten;
  vorhandener Text wird als kurze Vorschau angezeigt. Funktioniert ohne
  JavaScript, der Text wird unverändert gespeichert.

## [1.0.0-rc.49] – 2026-11-19

### Hinzugefügt

- **Produktbilder einfach sortieren:** Die Bilderkarte zeigt die laufende Nummer
  sowie Pfeile nach oben/unten; außerdem lassen sich die Karten per Drag & Drop
  ziehen. Die Nummern werden nach jeder Änderung eindeutig auf `1..n`
  normalisiert. Pfeile funktionieren ohne JavaScript, Drag & Drop als
  progressive Enhancement.
- **Zuschneiden von Produktbildern:** Über den Stift auf einer Bilderkarte
  öffnet sich ein Dialog mit verschiebbarem Ausschnitt. Beim Speichern wird aus dem
  metadatenfreien Original ein neues Bild erzeugt; bestehende Bilder ohne
  Originaldatei nutzen die größte gespeicherte Variante. Audit-Eintrag
  `product.image.crop`.
- Kleinere Miniaturen in der Admin-Bildverwaltung (240 px-Variante, 112 px hoch)
  und kompaktere Karten.

## [1.0.0-rc.48] – 2026-11-19

### Hinzugefügt

- **Aufpreis für Personalisierung pro Produkt:** Im Produktformular lässt sich
  ein Betrag in Euro je Stück hinterlegen. Er wird nur berechnet, wenn der
  Kunde tatsächlich einen Personalisierungstext eingibt.
- Der Aufpreis erscheint als Hinweis auf der Produktseite, in Warenkorb und
  Kasse und geht in Stückpreis, Zwischensumme, Bestellung und Zahlbetrag ein.
- Import/Export (JSON und CSV) sowie das Kopieren von Produkten übernehmen den
  Aufpreis; neue CSV-Spalte `personalisierungspreis`.
- Migration `020_product_personalization_price.sql` mit Standard `0,00 €` für
  bestehende Produkte.

## [1.0.0-rc.47] – 2026-11-19

### Behoben

- **Kollisionen bei Sortiernummern:** Wird einem Produkt eine bereits vergebene
  Nummer zugewiesen, rücken die folgenden Produkte auf. Die Nummern werden
  nach jeder Änderung fortlaufend auf `1..n` normalisiert; Admin, Shop und
  Sitemap verwenden dieselbe Reihenfolge (Sortiernummer, dann ID).
- Migration `019_product_sort_order.sql` bereinigt bestehende doppelte Werte,
  ohne die bisherige Reihenfolge zu verändern.
- JSON- und CSV-Import normalisieren die Sortierung nach dem Import.

### Hinzugefügt

- **Sortierung in der Produktliste** mit Pfeilen und Drag & Drop inklusive
  CSRF-Prüfung, Audit-Eintrag `product.reorder` und Taste bedienbare Pfeile.
- Unit-Tests für die Verschiebe- und Einfügelogik sowie E2E-Prüfung der
  Pfeile und der eindeutigen Nummern.

## [1.0.0-rc.46] – 2026-11-19

### Hinzugefügt

- **CSV-Export und -Import für Produkte** unter **Produkte → CSV-Export/CSV-Import**
  als zweiter Weg neben dem JSON-Format. Die Datei enthält Stammdaten,
  Kategorien, Varianten, Farben und Versandzuordnungen; Bilder bleiben beim
  JSON-Export.
- Die CSV ist eine UTF-8-Semikolon-Datei mit BOM für Excel. Listenwerte stehen
  in einer Zelle (`|`, Varianten `||`); deutsche und englische Spaltennamen
  werden erkannt.
- Beim Import ist die SKU der Schlüssel: vorhandene SKUs werden aktualisiert,
  neue angelegt. Leere Zellen übernehmen die bisherigen Werte; eine
  angegebene Variantenliste ersetzt die vorhandenen Varianten.
- Einzel-Export einer Produktzeile als CSV, CSRF-Prüfung und Audit-Eintrag
  `product.csv.import`.
- Unit-Tests für Parser/Schreiber und E2E-Prüfung von Export, Anlegen,
  Aktualisieren und Löschen des Testprodukts.

## [1.0.0-rc.45] – 2026-11-19

### Hinzugefügt

- **Besucherstatistik** unter **Admin → Besucherstatistik**: Aufrufe,
  Herkunftsländer und häufigste Pfade, filterbar für 7/30/90 Tage oder
  12 Monate und zusammengefasst pro Tag, Woche oder Monat.
- **Dashboard-Zusammenfassung** mit Aufrufen und Besuchern von heute sowie
  einem sieben-Tage-Verlauf und den häufigsten Ländern.
- Besucherzähler ohne Cookies und ohne Speicherung vollständiger IP-Adressen;
  eindeutige Besucher werden über einen täglich wechselnden, nicht
  rückführbaren HMAC aus gekürzter IP und Datum gezählt.
- Migration `018_visitor_stats.sql`, Löschung nach 12 Monaten im bestehenden
  Cleanup und Mitaufnahme in den Testdaten-Reset.
- Datenschutzerklärung und Cookie-Hinweis um die cookie-freie
  Reichweitenmessung ergänzt; offene rechtliche Prüfung als F86 dokumentiert.

## [1.0.0-rc.44] – 2026-11-19

### Behoben

- **Nachrichtenliste auf dem Handy:** Die Tabelle liegt jetzt wie bei Produkten
  und Anfragen in einer Karte und scrollt innerhalb dieser. Die gesamte Seite
  wird nicht mehr seitlich verschoben.
- Die gleiche Korrektur gilt für die Tabelle „Gesperrte und auffällige
  Absender“ und für die Kategorieliste.
- E2E-Prüfung der Nachrichtenliste bei 390 px Breite ergänzt.

## [1.0.0-rc.43] – 2026-11-17

### Hinzugefügt

- **Zusatzinfo pro Versandart:** Unter „Preise → Versand“ lässt sich je
  Versandart eine kurze Zusatzinformation hinterlegen, z. B. „Versichert bis
  500 €“. Sie erscheint im Checkout bei der Auswahl der Versandart sowie auf
  der Produktseite, in der Shop-Übersicht und auf „Versandarten und Kosten“.

## [1.0.0-rc.42] – 2026-11-17

### Behoben

- **Abholung auch bei eigener ID erkannt:** Versandarten mit eigener ID, z. B.
  `abholung-nach-absprache`, werden zusätzlich anhand der Bezeichnung als
  Abholung erkannt. Die Lieferzeit nennt sie damit nicht mehr, und der Hinweis
  „Abholung … in Schömberg möglich“ erscheint wieder. Betrifft insbesondere
  bestehende Produktivdaten.
- Die Seite „Versandarten und Kosten“ kennzeichnet solche Abholarten ebenfalls
  korrekt.
- Unit-Test für die Erkennung anhand der Bezeichnung ergänzt.

## [1.0.0-rc.41] – 2026-11-17

### Hinzugefügt

- **Lieferhinweis pro Produkt:** Im Admin lässt sich der Zusatz zur Lieferzeit
  frei hinterlegen, z. B. „Fertigung nach Bezahlung“ oder „sofort lieferbar“.
  Ohne Angabe erscheint kein Zusatz. Neue Produkte starten mit „Fertigung nach
  Bezahlung“.
- Export, Import und Kopieren übernehmen den Lieferhinweis.

### Geändert

- **Lieferzeit ohne Abholung:** Die Abholung hat keine Lieferzeit und wird in
  der Lieferzeitangabe nicht mehr genannt. Wird ausschließlich Abholung
  angeboten, entfällt die Zeile „Lieferzeit“.
- „Fertigung nach Bestellung“ heißt jetzt standardmäßig „Fertigung nach
  Bezahlung“.
- Unit- und E2E-Tests für Lieferhinweis und Lieferzeit angepasst.

## [1.0.0-rc.40] – 2026-11-17

### Hinzugefügt

- **Material pro Produkt:** Im Admin lässt sich das Material frei hinterlegen,
  z. B. `PLA`, `PETG` oder `PLA Tough`. Die Produktseite zeigt es unter
  „Material“ und in „Auf einen Blick“; bei hinterlegten Farben ergänzt sie
  „in Wunschfarbe“. Ohne Angabe gilt `PLA`.
- Export, Import und Kopieren übernehmen die Materialangabe.

### Geändert

- **Versandangabe auf der Produktseite:** Bei genau einer angebotenen
  Versandart steht der genaue Preis ohne „ab“. Bei mehreren Versandarten
  erscheint weiterhin der günstigste Preis mit „ab“.
- **Abholung:** Der Hinweis „Abholung … in Schömberg möglich“ erscheint nur,
  wenn die Abholung für das Produkt angeboten wird.
- **Lieferzeit:** Die Angabe richtet sich nach den angebotenen Versandarten.
  Bei mehreren Versandarten werden die jeweiligen Lieferzeiten mit
  Bezeichnung genannt, z. B. „DHL Paket: 2–5 Werktage · Abholung: nach
  Absprache“.
- Der Hinweis „frei ab …“ erscheint nur, wenn mindestens eine
  kostenpflichtige Versandart angeboten wird.
- Unit- und E2E-Tests für Material, Versandpreis, Abholung und Lieferzeit
  ergänzt.

## [1.0.0-rc.39] – 2026-11-17

### Hinzugefügt

- **Hinweis im Personalisierungsfeld:** Pro Produkt lässt sich im Admin ein
  eigener Platzhaltertext für das Personalisierungsfeld hinterlegen, z. B.
  „z. B. Wunschname für Anna“. Der Text erscheint im Shop als grauer Hinweis im
  optionalen Textfeld. Ohne Angabe gilt weiterhin der Standardtext
  „z. B. Name oder kurzer Text“.
- Export, Import und Kopieren übernehmen den hinterlegten Hinweis.
- E2E-Test prüft den eigenen Hinweis und den Standardtext.

### Geändert

- Der E2E-Test für die Shop-Bestellung wählt bei mehreren Produkten mit
  ähnlichem Namen die erste passende Produktkarte und berücksichtigt eine
  optionale Farbauswahl. Die erwarteten Summen werden aus den aktuellen
  Produkt- und Versandpreisen berechnet. Damit bleibt der Test unabhängig von
  den gepflegten Produktdaten.

## [1.0.0-rc.38] – 2026-11-17

### Hinzugefügt

- **Varianten, Farben und Personalisierung:** Der bisherige Bereich
  „Farbvarianten“ heißt jetzt „Varianten“ und ist für echte Ausführungen wie
  Größe oder Modell mit eigenem Preis und Bestand gedacht.
- **Farbvarianten als kommagetrennte Liste:** Farben lassen sich pro Produkt
  zusätzlich hinterlegen, ohne eigenen Preis, und mit Varianten kombinieren.
- **Personalisierung pro Produkt:** Eine Checkbox blendet im Shop ein
  optionales Textfeld ein. Der Text wird in der Bestellung gespeichert und im
  Admin, in den Bestellmails und in den Stripe-Positionen angezeigt.
- **Produkte ohne Varianten** sind direkt kaufbar; die Pflichtvariante
  „Standard“ entfällt.
- Der Warenkorb speichert Variante, Farbe, Personalisierung und Menge mit
  stabilen Zeilenschlüsseln; Bestandsführung und Freigabe berücksichtigen auch
  Produkte ohne Varianten.
- Export, Import, Kopieren und Etsy-Import übernehmen die neuen Felder.
- E2E-Tests für Produkte ohne Varianten, kombinierte Varianten/Farben und
  optionale Personalisierung ergänzt.
- Produktkarten ohne Bild zeigen einen neutralen Platzhalter statt eines
  Fehlers.

## [1.0.0-rc.37] – 2026-11-17

### Hinzugefügt

- **Live-Suche in der Produktliste:** Die Suche nach Name, SKU und Slug
  aktualisiert die Ansicht beim Tippen, ohne die Seite neu zu laden. Der
  Fokus bleibt im Suchfeld, der Suchbegriff steht in der URL.
- „Alle auswählen“ und die Massenlöschung werden nach jeder Suche neu
  gebunden und funktionieren auch mit gefilterten Ergebnissen.

## [1.0.0-rc.36] – 2026-11-17

### Geändert

- **Aktionen in Admin-Tabellen:** Die bisherigen großen Buttons in der Spalte
  „Aktionen“ wurden durch kompakte, quadratische Symbolschaltflächen ersetzt
  (Produkte, Kategorien, Nachrichten). Jede Schaltfläche zeigt ein
  Outline-Symbol und beim Überfahren oder bei Tastaturfokus einen Tooltip mit
  dem Aktionsnamen.
- Neutrale Aktionen erscheinen dunkelgrau, bestätigende Aktionen grün und
  löschende bzw. ablehnende Aktionen rot. Die Schaltflächen tragen zusätzlich
  einen Screenreader-Text.

## [1.0.0-rc.35] – 2026-11-17

### Hinzugefügt

- **Testdaten zurücksetzen:** Bestellungen, Zahlungen, Zahlungsereignisse,
  Angebotsanfragen samt Modelldateien, Kontaktnachrichten sowie
  Spam-Beobachtungen lassen sich vor dem Livegang endgültig löschen.
  Bestätigung über eine separate Seite mit Eingabe von `LÖSCHEN`.
- Der Vorgang ist gesperrt, solange der Shop live ist, und wird im
  Audit-Protokoll mit den gelöschten Anzahlen vermerkt.
- Produkte, Preise, Bilder, Stammdaten, Einstellungen und Benutzer bleiben
  erhalten.

### Geändert

- Die Suche in Bestell- und Anfragenliste startet automatisch beim Tippen,
  ohne die Seite neu zu laden. Der Button „Filtern“ entfällt bei aktivem
  JavaScript.

## [1.0.0-rc.34] – 2026-11-17

### Geändert

- Dashboard-Kachel **Offene Bestellungen** verlinkt auf den Sammelfilter
  „Offene“ (Neu, Bezahlt, In Druck) statt nur auf „Neu“.
- Bestellliste: neuer Sammelfilter **Offene** im Status-Dropdown.
- Status- und Zahlungsfilter aktualisieren die Ansicht sofort bei der Auswahl.
  Dasselbe gilt für den Statusfilter der Anfragen.

## [1.0.0-rc.33] – 2026-11-17

### Hinzugefügt

- **Kompakte Nachrichtenliste:** Kontaktnachrichten werden als Tabelle mit
  Status, Datum, Absender, Betreff, Land und kompakten Aktionsbuttons
  dargestellt. Ein Klick auf die Zeile öffnet die Detailseite.
- **Detailseite für Nachrichten:** vollständige Nachricht, Absenderdaten,
  Prüfgrund, pseudonyme IP-Auswertung, Antwortverlauf und Antwortformular.
- **Massenaktionen:** als erledigt markieren, wieder öffnen,
  freigeben/kein Spam, als Spam markieren und endgültig löschen. Löschen
  erfolgt über eine Bestätigungsseite.
- Statusfilter für alle, offene, zu prüfende, Spam- und erledigte Nachrichten.

### Geändert

- Dashboard verlinkt die letzten Nachrichten direkt auf die Detailseite.

## [1.0.0-rc.32] – 2026-11-17

### Geändert

- Absenderkennung (IP-Prüfsumme, gekürzte IP-Adresse und Browser) wird nur
  noch bei Nachrichten im Prüfmodus gespeichert. Normale Kontaktanfragen
  bleiben ohne diese Angaben (Datenminimierung).

## [1.0.0-rc.31] – 2026-11-17

### Hinzugefügt

- **Automatische Absender-Sperre:** Wiederholte auffällige Kontaktversuche
  werden pseudonymisiert gezählt; nach 3 oder 5 Versuchen innerhalb eines
  Zeitfensters wird der Absender für die eingestellte Dauer gesperrt.
  Gesperrte Absender erhalten HTTP 429, werden nicht gespeichert und lösen
  keine Benachrichtigung mehr aus.
- **Absender-Erkennung im Admin:** Gekürzte IP-Adresse (IPv4 /24, IPv6 /48),
  nicht rückführbare HMAC-Prüfsumme, Browserkennung, Land, Versuche und
  Zeitpunkt. Aktive Sperren lassen sich unter **Admin → Nachrichten**
  aufheben.
- **Benachrichtigungen pro Ereignis:** Neue Kontaktnachricht, Prüfhinweis,
  Angebotsanfrage, Bestellung, Zahlungseingang, Zahlung nach Stornierung und
  Systemüberwachung lassen sich unter **Admin → Benachrichtigungen** einzeln
  ein- und ausschalten.
- Prüfhinweise werden höchstens einmal pro Absender und Tag sowie bei einer
  neuen Sperre versendet.

### Geändert

- Datenschutzerklärung um die pseudonyme Spam-Abwehr ergänzt (gekürzte IP,
  Prüfsumme, Browserkennung; reine Beobachtungen 30 Tage).
- Cleanup entfernt zusätzlich alte Spam-Beobachtungen und abgelaufene Sperren.

## [1.0.0-rc.30] – 2026-11-15

### Hinzugefügt

- **24-Monats-Löschung für Anfragen:** Der tägliche Cleanup löscht
  Angebotsanfragen und Kontaktnachrichten nach 24 Monaten; Modelldateien
  weiterhin nach 90 Tagen. Bestelldaten bleiben unberührt.
- Manuell steuerbar über `npm run uploads:cleanup -- --days 90 --inquiry-months 24`.

## [1.0.0-rc.29] – 2026-11-15

### Hinzugefügt

- **Automatische Löschung alter Modell-Uploads:** Täglicher systemd-Timer
  entfernt Modelldateien aus Angebotsanfragen nach 90 Tagen; Anfrage- und
  Kontaktdaten bleiben erhalten. Zusätzlich werden verwaiste Uploads
  aufgeräumt. Manuell: `npm run uploads:cleanup -- --dry-run`.
- Etsy-API-Importmaske entfernt, nachdem Etsy die Freigabe abgelehnt hat;
  CSV-Import bleibt verfügbar.

### Geändert

- Länder-Allowlist bestätigt: DE, AT und CH zugelassen, übrige Länder zur
  Prüfung.
- Telegram-Ereignisse bleiben unverändert (keine Erweiterung gewünscht).

## [1.0.0-rc.28] – 2026-11-15

### Behoben

- **Favicon-Kompatibilität:** Zusätzlich zu `/favicon.ico` werden
  `/favicon.png`, `/apple-touch-icon.png` und
  `/apple-touch-icon-precomposed.png` mit dem transparenten PNG bedient.
  Layouts setzen zusätzlich `shortcut icon` und `sizes="180x180"`.
- Behebt Browser, die statt des `<link rel="icon">` einen der alten
  Standardpfade abfragen.

## [1.0.0-rc.27] – 2026-11-15

### Behoben

- **Favicon behält Transparenz:** Das Favicon wird nicht mehr über die
  JPEG-Bildstrecke gespeichert, sondern direkt als transparentes PNG
  (180 × 180, RGBA) unter `/site-media/…` abgelegt.
- Bestehende Favicons im alten JPEG-Format müssen nach dem Update einmal
  neu hochgeladen werden, damit der transparente Hintergrund erhalten bleibt.
- Admin-Vorschau zeigt `/site-media/…png` direkt an.

## [1.0.0-rc.26] – 2026-11-15

### Behoben

- **Favicon wird als PNG ausgeliefert:** `/favicon.ico` erzeugt aus dem
  hinterlegten Bild ein quadratisches PNG. Browser, die JPEG-Favicons
  ignorieren, zeigen das neue Icon dadurch zuverlässig an.
- Cache-Busting über `?v=<Dateiname>`; nach einem neuen Upload ändert sich
  die Icon-URL automatisch.

## [1.0.0-rc.25] – 2026-11-15

### Hinzugefügt

- **Favicon unter Stammdaten → Bilder:** PNG/JPG/WebP bis 5 MB hochladen,
  zuschneiden, ersetzen und auf das Standard-Favicon zurücksetzen.
- Das Favicon wird im Browser-Tab und als Apple-Touch-Icon verwendet;
  `/favicon.ico` leitet auf die hinterlegte Datei um.

## [1.0.0-rc.24] – 2026-11-15

### Geändert

- **Statusmeldungen als HTML-Mail:** Bestell- und Anfrage-Statusmails nutzen
  das gemeinsame Layout mit Statusübersicht, Bestell-/Anfragelink und
  rechtlichen Links. Text-Fallback bleibt erhalten.
- **Zahlungsbestätigungen als HTML-Mail:** Kunde und Betreiber erhalten
  übersichtliche Zahlungs- und Positionsdaten mit Link zur Bestellung.

## [1.0.0-rc.23] – 2026-11-15

### Hinzugefügt

- **Direkter Download-Link in der Anfrage-Mail:** Die Betreiber-Benachrichtigung
  enthält einen Link zur Modelldatei und zur Anfrage im Admin. Der Download
  ist nur nach Admin-Anmeldung möglich.
- **HTML-E-Mails mit Text-Fallback:** Einheitliches, übersichtliches Layout für
  Anfrage-, Bestell-, Kontakt- und Bestätigungsmails mit Tabellen, Summen und
  klaren Handlungsbuttons.

## [1.0.0-rc.22] – 2026-11-15

### Hinzugefügt

- **Automatische Eingangsbestätigung für das Kontaktformular:** Der Absender
  erhält eine E-Mail mit dem Anliegen und Links zu AGB, Widerrufsbelehrung,
  PDF-Widerrufsformular und Datenschutz. Bei abgelehnten Spam-Nachrichten
  wird keine Bestätigung versendet.

## [1.0.0-rc.21] – 2026-11-15

### Hinzugefügt

- **Kasse:** Hinweis zur gewählten Zahlungsart erscheint direkt darunter und
  erläutert Weiterleitung bzw. Vorkasse (ohne JavaScript bleibt ein
  allgemeiner Hinweis sichtbar).
- **Kontaktantwort:** Manuelle Antworten aus dem Admin enthalten Links zu
  AGB, Widerrufsbelehrung und PDF-Widerrufsformular.

### Geändert

- **Bestätigt und dokumentiert:** WordPress-Altbestand entfernt, Rechtstexte
  anwaltlich geprüft, steuerliche Aufbewahrungsfristen bestätigt.
- LUCID-Registrierung und Systembeteiligung als erledigt bestätigt.

## [1.0.0-rc.20] – 2026-11-15

### Geändert

- **LUCID:** Registrierung und Systembeteiligung für Verkaufsverpackungen als
  erledigt dokumentiert; Hinweis im Adminbereich „Veröffentlichung“ angepasst.

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

[1.0.0-rc.38]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.38
[1.0.0-rc.37]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.37
[1.0.0-rc.36]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.36
[1.0.0-rc.35]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.35
[1.0.0-rc.34]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.34
[1.0.0-rc.33]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.33
[1.0.0-rc.32]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.32
[1.0.0-rc.31]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.31
[1.0.0-rc.30]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.30
[1.0.0-rc.29]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.29
[1.0.0-rc.28]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.28
[1.0.0-rc.27]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.27
[1.0.0-rc.26]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.26
[1.0.0-rc.25]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.25
[1.0.0-rc.24]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.24
[1.0.0-rc.23]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.23
[1.0.0-rc.22]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.22
[1.0.0-rc.21]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.21
[1.0.0-rc.20]: https://github.com/Super-AK/3d-mir/releases/tag/v1.0.0-rc.20
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
