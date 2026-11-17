# Admin-Bereich

Der Admin-Bereich liegt unter `/admin/`. Zugang erhält der Betreiber über:

```bash
sudo -u mir3d npm run admin:create -- --email admin@example.de --name "Betreiber"
```

Das Passwort wird interaktiv gesetzt oder einmalig über `ADMIN_PASSWORD` übergeben. Es wird nicht im Repository gespeichert.

## Navigation

Die Verwaltung nutzt eine feste Seitenleiste, die nach Aufgaben gruppiert ist:

- **Übersicht:** Dashboard
- **Verkauf:** Bestellungen, Anfragen, Nachrichten
- **Katalog:** Produkte, Kategorien, Preise
- **Website:** Stammdaten, Rechtstexte, Veröffentlichung
- **Einstellungen:** Zahlungen, Benachrichtigungen, Testdaten

Auf Bildschirmen unter 1000 px wird die Seitenleiste über die Schaltfläche **Menü** im Kopfbereich ein- und ausgeklappt; nach dem Öffnen einer Seite schließt sie sich automatisch. Ohne JavaScript bleibt die Navigation geöffnet und vollständig nutzbar.

### Aktionen in Tabellen

In den Listen unter **Produkte**, **Kategorien** und **Nachrichten** stehen die Aktionen als kompakte, quadratische Symbolschaltflächen in der Spalte **Aktionen**. Beim Überfahren mit der Maus oder bei Tastaturfokus erscheint der jeweilige Aktionsname als Tooltip.

- Dunkelgraue Symbole kennzeichnen neutrale Aktionen wie Öffnen, Kopieren oder Exportieren.
- Grüne Symbole kennzeichnen bestätigende Aktionen wie Speichern, Erledigt, Wieder öffnen, Freigeben oder Sperre aufheben.
- Rote Symbole kennzeichnen löschende oder ablehnende Aktionen wie Löschen oder Spam.

Die Symbole tragen zusätzlich einen unsichtbaren Beschreibungstext für Screenreader.

## Stammdaten

Unter **Admin → Stammdaten** werden die öffentlichen Geschäftsangaben und Bilder gepflegt:

| Bereich | Inhalte |
| --- | --- |
| Geschäftsdaten | Kurzname, vollständiger Name, Inhaber, Straße, PLZ, Ort, Land, Ländercode, Telefon, Telefon-Link, E-Mail, Steuerhinweis, Kleinunternehmer |
| Kanäle | Etsy-Shop-URL und Bewertungs-URL, Kleinanzeigen-Bezeichnung und -URL |
| Kontakt/SEO | Antwortzeit, Abholhinweis, SEO-Name, Seitentitel und Beschreibung der Startseite |
| Bilder | Logo und Favicon (PNG/JPG/WebP, max. 5 MB), Hero-Bild, Service-Bild, Material-Bild (Leistungen), Rechner-Bild, Galerie mit bis zu 8 Bildern |
| Startseite | Kicker, Überschrift und Einleitungstext im Hero sowie Überschrift und Text des Kontaktbereichs |

Änderungen wirken sofort auf Website, Footer, Rechtsseiten, E-Mails und JSON-LD; ein Neustart ist nicht nötig. Die Werte werden in der Tabelle `settings` unter dem Schlüssel `site.settings` gespeichert und überlagern `config/site.json`. „Auf Standard zurücksetzen“ entfernt das Logo bzw. einzelne Bilder; die mitgelieferten Motive werden dann wieder verwendet.

Hochgeladene Logos liegen unter `/var/lib/3d-mir/uploads/site/` und werden über `/site-media/…` ausgeliefert. Hero-, Service-, Material-, Rechner- und Galeriebilder werden wie Produktbilder in AVIF/WebP/JPEG umgewandelt und unter `/media/site/…` bereitgestellt.

Jedes Bild – einschließlich Favicon – trägt ein Stiftsymbol. Es öffnet ein Modalfenster, in dem die Datei per Klick ausgewählt oder hineingezogen wird. Für das Favicon wird ein quadratisches PNG (z. B. 512 × 512 px) empfohlen; es erscheint im Browser-Tab und als Apple-Touch-Icon. Hochgeladen wird erst mit **Speichern**; während der Übertragung erscheint ein Fortschrittsbalken.

- **Zuschneiden:** Nach der Auswahl lässt sich der Bildausschnitt direkt im Fenster verschieben und an den Ecken verkleinern. **Ausschnitt zurücksetzen** verwendet wieder das ganze Bild. Wird nichts verschoben, wird die Originaldatei ohne erneute Kodierung hochgeladen.
- **Galerie:** mehrere Bilder gleichzeitig auswählen, Vorschau prüfen, einzelne Bilder oder die ganze Auswahl entfernen. **Vorhandene eigene Galerie ersetzen** tauscht die bisherigen Bilder aus.
- **Reihenfolge und Alternativtexte:** In der Galerie-Liste lässt sich die Reihenfolge am Griff per Drag & Drop oder mit den Pfeiltasten ändern. Jedes Bild hat ein Feld für den Alternativtext; gespeichert wird mit **Reihenfolge und Alternativtexte speichern**. Die Texte erscheinen auf der Startseite in `alt` und werden von Screenreadern und Suchmaschinen genutzt.
- Ist JavaScript deaktiviert, steht ein klassisches Formular im `<noscript>`-Bereich bereit.

Für die Galerie gibt es drei Zustände:

- **Standardgalerie:** es sind keine eigenen Bilder gespeichert; die acht mitgelieferten Motive werden verwendet.
- **Eigene Galerie:** hochgeladene Bilder werden an die eigene Galerie angehängt (maximal 8). Die Checkbox „Vorhandene eigene Galerie vor dem Hochladen entfernen“ ersetzt die bisherigen Bilder; die erste Upload-Serie ersetzt die Standardgalerie.
- **Keine Galerie:** alle eigenen Bilder wurden entfernt; der Referenzbereich wird auf der Startseite ausgeblendet. Über **„Standardgalerie wiederherstellen“** lassen sich die mitgelieferten Bilder zurückholen.

