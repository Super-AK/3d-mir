# Admin-Bereich

Der Admin-Bereich liegt unter `/admin/`. Zugang erhält der Betreiber über:

```bash
sudo -u mir3d npm run admin:create -- --email admin@example.de --name "Betreiber"
```

Das Passwort wird interaktiv gesetzt oder einmalig über `ADMIN_PASSWORD` übergeben. Es wird nicht im Repository gespeichert.

## Navigation

Die Verwaltung nutzt eine feste Seitenleiste, die nach Aufgaben gruppiert ist:

- **Übersicht:** Dashboard, Besucherstatistik
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

Auf dem **Dashboard** bleiben die Kennzahlen und die Listen offener Bestellungen, Zahlungen und Anfragen sofort sichtbar. Der Bereich **„Besucher der letzten 7 Tage“** und der **Systemstatus** sind zunächst eingeklappt; die Zeile zeigt jeweils eine kurze Vorschau (Aufrufe/Besucher bzw. letzte Prüfung und Status). Ein Klick öffnet die Details. Auch hier funktioniert das Ein-/Ausklappen ohne JavaScript und per Tastatur. Ergänzt wurde ein separater Abschnitt **GitHub Actions**, der den letzten Workflow-Lauf des CI-Workflows für `main`, dessen Status sowie die aktuelle Version anzeigt.

## Besucherstatistik

Unter **Admin → Besucherstatistik** werden Aufrufe, Herkunftsländer und die häufigsten Pfade ausgewertet. Zeitraum (7/30/90 Tage oder 12 Monate) und Zusammenfassung (täglich, wöchentlich oder monatlich) lassen sich über zwei Auswahlfelder ändern; die Seite lädt sofort neu. Das Dashboard zeigt zusätzlich eine kompakte Zusammenfassung der letzten sieben Tage.

Gezählt werden alle Anfragen, die die Anwendung erreichen, einschließlich API- und Admin-Aufrufen. Der Health-Check des Monitorings ist ausgenommen, statische Dateien werden von NGINX direkt ausgeliefert. Pfade werden ohne Query-Parameter und ohne numerische Segmente gespeichert.

Für eindeutige Besucher wird ein täglich wechselnder HMAC aus gekürzter IP-Adresse (IPv4 /24, IPv6 /48) und Datum gebildet. Es werden keine Cookies, keine vollständigen IP-Adressen und keine Browserkennungen gespeichert. Ein Besucher zählt an jedem Tag neu. Die pseudonymen Zähler werden nach 12 Monaten automatisch gelöscht (siehe `docs/DEPLOYMENT.md`).

## Stammdaten

Unter **Admin → Stammdaten** werden die öffentlichen Geschäftsangaben und Bilder gepflegt:

| Bereich | Inhalte |
| --- | --- |
| Geschäftsdaten | Kurzname, vollständiger Name, Inhaber, Straße, PLZ, Ort, Land, Ländercode, Telefon, Telefon-Link, E-Mail, Steuerhinweis, Kleinunternehmer |
| Kanäle | Etsy-Shop-URL und Bewertungs-URL, Kleinanzeigen-Bezeichnung und -URL |
| Kontakt/SEO | Antwortzeit, Abholhinweis, SEO-Name, Seitentitel und Beschreibung der Startseite |
| Bilder | Logo und Favicon (PNG/JPG/WebP, max. 5 MB), Hero-Bild, Service-Bild, Material-Bild (Leistungen), Rechner-Bild, Galerie mit bis zu 8 Bildern |
| Startseite | Kicker, Überschrift und Einleitungstext im Hero sowie Überschrift und Text des Kontaktbereichs |

Aus Gründen der Übersichtlichkeit sind **Kanäle**, **Kontakt und SEO**, **Bilder** und **Texte auf der Startseite** zunächst eingeklappt. Die Zeile zeigt eine kurze Vorschau (etwa die hinterlegten Kanäle oder die Überschrift der Startseite); ein Klick öffnet den Bereich. Die **Geschäftsdaten** bleiben sofort sichtbar. Das Ein-/Ausklappen funktioniert ohne JavaScript und per Tastatur; vorhandene Werte bleiben erhalten.

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
| Versand | Bezeichnung, Preis, Lieferzeit, Zusatzinfo | ✓ | ✓ |
| Versandoptionen | Bezeichnung, Preis, Hinweis (z. B. Express, Geschenkverpackung) | ✓ | ✓ |
| Mengenrabatt | Staffel ab Stückzahl, Rabatt in Prozent | ✓ | ✓ |

