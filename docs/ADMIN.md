# Admin-Bereich

Der Admin-Bereich liegt unter `/admin/`. Zugang erhält der Betreiber über:

```bash
sudo -u mir3d npm run admin:create -- --email admin@example.de --name "Betreiber"
```

Das Passwort wird interaktiv gesetzt oder einmalig über `ADMIN_PASSWORD` übergeben. Es wird nicht im Repository gespeichert.

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

### Zahlungsstatus und Bestellungen

- Jede Bestellung hat zusätzlich zum Fulfillment-Status einen **Zahlungsstatus**: offen, in Bearbeitung, bezahlt, fehlgeschlagen, erstattet oder storniert.
- Bei **Vorkasse** bestätigt der Betreiber den Zahlungseingang im Bestelldetail über „Zahlungseingang bestätigen“.
- Bei **Stripe** wird der Status über den Webhook automatisch gesetzt. Die Rückleitungsseite prüft die Zahlung zusätzlich, falls der Webhook verzögert eintrifft.
- Bei fehlgeschlagener oder abgebrochener Zahlung kann der Kunde die Zahlung über die Bestellübersicht erneut starten.
- „Erstattung vermerken“ setzt den Zahlungsstatus auf „erstattet“. Die eigentliche Erstattung erfolgt im Stripe-Dashboard bzw. per Überweisung.
- Die Bestellliste lässt sich nach Zahlungsstatus filtern.

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

### Spam-Schutz und Länderprüfung

Der Spam-Schutz wird im aufklappbaren Bereich **„Spam-Schutz und Länderprüfung“** gepflegt:

| Einstellung | Bedeutung |
| --- | --- |
| Länderprüfung | Nur Anfragen aus den ausgewählten Ländern zulassen. Standard: nur Deutschland (`DE`). |
| Erlaubte Länder | Mehrfachauswahl aus einer festen ISO-3166-Liste. |
| Verhalten bei Auffälligkeiten | **Zur Prüfung speichern** (empfohlen) oder **Anfrage direkt ablehnen**. |
| Zeitprüfung | Das Formular muss mindestens 3 Sekunden geöffnet gewesen sein. |
| Inhaltsprüfung | Erkennt viele Links, typische Spam-Begriffe und überwiegende Großschreibung. |

Zusätzlich schützen ein Honeypot-Feld, ein Rate-Limit und ein signiertes Zeit-Token (HMAC mit `SESSION_SECRET`, 24 Stunden gültig) vor automatisierten Anfragen. Liefert ein vorgeschalteter Proxy oder ein CDN ein Länderkürzel (z. B. `CF-IPCountry`), wird dieses zusätzlich zum Formularfeld geprüft.

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

### E-Mail-Versand (SMTP)

Folgende Felder werden gepflegt:

- SMTP-Server und Port
- Benutzername und Passwort
- SSL/TLS direkt ab Verbindungsaufbau (meist Port 465; für Port 587 nicht aktivieren)
- Absender und Betreiber-Postfach

Das Passwort wird nicht im Klartext angezeigt. Leer lassen, um das gespeicherte Passwort zu behalten.

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

### Löschen, Kopieren, Import und Export

- **Löschen:** Über „Löschen“ in der Produktzeile öffnet sich eine Bestätigungsseite. Gelöscht werden Produkt, Varianten und Bilder; bestehende Bestellungen bleiben mit ihren Positionsdaten erhalten.
- **Massenlöschung:** Produkte in der Liste markieren (oder „Alle auswählen“) und „Ausgewählte löschen“ klicken. Es folgt eine Bestätigungsseite mit allen betroffenen Produkten.
- **Kopieren:** Legt eine vollständige Kopie inklusive Varianten und Bildern an. Name erhält „(Kopie)“, der Slug ein eindeutiges Suffix; die Kopie ist zunächst **inaktiv**.
- **Exportieren:** „Exportieren“ lädt alle Produkte als JSON herunter; pro Zeile gibt es zusätzlich einen Einzel-Export. Enthalten sind Produktdaten, Varianten und Bilder (hochgeladene Bilder als Base64-JPG).
- **Importieren:** JSON-Datei über „Importieren“ hochladen (max. 20 MB). Produkte werden neu angelegt, vorhandene Slugs automatisch durchnummeriert (`-2`, `-3`, …). Bilder werden beim Import erneut in AVIF/WebP/JPG umgewandelt. Der Import überschreibt keine bestehenden Produkte.

Das JSON-Format hat die Kennung `3d-mir-products`, Version `1`, und ein Array `products` mit Produkt-, Varianten- und Bilddaten. Ein Export kann unverändert wieder importiert werden (erzeugt dann Kopien mit neuen Slugs).

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