## Rechtstexte und Platzhalter

Unter **Admin → Rechtstexte** werden die ausfüllbaren Stellen in den Rechtsseiten gepflegt:

| Platzhalter | Erscheint in | Beispielwert |
| --- | --- | --- |
| Hosting-Anbieter | Datenschutz, Abschnitt Hosting | Musterhosting GmbH, Musterstraße 1, 12345 Musterstadt (AVV liegt vor) |
| SMTP-/E-Mail-Dienstleister | Datenschutz, Abschnitt Kontakt | Muster-Mail GmbH, Musterstadt (AVV liegt vor) |
| Versanddienstleister | Datenschutz, Abschnitt Versand | DHL Paket GmbH, Bonn (AVV liegt vor) |
| Löschfrist Modell-Uploads | Datenschutz, Abschnitt Rechner | 90 Tagen |

Solange ein Feld leer ist, erscheint der TODO-Text auf der Seite als **gelb markierter Platzhalter**. Nach dem Speichern steht der eingegebene Wert an derselben Stelle; die gelbe Markierung verschwindet. Die Werte liegen in der Tabelle `settings` unter `legal.placeholders`.

Die gelben Markierungen sind ein redaktioneller Hinweis und ersetzen keine rechtliche Prüfung. Vor dem Livegang sollten alle Felder ausgefüllt und die Texte insgesamt geprüft werden.

## Preise und Katalog

Unter **Admin → Preise** lassen sich alle Preis- und Katalogdaten pflegen:

| Bereich | Bearbeiten | Löschen | Neu anlegen |
| --- | --- | --- | --- |
| Grundwerte | Mindestauftragswert, Rüstkosten, Rundung, Wandstärke, Durchsatz, Verschnitt | – | – |
| Materialien | Bezeichnung, Dichte, Preis je Gramm, Maximaltemperatur, Farben, Eigenschaften, Anwendungen, Hinweise | ✓ | ✓ |
| Drucker | Bezeichnung, Bauraum X/Y/Z, Maschinenstunde, Materialzuordnung, Hinweis | ✓ | ✓ |
| Nachbearbeitung | Bezeichnung, Zuschlag in Prozent, Preis je Teil | ✓ | ✓ |
| Versand | Bezeichnung, Preis, Lieferzeit | ✓ | ✓ |
| Versandoptionen | Bezeichnung, Preis, Hinweis (z. B. Express, Geschenkverpackung) | ✓ | ✓ |
| Mengenrabatt | Staffel ab Stückzahl, Rabatt in Prozent | ✓ | ✓ |

**Speichern:** Alle Änderungen werden mit einer Schaltfläche am Seitenende gespeichert. Löschmarkierungen gelten erst beim Speichern.

**Neu anlegen:** Die Zeile „Neues …“ am Ende jeder Tabelle ausfüllen. Über die Schaltfläche **„+ Weiteres …“** lassen sich beliebig viele weitere Neu-Zeilen einfügen und in einem Speichervorgang anlegen. Eine leere Zeile wird ignoriert. Die ID wird aus der Bezeichnung erzeugt (`PLA Tough` → `pla-tough`) und bei Bedarf durchnummeriert. Ohne JavaScript bleibt die erste Neu-Zeile je Tabelle nutzbar.

### Platzhalter-Hinweise abschalten

Unter **Admin → Veröffentlichung** lassen sich die Hinweise nach fachlicher Prüfung ausblenden:

| Schalter | Wirkung |
| --- | --- |
| Shop ist live | Entfernt „Der Shop befindet sich im Aufbau …“ auf Shop-, Produkt-, Warenkorb- und Kassenseite. |
| Preise und Kalkulation sind bestätigt | Entfernt die Platzhalter-Warnung im Admin unter „Preise“. |
| Versandkosten und Lieferzeiten sind bestätigt | Entfernt den Hinweis auf `/versand/`. |
| Entwurfshinweis anzeigen | Steuert den Prüfhinweis auf Impressum, AGB, Datenschutz, Widerruf, Versand und Zahlung. |

Die Einstellungen werden in der Datenbank (`settings`, Schlüssel `publication.settings`) gespeichert und überlagern die Statuswerte aus `config/shop.json`, `config/pricing.json` und `config/site.json`. Ein Neustart ist nicht nötig. Falls nach einer Bestätigung noch ein alter Override aktiv ist, setzt die Migration `010_publication_shipping_final.sql` den Versandstatus einmalig auf `FINAL`.

Rechtstexte sollten erst nach rechtlicher Prüfung freigegeben werden. Die TODO-Marker in den Texten (z. B. `TODO-VERSAND` in der Datenschutzerklärung) werden durch den Schalter nicht ersetzt – sie müssen im Text selbst entfernt werden.

Die Hinweise auf `/leistungen/` („Bauraum-Angaben sind Richtwerte …“) und der Schätzhinweis im Rechner sind keine Platzhalter, sondern dauerhafte fachliche Hinweise.

## Testdaten zurücksetzen

Unter **Admin → Testdaten** lassen sich die Daten aus der Testphase vor dem Livegang endgültig löschen:

| Bereich | Gelöscht werden |
| --- | --- |
| Bestellungen | Bestellungen mit Positionen, Optionen, Zahlungen und Statusverlauf |
| Zahlungen | Zahlungsereignisse (z. B. Stripe-Testwebhooks) |
| Anfragen | Angebotsanfragen mit Statusverlauf und hochgeladenen Modelldateien |
| Nachrichten | Kontaktnachrichten |
| Spam-Schutz | Beobachtete Absender und aktive Sperren |