Alle sieben Bereiche sind zunächst eingeklappt; die Zeile zeigt eine kurze Vorschau (etwa „4 Materialien“, „3 Drucker“ oder „Kein Mengenrabatt“). Ein Klick auf die Zeile öffnet den Bereich. Die Schaltfläche **„Alle Änderungen speichern“** bleibt immer sichtbar; Pflichtfelder in geschlossenen Bereichen werden vom Browser beim Speichern automatisch aufgeklappt. Das Ein-/Ausklappen funktioniert ohne JavaScript und per Tastatur.

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

### To-do-Liste bis zum Livegang

Unterhalb der Schalter befindet sich eine Checkliste mit den offenen Punkten aus der Abnahme. Jeder Punkt lässt sich über das Kontrollkästchen oder die Schaltfläche **„Übernehmen“** abhaken; die Anzeige „x von y erledigt“ aktualisiert sich sofort. Über das Papierkorb-Symbol wird ein Punkt entfernt. Mit **„Neuer Punkt“** ergänzt du eigene Aufgaben, und **„Standardliste wiederherstellen“** setzt die Vorschläge zurück.

Der Stand wird in der Datenbank unter `settings` / `publication.checklist` gespeichert und bleibt auch nach einem Neustart erhalten. Die Checkliste ist reine Admin-Planung: Sie schaltet nichts automatisch frei und ersetzt keine fachliche Prüfung.

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
| Besucherstatistik | Pseudonyme Aufruf- und Pfad-Zähler |

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

**Versandseite:** Die öffentliche Seite `/versand/` wird aus den Versandarten unter „Preise → Versand“ erzeugt. Bezeichnung, Preis, Lieferzeit, Zusatzinfo und die Schwelle für kostenlosen Versand erscheinen dort automatisch; inaktive Versandarten werden ausgeblendet.

**Zusatzinfo:** Jede Versandart kann eine kurze Zusatzinformation erhalten, z. B. „Versichert bis 500 €“. Sie erscheint im Checkout bei der Auswahl der Versandart sowie auf der Produktseite, in der Shop-Übersicht und auf `/versand/`.

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

### Bestellungen drucken

In der Bestellliste hat jede Zeile einen **Druckbutton** (Drucker-Symbol) in der gleichen Icon-Optik wie Kopieren, Export und Löschen bei Produkten. Auf der Bestellungs-Detailseite steht zusätzlich der Button **„Drucken“** neben den Statusanzeigen.

Beide Buttons öffnen eine kompakte A4-Druckansicht ohne Admin-Navigation. Sie enthält Absender, Kunden- und Lieferadresse, Bestell-, Zahlungs- und Versandangaben, alle Positionen mit Variante, Farbe und Personalisierung sowie die Summen. Eine Kundenanmerkung oder interne Notiz wird nur angezeigt, wenn sie vorhanden ist. Über **„Drucken“** in der Ansicht wird der Browser-Druckdialog geöffnet; alternativ funktioniert Strg+P. **„Zurück zur Bestellung“** führt zur Detailseite zurück. Beim Drucken werden Werkzeugleiste und Schatten automatisch ausgeblendet.

### Stripe-Diagnose und Verbindungstest

Über der Zahlungstabelle steht eine **Stripe-Diagnose** aus der laufenden Serverumgebung. Sie zeigt nur Präfixe und Zustände, nie die Geheimnisse selbst:

| Anzeige | Bedeutung |
| --- | --- |
| Schlüssel / Schlüsselart | `sk_test…`, `sk_live…`, `rk_test…` oder `rk_live…`; eingeschränkte Schlüssel werden als solche markiert. |
| Schlüsselmodus / `STRIPE_MODE` / „Modus passt“ | Test- und Live-Konfiguration müssen übereinstimmen. |
| Webhook-Secret | Erkennbar an `whsec…`; ein ungewöhnliches Präfix wird markiert. |
| Zahlungs-Basis-URL, Webhook-URL, Erfolgs- und Abbruch-URL | Erwartete Adressen aus `PAYMENT_BASE_URL` und `site.baseUrl`. |