Damit werden auch der erfasste Umsatz und die Listen „Letzte Bestellungen“, „Letzte Anfragen“ und „Letzte Nachrichten“ im Dashboard zurückgesetzt, weil diese Werte aus den Bestell- und Anfragedaten berechnet werden.

Erhalten bleiben Produkte, Preise, Kategorien, Bilder, Stammdaten, Rechtstexte, Einstellungen, Benutzer und das Audit-Protokoll. Der Vorgang selbst wird im Audit-Protokoll mit den gelöschten Anzahlen vermerkt.

Vor dem endgültigen Löschen zeigt die Anwendung eine Bestätigungsseite mit allen Anzahlen. Zur Bestätigung muss `LÖSCHEN` eingegeben werden.

**Sperre bei aktivem Shop:** Solange unter **Veröffentlichung** der Schalter „Shop ist live“ aktiv ist, verweigert die Anwendung das Zurücksetzen. So können keine echten Bestellungen versehentlich gelöscht werden. Für einen erneuten Testlauf den Shop zuerst offline schalten.

## Kategorien

Unter **Admin → Kategorien** werden Produktkategorien angelegt, umbenannt, sortiert und gelöscht. Beim Produkt (Admin → Produkte → Produkt) lassen sich beliebig viele Kategorien anhaken.

- Die Shop-Übersicht zeigt eine Filterleiste (`/shop/?kategorie=<slug>`), Produktkarten und Produktseite zeigen die erste Kategorie.
- Ein Produkt kann mehreren Kategorien angehören (z. B. „Küche“ und „Saisonales“).
- Beim Löschen einer Kategorie werden nur die Zuordnungen entfernt, die Produkte bleiben bestehen.
- Die Migration `009_categories.sql` legt sieben Startkategorien an und ordnet bestehende Produkte anhand des Namens zu. Diese Zuordnung ist ein Vorschlag und kann jederzeit geändert werden.

**Löschen:** Mindestens ein Material, ein Drucker, eine Nachbearbeitung und eine Versandart müssen bestehen bleiben. Mengenrabattstaffeln dürfen vollständig entfernt werden. Wird ein Material gelöscht, entfernen sich seine Verknüpfungen zu Druckern automatisch.

**Aktiv:** Materialien, Drucker, Nachbearbeitung und Versandarten haben eine Checkbox „Aktiv“. Inaktive Einträge bleiben im Admin erhalten, werden aber im Rechner, im Shop, im Checkout und auf der Seite „Versandarten und Kosten“ nicht angezeigt. Mindestens ein Eintrag je Bereich muss aktiv bleiben.

**Versandseite:** Die öffentliche Seite `/versand/` wird aus den Versandarten unter „Preise → Versand“ erzeugt. Bezeichnung, Preis, Lieferzeit und die Schwelle für kostenlosen Versand erscheinen dort automatisch; inaktive Versandarten werden ausgeblendet.

**Wo liegen die Daten?** `config/pricing.json` bleibt die dokumentierte Grundeinstellung. Änderungen im Admin werden als `pricing.overrides` in der Tabelle `settings` gespeichert und überlagern die JSON-Datei ohne Neustart. Sobald ein Katalog im Admin gespeichert wurde, gilt die Datenbank als führend; „Auf Grundeinstellung zurücksetzen“ löscht die Überlagerung und stellt `config/pricing.json` wieder her.

**Hinweise:**

- Preise sind weiterhin Platzhalter, bis der Betreiber sie bestätigt.
- Gelöschte Materialien/Drucker bleiben in alten Angebotsanfragen als ID erhalten; die Anzeige fällt auf die ID zurück.
- Gelöschte Versandarten in alten Bestellungen werden ebenfalls als ID angezeigt.
- Die Materialauswahl eines Druckers steuert, für welche Materialien er im Rechner angeboten wird. Ohne Auswahl gilt der Drucker für alle Materialien.

## Zahlungen

Unter **Admin → Zahlungen** werden Bankverbindung und Zahlungsarten verwaltet.

### Bankverbindung (Vorkasse)

Kontoinhaber, IBAN, BIC und Bankname eintragen. Aus Sicherheitsgründen werden diese Daten **nicht** auf der öffentlichen Seite „Zahlungsarten“ und **nicht** auf der Bestell-Danke-Seite angezeigt. Kunden erhalten sie ausschließlich in der Bestellbestätigung per E-Mail, wenn sie „Zahlung per Vorkasse“ gewählt haben. Die Daten werden in der Datenbank (`settings`, Schlüssel `shop.settings`) gespeichert und nicht ins Repository geschrieben.

Solange keine Bankverbindung hinterlegt ist, enthält die Bestätigungs-E-Mail den Hinweis, dass die Bankverbindung separat mitgeteilt wird. Vor dem Livegang sollten die Daten vollständig sein.

### Zahlungsarten

Die Zahlungsarten sind im Code vorbereitet und werden im Admin nur aktiviert/deaktiviert sowie mit Bezeichnung, Hinweis und Reihenfolge gepflegt:

| Zahlungsart | Anbieter | Voraussetzung |
| --- | --- | --- |
| Vorkasse per Banküberweisung | manuell | Bankverbindung im Admin |
| Kredit-/Debitkarte | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | Stripe | wie Karte; PayPal im Stripe-Dashboard freischalten |
| Amazon Pay | Stripe | wie Karte; Amazon Pay im Stripe-Dashboard freischalten |
| Klarna | Stripe | wie Karte; Klarna im Stripe-Dashboard freischalten |
| iDEAL | Stripe | wie Karte; iDEAL im Stripe-Dashboard freischalten |