Abweichungen erscheinen als rote Hinweisliste. Der Button **„Verbindung zu Stripe testen“** ruft die Checkout-Sessions-API ab und zeigt die Stripe-Fehlermeldung direkt an, zum Beispiel fehlende Rechte bei einem `rk_live…`-Schlüssel. Nach ENV-Änderungen ist immer `sudo systemctl restart 3d-mir.service` nötig; ohne Neustart bleibt die alte Anzeige stehen.

Unter der Diagnose stehen die **letzten fünf fehlgeschlagenen Stripe-Zahlungen** mit Bestellnummer, Zeit und Fehlerursache sowie die **letzten fünf Stripe-Webhooks**. Kunden sehen weiterhin nur eine allgemeine Fehlermeldung; die bereinigte Stripe-Ursache wird ausschließlich im Admin-Zahlungshinweis der Bestellung gespeichert.

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
- Erreicht ein Absender die eingestellte Zahl an Versuchen, wird er für die gewählte Dauer gesperrt. Anfragen von gesperrten Absendern – auch bei weiteren Versuchen – werden mit HTTP `404` und der Meldung `404 – Datei wurde nicht gefunden` abgewiesen, nicht gespeichert und lösen keine Benachrichtigung aus. Damit verhält sich Spam-Bots wie eine nicht existente Ressource; der Spam-Schutz bleibt serverseitig unverändert.
- Die Antwortfunktion ist über die Checkbox **„Gesperrte Absender mit HTTP 404 und ‚Datei wurde nicht gefunden‘ beantworten“** steuerbar. Standard ist aktiv; bei Deaktivierung wird die vorherige Antwort mit HTTP `429` verwendet.
- Die Admin-Seite zeigt unter **„Spam-Sperren: 404-Antworten“** die Anzahl der 404-Antworten sowie den Zeitpunkt der letzten Antwort.
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

## API & Schnittstellen

Unter **Admin → API & Schnittstellen** wird die Shop-API für die Faktura-App
verwaltet. Der Shop gibt die Daten frei, die Faktura-App holt sie per HTTPS ab
(Pull-Prinzip). Die Basis-URL ist `https://www.3d-mir.de/api/v1`.

- **API gesamt:** Not-Aus, Wartungsmodus (`503` mit `Retry-After`) und Rate-Limit
  pro Token (Standard 60 Anfragen/Minute).
- **Tokens:** Name, Scopes (`orders:read`, `customers:read`, `products:read`,
  `orders:write_status`), Ablaufdatum, IP-Allowlist (IP oder CIDR), Sperren,
  Löschen und Rotieren. Der Token erscheint nur einmal direkt nach dem Anlegen
  oder Rotieren; gespeichert wird ausschließlich sein SHA-256-Hash. Nach einer
  Rotation bleibt der alte Token 24 Stunden gültig.
- **Freigaben:** Bestellungen, Kunden und Artikel einzeln; Bestellstatus,
  nur bezahlte Bestellungen, Gast-Bestellungen und ein Startdatum; Feldgruppen
  (Telefon, USt-IdNr., Kundennotiz, Marketing-Einwilligung, 3D-Attribute,
  Modelldatei); Artikel (nur aktiv, nur mit SKU, bestimmte Kategorien) sowie
  frei definierte Zusatzfelder in `order.meta` und `items[].attributes`.
  Nicht freigegebene Felder werden weggelassen, nicht mit `null` gefüllt.
  Ein einmal ausgelieferter Status wird weiterhin geliefert, damit Stornierungen
  nicht verloren gehen.
- **Rückmeldung:** Rechnungsnummer, -datum, Lieferschein und Link können per
  `PATCH /orders/{id}/invoice` übernommen werden. Der Link wird nur angezeigt,
  wenn die entsprechende Option aktiv ist; er muss gegen öffentliches Erraten
  geschützt sein.