Stripe-Methoden erscheinen im Checkout erst, wenn beide Stripe-Geheimnisse in `/etc/3d-mir/3d-mir.env` gesetzt sind. Die Schlüssel werden nie im Repository oder in der Datenbank gespeichert.

Zahlungsseite, AGB § 5 und Datenschutz § 6 werden aus den hier aktiven Zahlungsarten erzeugt. Deaktivierte Anbieter verschwinden automatisch aus den Rechtstexten.

### Zahlungsstatus und Bestellungen

- Jede Bestellung hat zusätzlich zum Fulfillment-Status einen **Zahlungsstatus**: offen, in Bearbeitung, bezahlt, fehlgeschlagen, erstattet oder storniert.
- Bei **Vorkasse** bestätigt der Betreiber den Zahlungseingang im Bestelldetail über „Zahlungseingang bestätigen“.
- Bei **Stripe** wird der Status über den Webhook automatisch gesetzt. Die Rückleitungsseite prüft die Zahlung zusätzlich, falls der Webhook verzögert eintrifft.
- Bei fehlgeschlagener oder abgebrochener Zahlung kann der Kunde die Zahlung über die Bestellübersicht erneut starten.
- „Erstattung vermerken“ setzt den Zahlungsstatus auf „erstattet“. Die eigentliche Erstattung erfolgt im Stripe-Dashboard bzw. per Überweisung.
- Die Bestellliste lässt sich nach Bestellstatus und Zahlungsstatus filtern. Die Auswahl im Dropdown aktualisiert die Ansicht sofort.
- Die Suche startet automatisch beim Tippen. Bei aktivem JavaScript entfällt der Button „Filtern“; ohne JavaScript bleibt er als Absenden-Funktion erhalten.
- Der Sammelfilter **Offene** umfasst die Status Neu, Bezahlt und In Druck. Die Kachel **Offene Bestellungen** im Dashboard verlinkt auf genau diese Ansicht.

### Stripe-Webhook

Im Stripe-Dashboard den Endpunkt `https://www.3d-mir.de/zahlung/webhook/stripe/` anlegen und diese Ereignisse abonnieren:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Das dabei erzeugte `whsec_…`-Secret als `STRIPE_WEBHOOK_SECRET` hinterlegen. Ohne gültige Signatur lehnt die Anwendung Webhooks mit HTTP 400 ab.

Der Button **„Hilfe zu Stripe“** im Bereich Zahlungen öffnet eine Schritt-für-Schritt-Anleitung zu Konto, Zahlungsarten, Schlüsseln, Webhook, Testzahlung und Fehlersuche.

## Nachrichten

Unter **Admin → Nachrichten** erscheinen alle Anfragen aus dem Kontaktformular. Zu jeder Nachricht werden Name, E-Mail, Telefon, Land, Anliegen, Prüfstatus und Eingangsdatum angezeigt.

### Direkt antworten

Über **„Antworten“** lässt sich direkt aus dem Admin eine E-Mail an den Kunden senden. Betreff und Text werden im Formular erfasst; die Antwort geht über den konfigurierten SMTP-Versand heraus (`Reply-To` ist die Betreiberadresse). Der Versand wird in der Nachricht gespeichert und im Audit-Log vermerkt. Ohne SMTP-Konfiguration wird die Antwort als `.eml` unter `/var/log/3d-mir/mail/` abgelegt. Die ursprüngliche Nachricht wird nicht automatisch zitiert.

Nach dem Absenden des Kontaktformulars erhält der Absender automatisch eine **Eingangsbestätigung** per E-Mail. Sie enthält das Anliegen sowie Links zu AGB, Widerrufsbelehrung, Muster-Widerrufsformular (PDF) und Datenschutzerklärung. Bei als Spam eingestuften Nachrichten wird keine Bestätigung versendet.

### Automatische Löschung der Modelldateien

Der Timer `3d-mir-cleanup.timer` entfernt täglich Modelldateien nach 90 Tagen sowie Angebotsanfragen und Kontaktnachrichten nach 24 Monaten. Bestelldaten bleiben erhalten. Manuell prüfen mit `npm run uploads:cleanup -- --dry-run`; Details unter `docs/DEPLOYMENT.md`.

### Nachrichtenliste

Unter **Admin → Nachrichten** werden die Kontaktnachrichten als kompakte Tabelle dargestellt. Jede Zeile zeigt Status, Datum, Absender, Betreff und Land sowie die wichtigsten Aktionen:

- **Öffnen** oder Klick auf die Zeile öffnet die Detailseite mit der vollständigen Nachricht.
- **Erledigt / Wieder öffnen** ändert den Bearbeitungsstatus.
- **Freigeben** holt eine Nachricht aus dem Prüf- oder Spam-Status.
- **Spam** markiert eine Nachricht als Spam.
- **Löschen** öffnet eine Bestätigungsseite.

Über die Filter **Alle, Offen, Prüfung, Spam und Erledigt** lässt sich die Liste eingrenzen. Die Zahlen in den Filtern zeigen den jeweiligen Bestand.

Für Massenaktionen die gewünschten Zeilen ankreuzen, eine Aktion auswählen und **Ausführen** klicken:

| Massenaktion | Wirkung |
| --- | --- |
| Als erledigt markieren | Setzt alle ausgewählten Nachrichten auf erledigt. |
| Wieder öffnen | Setzt alle ausgewählten Nachrichten auf offen. |
| Freigeben / Kein Spam | Setzt Prüf- und Spam-Nachrichten auf „ok“ und offen; sendet eine Sammelbenachrichtigung an den Betreiber. |
| Als Spam markieren | Markiert alle ausgewählten Nachrichten als Spam und erledigt. |
| Endgültig löschen | Zeigt zuerst eine Bestätigungsseite mit allen ausgewählten Nachrichten. |

Die Detailseite enthält zusätzlich die vollständigen Absenderdaten, die pseudonyme IP-Auswertung, den Prüfgrund, die gesendete Antwort und das Antwortformular. Aktionen auf der Detailseite führen anschließend wieder dorthin zurück.

### Spam-Schutz und Länderprüfung

Der Spam-Schutz wird im aufklappbaren Bereich **„Spam-Schutz und Länderprüfung“** gepflegt:

| Einstellung | Bedeutung |
| --- | --- |
| Länderprüfung | Nur Anfragen aus den ausgewählten Ländern zulassen. Standard: nur Deutschland (`DE`). |
| Erlaubte Länder | Mehrfachauswahl aus einer festen ISO-3166-Liste. Der Besucher gibt sein Land nicht selbst an. |
| Verhalten bei Auffälligkeiten | **Zur Prüfung speichern** (empfohlen) oder **Anfrage direkt ablehnen** – gilt für bekannte, aber nicht erlaubte Länder sowie Zeit- und Inhaltsprüfung. |
| Land nicht ermittelbar | **Zur Prüfung speichern** (empfohlen), **Anfrage direkt ablehnen** oder **ohne Länderprüfung zulassen**. |
| Zeitprüfung | Das Formular muss mindestens 3 Sekunden geöffnet gewesen sein. |
| Inhaltsprüfung | Erkennt viele Links, typische Spam-Begriffe und überwiegende Großschreibung. |
| Automatische Absender-Sperre | Sperrt einen Absender nach 3 oder 5 auffälligen Versuchen innerhalb eines Zeitfensters. |
| Versuche bis zur Sperre | Auswahl zwischen **3** und **5** Versuchen. |
| Zeitfenster | Zeitraum in Minuten, in dem die Versuche gezählt werden (Standard: 60). |
| Sperrdauer | Dauer in Stunden; **0** bedeutet dauerhaft bis zur manuellen Aufhebung. |

**Woher kommt das Land?** Ausschließlich serverseitig, nie aus einer Besuchereingabe:

1. Wurde in der Umgebungsdatei ein `COUNTRY_HEADER` (z. B. `cf-ipcountry`) ausdrücklich konfiguriert und stammt die Verbindung von einem in `TRUST_PROXY` eingetragenen Proxy, wird dieses Länderkürzel verwendet. Ohne diese Konfiguration werden Header ignoriert, damit ein Besucher das Land nicht über einen selbst gesetzten Header fälschen kann.
2. Andernfalls wird die IP-Adresse des Besuchers gegen eine lokale GeoIP-Datenbank im MaxMind-Format geprüft (Standardpfad `/var/lib/3d-mir/geoip/dbip-country-lite.mmdb`).
3. Ist beides nicht möglich, greift die Einstellung **„Land nicht ermittelbar“**.

Die Datenbank wird mit `sudo deploy/update-geoip.sh` installiert bzw. aktualisiert (Quelle: DB-IP Lite, CC BY 4.0) und sollte monatlich erneuert werden. Im Admin-Bereich zeigt ein Hinweis, ob die Datenbank gefunden wurde und welcher Pfad verwendet wird. Es werden keine IP-Adressen an externe Dienste übermittelt.

Zusätzlich schützen ein Honeypot-Feld, ein Rate-Limit und ein signiertes Zeit-Token (HMAC mit `SESSION_SECRET`, 24 Stunden gültig) vor automatisierten Anfragen.

### Absender erkennen und sperren

Bei jedem auffälligen Versuch (falsches Land, zu schnelles Absenden, Spam-Inhalt oder Honeypot) zählt der Server den Absender pseudonymisiert:

- Gespeichert werden eine **HMAC-Prüfsumme** der IP-Adresse, eine **gekürzte IP-Adresse** (IPv4 `/24`, IPv6 `/48`) und die **Browserkennung** (User-Agent). Die vollständige IP-Adresse wird nicht gespeichert.
- Erreicht ein Absender die eingestellte Zahl an Versuchen, wird er für die gewählte Dauer gesperrt. Weitere Anfragen werden mit HTTP `429` abgewiesen, nicht gespeichert und lösen keine Benachrichtigung aus.
- Im Bereich **„Gesperrte und auffällige Absender“** unter **Admin → Nachrichten** stehen Status, Land, Versuche, letzter Zeitpunkt und Browser. Aktive Sperren lassen sich dort mit **Sperre aufheben** zurücksetzen.
- Reine Spam-Beobachtungen und abgelaufene Sperren werden nach **30 Tagen** ohne Aktivität automatisch entfernt.

Der Prüfhinweis wird außerdem **höchstens einmal pro Absender und Tag** versendet; bei einer neuen Sperre kommt eine zusätzliche Meldung. Dadurch entstehen bei wiederholten Versuchen nicht mehr für jeden einzelnen Versuch neue Benachrichtigungen.

Im Prüfmodus wird eine auffällige Nachricht gespeichert, aber **nicht** automatisch an den Betreiber weitergeleitet. Stattdessen erhält der Betreiber einen kurzen Prüfhinweis. Im Admin kann die Nachricht anschließend **freigegeben** (dann wird die normale Benachrichtigung nachgeholt) oder **als Spam markiert** werden. Als Spam markierte Nachrichten bleiben zur Nachvollziehbarkeit erhalten und werden aus der offenen Zählung herausgenommen.

Die Einstellungen liegen in der Tabelle `settings` unter dem Schlüssel `contact.settings`; es gibt keine Umgebungs-Fallbacks.

## Benachrichtigungen

Unter **Admin → Benachrichtigungen** wird festgelegt, wie der Betreiber über neue Bestellungen, Kontaktanfragen, Angebotsanfragen und Zahlungseingänge informiert wird.

### Kanal wählen