- **Überwachung:** Die letzten 30 Zugriffe (Token, Methode, Pfad, Status, Dauer,
  Anzahl) und alle API-Konfigurationsänderungen aus dem Audit-Log.
- **Test und Export:** „Beispielantwort ansehen" zeigt genau die Antwort mit den
  aktuellen Freigaben. Die Konfiguration lässt sich ohne Tokens/Secrets als JSON
  exportieren und importieren oder auf Standard zurücksetzen.

Jede Änderung erhöht `config_version`; sie erscheint in `/meta` und im Header
`X-Config-Version`. Die vollständige Schnittstelle steht in `openapi.yaml`,
Beispielantworten in `docs/api-beispiele/`. Im Admin führt der Link **API-Hilfe**
zu einer Kurzanleitung mit Download-Links für alle diese Dokumente. Abweichungen
und offene Punkte sind in `VERTRAGS-ANMERKUNGEN.md` dokumentiert. - **Webhooks (Phase 2):** Ziel-URL (HTTPS), Secret und Ereignisse sind konfigurierbar;
  der Shop sendet nur `event`, `id` und `occurred_at`, signiert mit `X-Signature`
  (HMAC-SHA256) und `X-Timestamp`. Fehlgeschlagene Zustellungen werden mit
  1/5/30/120/720 Minuten Backoff erneut versucht und im Zustellprotokoll
  angezeigt; dort gibt es „Test-Event senden" und „Erneut senden".
- **Status-Rückmeldung:** Die Faktura-App kann per `PATCH /orders/{id}/status`
  Status und Sendungsnummer zurückmelden; auch diese Aufrufe sind idempotent.

Die gemeinsame Abnahme mit der Faktura-App ist in `docs/API-ABNAHME.md` vorbereitet;
offene Entscheidungen stehen als F87–F93 in `docs/OFFENE-FRAGEN.md`. Bitte keine
Tokens oder Zugangsdaten in Tickets oder E-Mails senden.

## Produkte und Bilder

Unter **Admin → Produkte** lassen sich Produkte, Varianten, Farben, Personalisierung und Bilder pflegen.

### Sortierung

In der Produktliste steht eine Spalte **Sortierung**. Mit den Pfeilen lässt sich ein Produkt eine Position nach oben oder unten verschieben; alternativ können die Zeilen mit der Maus gezogen werden. Beide Wege funktionieren ohne zusätzliche Eingaben und schreiben die Reihenfolge fortlaufend (`1`, `2`, `3`, …) zurück. Bei aktiver Suche wird die Sortiersteuerung ausgeblendet, weil sich die Reihenfolge immer auf alle Produkte bezieht.

Die Sortiernummer im Produktformular bleibt erhalten. Wird dort eine bereits vergebene Nummer eingetragen, rücken die Produkte ab dieser Position auf, statt dass zwei Produkte dieselbe Nummer behalten. Denselben Effekt hat die Spalte `sortierung` beim CSV-Import. Admin-Liste, Shop und Sitemap verwenden anschließend dieselbe Reihenfolge (Sortiernummer, dann ID). Die Änderungen werden im Audit-Protokoll als `product.reorder` erfasst.

### Suche

Die Produktliste lässt sich nach **Name**, **SKU** und **Slug** durchsuchen. Die Suche startet automatisch beim Tippen und tauscht nur den Ergebnisbereich aus; die Seite wird nicht neu geladen und der Fokus bleibt im Suchfeld. Bei aktivem JavaScript entfällt der Button **Filtern**; ohne JavaScript bleibt er als Absenden-Funktion erhalten. Der Suchbegriff steht in der URL (`?q=…`) und lässt sich daher teilen oder neu laden. „Alle auswählen“ und die Massenlöschung funktionieren auch nach einer Suche.

### Löschen, Kopieren, Import und Export