| Kanal | Bedeutung |
| --- | --- |
| Nur E-Mail | Benachrichtigungen gehen ausschließlich an das Betreiber-Postfach. |
| Nur Telegram | Benachrichtigungen gehen ausschließlich per Telegram. |
| E-Mail und Telegram | Benachrichtigungen werden über beide Kanäle versendet. |

Kunden-E-Mails (Bestellbestätigung, Zahlungsbestätigung, Statusmeldungen) gehen **immer per E-Mail** heraus, unabhängig von der Kanalwahl. Die Kanalwahl betrifft nur Benachrichtigungen an den Betreiber.

### Ereignisse einzeln auswählen

Unter **„Benachrichtigungen an mich“** lässt sich jede Benachrichtigungsart einzeln ein- oder ausschalten:

| Ereignis | Inhalt |
| --- | --- |
| Neue Kontaktnachricht | Normale Anfrage aus dem Kontaktformular. |
| Kontaktnachricht zur Prüfung | Spam-Verdacht, nicht freigegebenes Land oder zu schnelles Absenden. Wird höchstens einmal pro Absender und Tag sowie bei einer neuen Sperre gemeldet. |
| Neue Angebotsanfrage | Anfrage aus dem 3D-Druck-Rechner inklusive Modell-Datei. |
| Neue Bestellung | Bestellung aus dem Shop. |
| Zahlungseingang | Bestätigte Zahlung zu einer Bestellung. |
| Zahlung nach Stornierung | Zahlung zu einer bereits stornierten Bestellung. |
| Systemüberwachung | Website nicht erreichbar oder wieder erreichbar. |

Die Auswahl gilt für E-Mail und Telegram gleichermaßen. Kunden-E-Mails sind davon nicht betroffen. Die Werte liegen in der Tabelle `settings` unter dem Schlüssel `notifications` im Feld `events`.

Benachrichtigungen, Statusmeldungen und Bestätigungen werden als HTML-E-Mail mit Text-Fallback versendet. Die Benachrichtigung zu einer Angebotsanfrage enthält einen **direkten Download-Link** zur hochgeladenen Modelldatei sowie einen Link zur Anfrage im Admin. Der Download ist nur nach Anmeldung im Admin-Bereich möglich.

### E-Mail-Versand (SMTP)

Folgende Felder werden gepflegt:

- SMTP-Server und Port
- Benutzername und Passwort
- SSL/TLS direkt ab Verbindungsaufbau (meist Port 465; für Port 587 nicht aktivieren)
- Absender und Betreiber-Postfach

Das Passwort wird nicht im Klartext angezeigt. Leer lassen, um das gespeicherte Passwort zu behalten.

Mit **Kopie jeder Kunden-E-Mail an das Betreiber-Postfach** gehen Bestellbestätigungen, Angebotsbestätigungen und weitere Kundenmails zusätzlich als BCC an das Betreiber-Postfach. Benachrichtigungen an den Betreiber selbst werden nicht doppelt kopiert.

Ohne SMTP-Konfiguration werden E-Mails als `.eml` unter `/var/log/3d-mir/mail/` gespeichert. Die Werte können auch über die Umgebungsvariablen `SMTP_*`, `MAIL_FROM` und `MAIL_TO` gesetzt werden; Admin-Einstellungen haben Vorrang.

### Telegram

1. In Telegram **@BotFather** öffnen und mit `/newbot` einen Bot anlegen.
2. Den angezeigten Bot-Token kopieren.
3. Den Bot in Telegram anschreiben.
4. Die Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates` ermitteln (`chat.id`).
5. Bot-Token und Chat-ID unter **Admin → Benachrichtigungen** eintragen und speichern.
6. **„Test-Telegram senden“** anklicken.

Für Gruppen beginnt die Chat-ID meist mit `-100…`; der Bot muss Mitglied der Gruppe sein.

### Testnachrichten

- **Test-E-Mail senden:** verwendet die gespeicherte SMTP-Konfiguration.
- **Test-Telegram senden:** verwendet Bot-Token und Chat-ID.

Fehler werden im Admin angezeigt und im Anwendungslog protokolliert.

### Sicherheit

Bot-Token und SMTP-Passwort sind Geheimnisse. Sie werden in der SQLite-Datenbank gespeichert und sind in Backups enthalten. Backups müssen entsprechend geschützt und extern verschlüsselt aufbewahrt werden. Die Werte niemals im Repository oder in Chats veröffentlichen.

## Produkte und Bilder

Unter **Admin → Produkte** lassen sich Produkte, Farbvarianten und Bilder pflegen.

### Suche

Die Produktliste lässt sich nach **Name**, **SKU** und **Slug** durchsuchen. Die Suche startet automatisch beim Tippen und tauscht nur den Ergebnisbereich aus; die Seite wird nicht neu geladen und der Fokus bleibt im Suchfeld. Bei aktivem JavaScript entfällt der Button **Filtern**; ohne JavaScript bleibt er als Absenden-Funktion erhalten. Der Suchbegriff steht in der URL (`?q=…`) und lässt sich daher teilen oder neu laden. „Alle auswählen“ und die Massenlöschung funktionieren auch nach einer Suche.

### Löschen, Kopieren, Import und Export

- **Löschen:** Über „Löschen“ in der Produktzeile öffnet sich eine Bestätigungsseite. Gelöscht werden Produkt, Varianten und Bilder; bestehende Bestellungen bleiben mit ihren Positionsdaten erhalten.
- **Massenlöschung:** Produkte in der Liste markieren (oder „Alle auswählen“) und „Ausgewählte löschen“ klicken. Es folgt eine Bestätigungsseite mit allen betroffenen Produkten.
- **Kopieren:** Legt eine vollständige Kopie inklusive Varianten und Bildern an. Name erhält „(Kopie)“, der Slug ein eindeutiges Suffix; die Kopie ist zunächst **inaktiv**.
- **Exportieren:** „Exportieren“ lädt alle Produkte als JSON herunter; pro Zeile gibt es zusätzlich einen Einzel-Export. Enthalten sind Produktdaten, Varianten und Bilder (hochgeladene Bilder als Base64-JPG).
- **Importieren:** JSON-Datei über „Importieren“ hochladen (max. 20 MB). Produkte werden neu angelegt, vorhandene Slugs automatisch durchnummeriert (`-2`, `-3`, …). Bilder werden beim Import erneut in AVIF/WebP/JPG umgewandelt. Der Import überschreibt keine bestehenden Produkte.

Das JSON-Format hat die Kennung `3d-mir-products`, Version `1`, und ein Array `products` mit Produkt-, Varianten- und Bilddaten. Ein Export kann unverändert wieder importiert werden (erzeugt dann Kopien mit neuen Slugs).

### Produkte aus Etsy übernehmen

Der Import ist direkt im Admin unter **Produkte → „Aus Etsy importieren“** verfügbar – entweder als CSV-Upload oder über die Etsy-API (Keystring und Shared Secret). Ein Testlauf ist standardmäßig aktiv. Der Import läuft im Hintergrund und kann wegen der Bilder mehrere Minuten dauern; die Seite zeigt die Ausgabe automatisch an. Es läuft immer nur ein Import gleichzeitig.

Alternativ per Kommandozeile. Etsy stellt im Shop Manager einen CSV-Export der aktiven Listings bereit:

1. Etsy → **Shop Manager → Einstellungen → Optionen → Daten herunterladen**.
2. Unter **Currently for Sale Listings** auf **Download CSV** klicken.
3. Die Datei auf den Server kopieren, z. B. nach `/tmp/etsy-listings.csv`.
4. Import als Dienstbenutzer starten:

```bash
sudo -u mir3d npm run etsy:import -- --file /tmp/etsy-listings.csv --dry-run
sudo -u mir3d npm run etsy:import -- --file /tmp/etsy-listings.csv
```

Der Import übernimmt Titel, Beschreibung, Preis, Bestand, SKU, Materialien, Schlagwörter und alle Bild-URLs (Sammelspalte oder `BILD1`…`BILD10`, bis zu 12 Bilder je Produkt). Bilder werden heruntergeladen und lokal in AVIF/WebP/JPEG umgewandelt. Pro Produkt wird eine Standardvariante mit dem Listenpreis angelegt. Der Import ist idempotent: vorhandene Produkte mit gleicher SKU oder gleichem Slug werden übersprungen; mehrfach exportierte Listings werden zusammengeführt.

Der CSV-Export enthält **Variationsnamen und -werte, aber keine Preise je Kombination**. Der Import übernimmt die Optionen deshalb als Text in der Beschreibung und legt eine Standardvariante an. Exakte Varianten mit eigenem Preis und Bestand liefert erst der API-Import (siehe unten). Die Währung muss `EUR` sein; andere Währungen werden übersprungen, um keine erfundenen Wechselkurse zu verwenden.

#### Import über die Etsy-API (inkl. Variationen)

Mit einem Etsy-Entwicklerzugang lassen sich alle aktiven Listings inklusive Variationen direkt abrufen. Benötigt werden **Keystring und Shared Secret** derselben App von [etsy.com/developers/your-apps](https://www.etsy.com/developers/your-apps):

```bash
sudo -u mir3d env ETSY_API_KEY='keystring:shared_secret' \
  npm run etsy:import -- --api --shop 3DlMIR --dry-run
sudo -u mir3d env ETSY_API_KEY='keystring:shared_secret' \
  npm run etsy:import -- --api --shop 3DlMIR