- **Löschen:** Über „Löschen“ in der Produktzeile öffnet sich eine Bestätigungsseite. Gelöscht werden Produkt, Varianten und Bilder; bestehende Bestellungen bleiben mit ihren Positionsdaten erhalten.
- **Massenlöschung:** Produkte in der Liste markieren (oder „Alle auswählen“) und „Ausgewählte löschen“ klicken. Es folgt eine Bestätigungsseite mit allen betroffenen Produkten.
- **Kopieren:** Legt eine vollständige Kopie inklusive Material, Lieferhinweis, Varianten, Farben, Personalisierung und Bildern an. Name erhält „(Kopie)“, der Slug ein eindeutiges Suffix; die Kopie ist zunächst **inaktiv**.
- **Exportieren:** „Exportieren“ lädt alle Produkte als JSON herunter; pro Zeile gibt es zusätzlich einen Einzel-Export. Enthalten sind Produktdaten inklusive Material, Lieferhinweis, Varianten, Farben, Personalisierung und Bilder (hochgeladene Bilder als Base64-JPG).
- **Importieren:** JSON-Datei über „Importieren“ hochladen (max. 20 MB). Produkte werden neu angelegt, vorhandene Slugs automatisch durchnummeriert (`-2`, `-3`, …). Bilder werden beim Import erneut in AVIF/WebP/JPG umgewandelt. Der Import überschreibt keine bestehenden Produkte.
- **CSV-Export:** „CSV-Export“ lädt alle Produkte als Semikolon-CSV (UTF-8 mit BOM) herunter; auf der Produktseite und in der Produktliste gibt es auch einen Einzel-Export. Enthalten sind Stammdaten, Kategorien, Varianten, Farben und Versandzuordnungen – keine Bilder.
- **CSV-Import:** CSV-Datei über „CSV-Import“ hochladen (max. 20 MB, 500 Zeilen). Die SKU ist der Schlüssel: gleiche SKUs werden aktualisiert, neue angelegt; ohne SKU gilt der Slug. Leere Zellen übernehmen beim Aktualisieren die bisherigen Werte. Eine angegebene Variantenliste ersetzt die vorhandenen Varianten.

Das JSON-Format hat die Kennung `3d-mir-products`, Version `1`, und ein Array `products` mit Produkt-, Varianten- und Bilddaten. Ein Export kann unverändert wieder importiert werden (erzeugt dann Kopien mit neuen Slugs).

Die CSV hat die Spalten `sku`, `slug`, `name`, `kategorien`, `kurzbeschreibung`, `beschreibung`, `preisAb`, `preisBis`, `material`, `lieferhinweis`, `gewichtG`, `abmessungen`, `lagerbestand`, `sortierung`, `aktiv`, `varianten`, `farben`, `personalisierung`, `personalisierungshinweis`, `personalisierungspreis`, `versandarten`, `versandoptionen`. Die Reihenfolge ist frei; deutsche und englische Spaltennamen werden erkannt. Listen stehen in einer Zelle und werden mit `|` getrennt, mehrere Varianten mit `||` (z. B. `Klein|12,90|5||Groß|19,90|2`). Preise sind Euro-Werte mit Komma oder Punkt, `aktiv` und `personalisierung` sind `1`/`0`. Unbekannte Kategorien werden übersprungen und gemeldet. Bilder bleiben beim JSON-Import bzw. werden direkt auf der Produktseite hochgeladen.

Für den CSV-Import gilt dieselbe CSRF-Prüfung wie für alle Admin-Formulare; der Import wird im Audit-Protokoll als `product.csv.import` erfasst. Bei teilweise fehlerhaften Dateien werden die betroffenen Zeilen gemeldet, gültige Zeilen aber trotzdem verarbeitet.

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

Name, Slug, Kurz- und Langbeschreibung, **Material**, **Lieferhinweis**, Preise, SKU, Gewicht, Maße, Lagerbestand, Sortierung und Sichtbarkeit. Der Slug bestimmt die URL `/shop/<slug>/`.

Die **Beschreibung** ist im Formular zunächst eingeklappt; ein Klick auf die Zeile „Beschreibung“ öffnet das Textfeld. Bereits hinterlegter Text erscheint dort als kurze Vorschau. Der Text wird unverändert gespeichert, auch wenn das Feld wieder geschlossen ist.