```

Der Schlüssel wird nur für den Importprozess übergeben und nicht im Repository gespeichert. Die API liefert zusätzlich die Variationen (z. B. Farbe/Größe) mit eigenen Preisen und Beständen. Schlägt der Inventory-Abruf fehl, wird pro Produkt eine Standardvariante angelegt.

### Produktdaten

Name, Slug, Kurz- und Langbeschreibung, Preise, SKU, Gewicht, Maße, Lagerbestand, Sortierung und Sichtbarkeit. Der Slug bestimmt die URL `/shop/<slug>/`.

Die Preisanzeige im Shop wird aus den Farbvarianten berechnet: Gibt es unterschiedliche Variantenpreise, steht dort „ab <kleinster Preis>“; sind alle Preise gleich oder gibt es keine Varianten, steht ein einzelner Preis. Auf der Produktseite erscheint zunächst „ab …“ und nach Auswahl einer Farbe der konkrete Variantenpreis.

### Versandarten und Versandoptionen pro Produkt

Im Produktformular gibt es die Bereiche **Versandarten** und **Versand-Zusatzoptionen**:

- **Versandarten:** Nur die ausgewählten Versandarten werden für dieses Produkt im Checkout angeboten. Ohne Auswahl gelten alle aktiven Versandarten.
- **Versandoptionen:** Zusatzleistungen wie „Expressversand“ oder „Geschenkverpackung“, die unter „Preise → Versandoptionen“ angelegt werden. Sie erscheinen im Checkout nur bei Produkten, denen sie zugeordnet wurden, und werden mit ihrem Preis auf die Bestellung addiert.
- Bei Warenkörben mit mehreren Produkten werden nur Versandarten angeboten, die für alle Produkte erlaubt sind. Versandoptionen werden angeboten, wenn mindestens ein Produkt sie unterstützt; sie werden pro Bestellung einmal berechnet.
- Inaktive Versandarten oder Optionen werden im Shop und Checkout nicht angeboten, bleiben aber im Admin zur Bearbeitung sichtbar.

### Farbvarianten

Varianten werden direkt in der Tabelle bearbeitet, ergänzt oder per Löschmarkierung entfernt. Der Lagerbestand ist optional; ist er gesetzt, prüft die Kasse die verfügbare Menge.

### Bilder

Auf der Produktseite im Admin gibt es einen Bereich **Bilder**:

- **Hochladen:** JPG, PNG, WebP oder AVIF, maximal 12 MB pro Bild und maximal 12 Bilder pro Produkt. Es können **mehrere Dateien gleichzeitig** ausgewählt werden (Strg/Cmd gedrückt halten); ein gemeinsamer Alternativtext gilt für alle Bilder des Uploads und kann danach einzeln geändert werden. Während des Uploads zeigt eine Fortschrittsanzeige den übertragenen Prozentsatz; ohne JavaScript wird das Formular normal abgeschickt.
- **Automatische Verarbeitung:** Jedes Bild wird gedreht, auf maximal 1200 px Breite verkleinert, in AVIF, WebP und JPG umgewandelt und von EXIF-/GPS-Metadaten befreit. Es werden Varianten mit 480, 800 und 1200 px erzeugt (keine Vergrößerung).
- **Alternativtext:** Für Screenreader und Suchmaschinen. Ohne Angabe wird der Produktname verwendet.
- **Sortierung:** Kleine Zahl zuerst. Das erste Bild erscheint in der Shop-Übersicht und als großes Bild in der Galerie, alle weiteren als Miniaturen.
- **Galerie auf der Produktseite:** Ein kompaktes Hauptbild (maximal ca. 430 px breit) und darunter alle weiteren als Miniaturen. Ein Klick auf eine Miniatur wechselt das große Bild, ein Klick auf das große Bild öffnet eine vergrößerte Ansicht. In der Vergrößerung gibt es eine Blätterfunktion (Pfeilbuttons, Pfeiltasten, Zähler „Bild X von Y“); schließbar per X, Escape oder Klick auf den Hintergrund. Ohne JavaScript öffnen die Verweise direkt die Bilddatei.
- **Löschen:** Löschmarkierung setzen und speichern; die erzeugten Dateien werden mit entfernt.

Die Dateien liegen unter `/var/lib/3d-mir/uploads/media/products/<produkt-id>/` und werden über `/media/…` ausgeliefert. Sie sind nicht im Git und werden durch `deploy/backup.sh` mitgesichert.

**Hinweis:** Bereits vorhandene Produktbilder aus dem Bild-Build (`scripts/prepare-images.mjs`) bleiben nutzbar. Beim Löschen wird nur der Datenbankeintrag entfernt; die Build-Datei bleibt im Webroot.

## Sicherheit

- Sitzungen serverseitig in SQLite, Cookie `mir3d_admin` (httpOnly, SameSite=Lax, signiert, 8 Stunden).
- CSRF-Token in allen Formularen; Bild-Uploads prüfen das Token aus dem Multipart-Formular.
- Origin-/Referer-Prüfung, Login-Rate-Limit, Audit-Log.
- Uploads werden nur als Bild akzeptiert, neu kodiert und ausschließlich aus dem Medien-Unterordner öffentlich ausgeliefert. Hochgeladene 3D-Modelle bleiben privat.

### Zwei-Faktor-Authentifizierung (TOTP)

Unter **Admin → Passwort und Sicherheit** lässt sich TOTP aktivieren:

1. **2FA einrichten** anklicken.
2. QR-Code mit einer Authenticator-App scannen (alternativ den angezeigten Schlüssel eintragen).
3. Den 6-stelligen Code eingeben und **2FA aktivieren**.
4. Beim nächsten Login wird nach dem Passwort zusätzlich der Code verlangt.

Zum Deaktivieren ist das aktuelle Passwort erforderlich. Der Schlüssel liegt in der Datenbank (`users.totp_secret`) und ist damit in Backups enthalten. Bei Verlust der App bleibt nur der Zugang über die Serververwaltung.

### Passkeys (WebAuthn)

Unter **Passwort und Sicherheit → Passkeys** lassen sich zusätzlich Geräte-Passkeys hinterlegen:

1. Optional eine Bezeichnung eintragen (z. B. „iPhone“).
2. **Passkey hinzufügen** anklicken und die Freigabe am Gerät bestätigen (Fingerabdruck, Gesichtserkennung, Windows Hello, Sicherheitsschlüssel oder Passwort-Manager).
3. Der Passkey erscheint in der Liste und kann dort jederzeit entfernt werden.

Sind TOTP und Passkeys aktiv, zeigt die Anmeldung beide Möglichkeiten. Ist nur ein Passkey hinterlegt, entfällt der 6-stellige Code. Passkeys funktionieren ausschließlich über HTTPS (oder `localhost`). Auf dem Server wird nur der öffentliche Schlüssel gespeichert; der private Schlüssel bleibt auf dem Gerät.

## Monitoring

Ein systemd-Timer prüft alle fünf Minuten `http://127.0.0.1:<PORT>/api/health`:

```bash
systemctl status 3d-mir-monitor.timer
systemctl list-timers '3d-mir-*'
journalctl -u 3d-mir-monitor.service -n 20
npm run monitor:check        # manueller Lauf
```

Bei einem Ausfall wird der Betreiber über den unter **Benachrichtigungen** gewählten Kanal informiert; nach der Wiederherstellung folgt eine Entwarnung. Erneute Erinnerungen während eines anhaltenden Ausfalls werden höchstens alle sechs Stunden versendet. Der Zustand liegt unter `<DATA_DIR>/monitor-state.json`.

Der aktuelle Status erscheint außerdem auf dem **Dashboard** unter **Systemstatus**: erreichbar/Störung, letzte Prüfung, letzte erfolgreiche Prüfung, Ausfallzeitpunkt und Detailmeldung.