Aus Gründen der Übersichtlichkeit sind außerdem **Kategorien**, **Versandarten**, **Versand-Zusatzoptionen**, **Varianten, Farben und Personalisierung**, die **Varianten-Tabelle** und der **Bilder**-Bereich zunächst eingeklappt. Jede Zeile zeigt eine kurze Vorschau (etwa die Anzahl ausgewählter Kategorien oder Bilder). Ein Klick auf die Zeile öffnet den Bereich; die Angaben bleiben unverändert erhalten. Name, Slug, Kurzbeschreibung, Preise, Artikelnummer, Maße, Lagerbestand, Sortierung und Sichtbarkeit sind sofort sichtbar. Das Ein-/Ausklappen funktioniert ohne JavaScript und per Tastatur.

Bei aktivierter Personalisierung kann ein **Aufpreis in Euro pro Stück** hinterlegt werden. Er wird nur berechnet, wenn der Kunde das Textfeld tatsächlich ausfüllt; bei mehreren Stücken gilt er entsprechend oft. Der Aufpreis erscheint auf der Produktseite als Hinweis, in Warenkorb und Kasse sowie in der Bestellübersicht und ist im Zahlbetrag enthalten. `0,00 €` bedeutet keinen Aufpreis.

Das **Material** wird pro Produkt im Admin gepflegt und auf der Produktseite unter „Material“ sowie in „Auf einen Blick“ angezeigt. Bleibt das Feld leer, erscheint `PLA`. Sind Farben hinterlegt, ergänzt die Produktseite den Hinweis „in Wunschfarbe“.

Der **Lieferhinweis** ergänzt die Lieferzeit, z. B. „Fertigung nach Bezahlung“ oder „sofort lieferbar“. Ohne Angabe erscheint kein Zusatz. Neue Produkte starten mit „Fertigung nach Bezahlung“.

Die Preisanzeige im Shop wird aus den Varianten berechnet: Gibt es unterschiedliche Variantenpreise, steht dort „ab <kleinster Preis>“; sind alle Preise gleich oder gibt es keine Varianten, steht ein einzelner Preis. Auf der Produktseite erscheint zunächst „ab …“ und nach Auswahl einer Variante der konkrete Variantenpreis.

### Versandarten und Versandoptionen pro Produkt

Im Produktformular gibt es die Bereiche **Versandarten** und **Versand-Zusatzoptionen**:

- **Versandarten:** Nur die ausgewählten Versandarten werden für dieses Produkt im Checkout angeboten. Ohne Auswahl gelten alle aktiven Versandarten. Die Abholung wird an der ID `abholung` oder an der Bezeichnung erkannt (enthält „Abhol“), damit auch eigene IDs wie `abholung-nach-absprache` funktionieren.
- **Produktseite:** Die Angaben zu Versand, Abholung und Lieferzeit richten sich nach den ausgewählten Versandarten. Bei genau einer Versandart steht der genaue Preis ohne „ab“; bei mehreren erscheint der günstigste Preis mit „ab“. Die Abholung wird nur angezeigt, wenn die Versandart „Abholung“ für das Produkt angeboten wird. Die Lieferzeit nennt bei mehreren Versandarten jede Variante mit ihrer Bezeichnung; die Abholung selbst hat keine Lieferzeit. Wird ausschließlich Abholung angeboten, entfällt die Zeile „Lieferzeit“.
- **Versandoptionen:** Zusatzleistungen wie „Expressversand“ oder „Geschenkverpackung“, die unter „Preise → Versandoptionen“ angelegt werden. Sie erscheinen im Checkout nur bei Produkten, denen sie zugeordnet wurden, und werden mit ihrem Preis auf die Bestellung addiert.
- Bei Warenkörben mit mehreren Produkten werden nur Versandarten angeboten, die für alle Produkte erlaubt sind. Versandoptionen werden angeboten, wenn mindestens ein Produkt sie unterstützt; sie werden pro Bestellung einmal berechnet.
- Inaktive Versandarten oder Optionen werden im Shop und Checkout nicht angeboten, bleiben aber im Admin zur Bearbeitung sichtbar.

### Varianten, Farben und Personalisierung

- **Varianten:** Echte Ausführungen wie Größe oder Modell mit eigenem Preis und optionalem Lagerbestand. Varianten werden direkt in der Tabelle bearbeitet, ergänzt oder per Löschmarkierung entfernt. Produkte ohne Varianten sind im Shop direkt kaufbar; die frühere Pflichtvariante „Standard“ ist nicht mehr nötig.
- **Farbvarianten (kommagetrennt):** Im Produktformular lassen sich Farben als Liste hinterlegen, z. B. `Schwarz, Weiß, Rot`. Die Farben haben keinen eigenen Preis und lassen sich mit Varianten kombinieren. Ist die Liste gefüllt, muss der Kunde im Shop eine Farbe auswählen.
- **Personalisierung:** Die Checkbox **„Personalisierung anbieten“** blendet im Shop ein optionales Textfeld ein. Der Kunde kann es leer lassen. Der eingegebene Text wird in der Bestellung gespeichert und im Admin sowie in den Bestellmails angezeigt.
- **Hinweis im Personalisierungsfeld:** Das Feld **„Hinweis im Personalisierungsfeld“** legt den grauen Platzhaltertext im Shop fest, z. B. „z. B. Wunschname für Anna“. So lassen sich pro Produkt passende Beispiele vorgeben. Bleibt das Feld leer, erscheint der Standardtext „z. B. Name oder kurzer Text“.
- **Aufpreis bei Personalisierung:** Das Feld **„Aufpreis bei Personalisierung (€ pro Stück)“** ergänzt den Stückpreis nur dann, wenn der Kunde Text eingibt. Ohne Eingabe bleibt es beim normalen Preis; `0,00 €` schaltet den Aufpreis aus. Der Betrag steht außerdem in Warenkorb, Kasse und Bestellung.
- **Lagerbestand:** Ist ein Bestand gesetzt, prüft die Kasse die verfügbare Menge – bei Varianten am Variantenbestand, bei Produkten ohne Varianten am Produktbestand. Reservierter Bestand wird beim Stornieren wieder freigegeben.

### Bilder

Auf der Produktseite im Admin gibt es einen Bereich **Bilder**:

- **Hochladen:** JPG, PNG, WebP oder AVIF, maximal 12 MB pro Bild und maximal 12 Bilder pro Produkt. Es können **mehrere Dateien gleichzeitig** ausgewählt werden (Strg/Cmd gedrückt halten); ein gemeinsamer Alternativtext gilt für alle Bilder des Uploads und kann danach einzeln geändert werden. Während des Uploads zeigt eine Fortschrittsanzeige den übertragenen Prozentsatz; ohne JavaScript wird das Formular normal abgeschickt.
- **Automatische Verarbeitung:** Jedes Bild wird gedreht, auf maximal 1200 px Breite verkleinert, in AVIF, WebP und JPG umgewandelt und von EXIF-/GPS-Metadaten befreit. Es werden Varianten mit 240, 480, 800 und 1200 px erzeugt (keine Vergrößerung). Das metadatenfreie Original wird zusätzlich für den Zuschnitt gespeichert.
- **Alternativtext:** Für Screenreader und Suchmaschinen. Ohne Angabe wird der Produktname verwendet.
- **Sortierung:** Über die Pfeile in der Bilderkarte oder per Drag & Drop der Karten. Die Pfeile funktionieren auch ohne JavaScript. Die Nummern werden dabei fortlaufend vergeben; bei gleichen Nummern entscheidet die ID. Das erste Bild erscheint in der Shop-Übersicht und als großes Bild in der Galerie, alle weiteren als Miniaturen. Die Miniaturen im Admin sind bewusst klein gehalten (240 px-Variante, 112 px hoch).
- **Zuschneiden:** Der Stift oben rechts auf einer Bilderkarte öffnet einen Dialog. Den Ausschnitt mit der Maus verschieben oder an den Ecken verkleinern; „Ausschnitt zurücksetzen“ stellt das ganze Bild wieder her. Beim Speichern entsteht ein neues Bild – das bisherige wird entfernt. Bei älteren Bildern ohne gespeichertes Original wird die größte vorhandene Variante als Quelle verwendet. Der Zuschnitt wird im Audit-Protokoll erfasst.
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
