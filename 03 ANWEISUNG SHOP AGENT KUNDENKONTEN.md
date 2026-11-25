# Anweisung für den Shop-Agenten: Kundenverwaltung, Kundenkonten, Kundennummern

**Projekt:** www.3d-mir.de · **Ergänzung zu:** `01-ANWEISUNG-SHOP-AGENT.md`
**Verbindliche Grundlage:** `00-API-VERTRAG.md` in **Version 1.2** (im Repo ggf. `API-VERTRAG.md`; Änderungen mit **[NEU v1.1]** bzw. **[NEU v1.2]**). Die Anmerkungen des Shop-Agenten (A1–A11) sind dort in Abschnitt 14 eingearbeitet.

## 0. Vorrang und Abgrenzung

1. Lies zuerst `00-API-VERTRAG.md` (v1.2) und `01-ANWEISUNG-SHOP-AGENT.md`. Alle Arbeitsregeln aus `01` gelten weiter (erst analysieren, kleine Schritte, Migrationen mit Rollback, keine Secrets im Code, nicht raten, `VERTRAGS-ANMERKUNGEN.md`).
2. Diese Datei betrifft **nur** Kunden, Kundenkonten, Kundennummern und die damit zusammenhängenden API-Felder. Bei Widersprüchen zu Kunden-Themen gilt: **Vertrag v1.2 > diese Datei > `01`**.
3. **Architektur bleibt Pull.** Der Shop ruft die Faktura-App **nicht** auf und speichert keine Zugangsdaten für sie. Die Faktura-App holt Kunden und Bestellungen über `/api/v1` ab. Es gibt im Shop **keine Outbox und keinen Faktura-Client**. Die einzige Rückrichtung sind die `PATCH`-Endpunkte aus Vertrag §7 und §7.2.
4. **Rechnungsnummern** kommen ausschließlich aus der Faktura-App. Der Shop erzeugt keine eigenen. Bestellbestätigungen enthalten keine Rechnungsnummer.
5. Nutze den vorhandenen Stack des Shops (laut Hauptanweisung Node.js/Fastify/SQLite, sonst den tatsächlich vorhandenen). Führe keine neuen Frameworks ein.
6. Kleinunternehmer nach § 19 UStG: Preise ohne Umsatzsteuerausweis, `tax_rate_percent = 0`.

## 1. Ziel

- Jeder Kunde des Shops (mit Konto **oder** als Gast) bekommt eine **Kundennummer** `KD` + 6 Ziffern aus dem Bereich **`KD900001` … `KD999999`**.
- Die Faktura-App kennt den Altbestand `KD700001` … und übernimmt die Shop-Nummer beim Import automatisch. Der Shop berührt den Bereich 7xxxxx nie.
- Kunden können optional ein **Konto** anlegen (Bestellungen, Rechnungen, Adressen, Datenexport, Löschung).
- Ein Admin verwaltet Kunden im vorhandenen Admin-Bereich.

## Phase K0 – Analyse (nichts verändern)

Ergänze `ANALYSE.md` um:

- **Bekannt (Anmerkung A1):** Der Shop hat keine `customers`-Tabelle. Kunden werden derzeit aus `orders` nach normalisierter E-Mail abgeleitet (`id` = `usr_` + 16 Hex-Zeichen SHA-256 der E-Mail, bei angemeldeten Bestellungen `user_id`). Bestellungen enthalten **eine** Adresse (A5). Prüfe, ob Konten (`users`) bereits existieren und wie Gäste gespeichert werden.
- Wie werden Sitzungen, Passwörter, E-Mail-Versand, Admin-Rollen und Audit-Log gelöst?
- Mapping *Shop-Feld → neue API-Felder* (`customer_number`, `status`, `email_verified`, `is_guest`).
- Anzahl vorhandener Kunden und Bestellungen (für das Nachtragen von Nummern, Phase K1).

**Stopp:** Ergebnis dem Projektinhaber zeigen, bevor Phase K1 beginnt.

## Phase K1 – Datenmodell (nur per Migration, mit Rollback)

Alle Beträge in Cent, alle Zeiten UTC. Namen an die Konvention des Shops anpassen.

**`customers`**: `id`, `customer_no` (UNIQUE, `^KD\d{6}$`), `is_guest`, `type` (`private`|`business`), `status` (`active`|`blocked`|`anonymized`), `email` (normalisiert: klein, getrimmt), `email_verified_at`, `first_name`, `last_name`, `company`, `vat_id`, `phone`, `marketing_consent`, `marketing_consent_at`, `faktura_customer_no` (nur Hinweis, Abschnitt K4), `created_at`, `updated_at`.

**`customer_addresses`**: `id`, `customer_id`, `kind` (`billing`|`shipping`), Name, Firma, Straße, Zusatz, PLZ, Ort, Land (ISO), `is_default`.

**`customer_accounts`**: `customer_id`, `password_hash` (argon2id), `failed_logins`, `locked_until`, `last_login_at`. Kein Eintrag bedeutet Gast.

**`customer_number_counter`**: genau eine Zeile, `last_value` (Integer, Start 900000).

**`customer_audit`**: wer (Admin/Kunde/System), wann, was, alt → neu.

**Bestellungen:** `orders.customer_id` (Pflicht für neue Bestellungen). Adressen, Namen, Positionen und Preise bleiben **Snapshots** der Bestellung (Vertrag §6.1).

**Stabile IDs (Pflicht):** `customers.id` ist für bestehende Kunden **identisch** mit den bisher ausgelieferten abgeleiteten IDs (`usr_…`), weil die Faktura-App sie als `external_id` gespeichert hat. Neue Kunden erhalten dieselbe Ableitung (oder `user_id`). Die `id` bleibt danach unverändert, auch wenn sich die E-Mail-Adresse ändert (nie neu berechnen). Test: Vorher/Nachher-Vergleich der `/customers`-IDs.

**Adressen in Bestellungen (A5):** Hat das Kundenkonto getrennte Rechnungs- und Lieferadressen, speichert die Bestellung **beide** als Snapshot (Migration). `billing_address` und `shipping_address` der API verwenden dann die jeweils eigene Adresse; bis dahin bleiben beide gleich.

**Bestandsdaten nachtragen:** Eine Migration legt für vorhandene Bestellungen/Kunden Kundendatensätze an (Gäste: Zuordnung über normalisierte E-Mail), vergibt Nummern in der Reihenfolge `created_at ASC, id ASC` und füllt `orders.customer_id`. Vorher Backup-Hinweis und Bestätigung des Projektinhabers einholen (Regel 6 aus `01`). Bestehende Bestellungen ändern ihre Snapshots **nicht**.

## Phase K2 – Vergabe der Kundennummer

1. Ein Kunde entsteht bei **Registrierung** oder **erster Bestellung**. Wer nur stöbert, bekommt keine Nummer.
2. Die Vergabe läuft in **einer Transaktion** (SQLite: `BEGIN IMMEDIATE`; sonst gleichwertige Sperre): Zähler erhöhen, Datensatz mit `customer_no` einfügen, Commit. Format: `"KD" + Zahl auf 6 Stellen`.
3. Bereich in `config/site.json` (`customerNumber.prefix`, `.digits`, `.rangeStart`, `.rangeEnd`), Standard `KD`, 6, 900001, 999999. Werte über `/meta` ausliefern (Vertrag §13.3).
4. Nummern werden **nie wiederverwendet**, auch nicht nach Anonymisierung oder Löschversuchen. Bei Überschreitung von `rangeEnd` wird keine Nummer vergeben, die Bestellung wird angehalten und der Admin per E-Mail gewarnt. Schon bei 90 % Auslastung eine Vorwarnung senden.
5. Der Zähler ist **nicht** über die Oberfläche änderbar (nur Anzeige im Admin laut Vertrag §13.1).
6. Tests: 50 parallele Vergaben ohne Duplikat, Formatprüfung, Bereichsgrenzen, Wiederverwendungsverbot, Gast und Konto liefern dieselbe Nummer für dieselbe E-Mail.

**Gäste:** Bei wiederholter Gastbestellung mit derselben normalisierten E-Mail wird derselbe Gast-Kundendatensatz verwendet. Legt der Kunde später ein Konto mit **bestätigter** E-Mail an, wird der Gast-Datensatz zum Konto-Kunden (gleiche Nummer, `is_guest = false`).

## Phase K3 – API-Erweiterung (Vertrag v1.1)

- `GET /customers`, `GET /customers/{id}`: zusätzliche Felder `customer_number`, `status`, `email_verified`, `is_guest` laut Vertrag §6.2. `customer_number` ist Pflichtfeld und **nicht abschaltbar**.
- `customer_snapshot` in jeder Bestellung enthält `customer_number` und `is_guest` (Vertrag §6.1).
- Gäste liefern jetzt eine `customer_id` (nicht mehr `null`). Ältere Bestellungen dürfen weiter `null` haben, bis die Nachtragsmigration (K1) gelaufen ist.
- **`updated_at` des Kunden steigt bei jeder Änderung** (Stammdaten, Adresse, Status, E-Mail-Bestätigung). Prüfe das per Trigger oder Anwendungslogik und teste es.
- **Anonymisierte Kunden** bleiben abrufbar: `status = anonymized`, Name/E-Mail/Telefon/Adressen entfernt oder durch Platzhalter ersetzt, `customer_number` bleibt. Bestell-Snapshots bleiben bestehen (Aufbewahrungspflicht).
- `GET /meta` ergänzt `customer_numbers` (Muster, Start, Ende, letzte vergebene Nummer) und die neuen Felder in `fields.customers`.
- **Admin „API & Schnittstellen“** (Phase 1b aus `01`): Zeile „Kundennummern“ (nur Anzeige: Format, Bereich, zuletzt vergeben, Auslastung, Warnschwelle). Änderung der Konfiguration erhöht `config_version`.
- `/health.version` und `/meta.api_version` melden `1.1.0` (höchste umgesetzte Vertragsversion mit API-Änderungen, Vertrag §3).
- Zahlungs- und Statuswerte gemäß Vertrag §6.5 und §6.6 ausliefern (Stripe-Referenz in `payment.transaction_ref`, Teilerstattung in `payment.refunded_cents`).

## Phase K4 – Optionale Rückmeldung der Zuordnung (Phase 2, nicht in Phase 1 bauen)

`PATCH /customers/{id}/link` (Scope `customers:write_link`, Vertrag §7.2): speichert `faktura_customer_no` als **Hinweis**. Die Shop-Kundennummer ändert sich dadurch nie. Im Admin-Kundendetail anzeigen („Zugeordnet zu Faktura-Kunde KD700123“). Idempotent, nur dieses Feld schreibbar, validieren (`^KD\d{6}$`).

## Phase K5 – Kundenkonten (Shop-Funktionen)

**Registrierung und Anmeldung**

- Registrierung mit E-Mail und Passwort, **Double-Opt-in** (Bestätigungslink, einmalig, zeitlich begrenzt). Passwort mindestens 10 Zeichen, Prüfung gegen häufige Passwörter, argon2id.
- Login mit Rate-Limit pro IP und Konto, zeitweise Sperre nach Fehlversuchen, Passwort-Reset per E-Mail (Token einmalig, 60 Minuten, danach alte Sitzungen beenden).
- Sitzungs-Cookie `HttpOnly`, `Secure`, `SameSite=Lax` (technisch notwendig). CSRF-Schutz bei allen Formularen.
- **Keine Aussage, ob eine E-Mail-Adresse schon existiert:** gleiche neutrale Texte und ähnliche Antwortzeiten bei Registrierung, Login und Passwort-Reset (kein Ausforschen von Kundenlisten).
- Gastbestellung bleibt möglich. Nach der Bestellung ein Hinweis zum Anlegen eines Kontos.

**Kundenbereich** (`/konto/`)

- Übersicht mit **Kundennummer**, Stammdaten, Adressbuch (Rechnung/Lieferung), Passwort und E-Mail ändern (neue E-Mail wird bestätigt).
- **Bestellhistorie** mit Status, Positionen, Zahlungslink für offene Bestellungen. **Rechnung (Vertrag §7, [NEU v1.2]):** Token-Links der Faktura-App können ablaufen. Ist der Link abgelaufen, zeigt das Konto „Link abgelaufen, bitte anfragen“ statt eines Fehlers. Weitere Regeln: `invoice.url` bzw. Rechnungsnummer (Rückmeldung aus der Faktura-App, `01` Phase 3) nur dem eingeloggten, berechtigten Kunden anzeigen, nie als öffentlichen Link.
- Angebotsanfragen aus dem 3D-Druck-Rechner erscheinen im Konto, wenn sie mit der Konto-E-Mail gestellt wurden.
- **Datenschutz:** „Meine Daten exportieren“ (JSON/CSV), „Konto löschen“, Newsletter-Einwilligung widerrufen.

**Löschung = Anonymisierung:** Wegen Aufbewahrungsfristen wird nicht hart gelöscht. `status = anonymized`, personenbezogene Felder entfernen, `customer_no` und die für die Buchhaltung nötigen Bestelldaten behalten. Die Faktura-App erfährt das über `status` in `/customers/{id}` und legt selbst eine Aufgabe an (Vertrag §10).

## Phase K6 – Admin: Kundenverwaltung

Im vorhandenen Admin-Bereich (gleicher Look, gleiche Rechte-Logik):

- **Kundenliste** mit Suche (Nummer, Name, E-Mail, Firma), Filter (Status, Gast/Konto, neu in 30 Tagen), CSV-Export nur für Admin (mit Audit-Eintrag).
- **Kundendetail:** Stammdaten, Adressen, Bestellungen, Angebotsanfragen, `faktura_customer_no` (falls gemeldet), Änderungsverlauf, interne Notiz.
- Aktionen: bearbeiten, sperren/entsperren, Passwort-Reset auslösen, anonymisieren (mit Bestätigung).
- Rollen: `admin` (alles) und `support` (nur lesen und Notizen, kein Export, keine Anonymisierung). Jede Änderung im Audit-Log.

## Phase K7 – Abgleich mit Zahlung und Bestellstatus

Die Zahlungsintegration (Stripe, Vorkasse, PayPal über Stripe) liefert Zahlungsstatus und Referenz. Die API gibt sie gemäß Vertrag §6.5/§6.6 aus:

- Vorkasse: `payment.method = prepayment`, Status `awaiting_payment` bis zur Bestätigung im Admin, dann `paid`.
- Stripe: `payment.method` (`card`, `paypal`, `apple_pay`, `google_pay`), `transaction_ref` = Stripe-Referenz, `paid_at` aus dem bestätigten Webhook.
- Nur der **bestätigte** Zahlungseingang setzt `paid` und erhöht `updated_at` der Bestellung (Grundlage der Synchronisation).
- Keine Kartendaten, keine IBAN in der API (Vertrag §4).

## Sicherheit und Datenschutz

- Jeder Zugriff auf Kunden-, Bestell- und Rechnungsdaten prüft die Berechtigung (Eigentümer oder Admin). Schreibe Tests gegen **IDOR** (fremde Bestell-/Rechnungs-IDs, fremde Adress-IDs).
- Logs ohne E-Mail, Namen, Adressen, Tokens. Fehlertexte bereinigen.
- E-Mails nur technisch notwendige (Bestätigung, Reset, Bestellung). Werbung nur mit eigener Einwilligung (`marketing_consent`, nicht vorangekreuzt).
- Datenschutzerklärung (Entwurf) ergänzen: Kundenkonto, Speicherdauer, Anonymisierung statt Löschung, Empfänger (Faktura-App des Betreibers, bei Selbstbetrieb keine Drittpartei), Rechte der Betroffenen. Als Entwurf kennzeichnen: juristisch prüfen lassen.
- Backups mit personenbezogenen Daten verschlüsselt ablegen und nach 14 Tagen rotieren.

## Tests

- Nummernvergabe (Parallelität, Bereich, Format, Wiederverwendung), Gast → Konto, Nachtragsmigration.
- API: neue Felder, `updated_at` bei Kundenänderung, anonymisierter Kunde, `/meta`, Freigaben und `config_version`, Pagination ohne Lücken, Gäste mit `customer_id`.
- Konten: Registrierung (Double-Opt-in), Login-Sperre, Reset, neutrale Meldungen, Zugriff auf fremde Daten, Datenexport, Anonymisierung.
- Regression: Warenkorb, Checkout, Rechner, bestehender Admin.

## Definition of Done

- [ ] Alle Kriterien aus Vertrag §12, §13.5 und die **[NEU v1.1]**-Punkte, soweit den Shop betreffend, erfüllt.
- [ ] Jede Bestellung (auch Gast) hat `customer_number` `KD9xxxxx`; keine Duplikate, keine Wiederverwendung, Bereichswarnung funktioniert.
- [ ] Kundenkonto, Datenexport, Anonymisierung und Admin-Kundenverwaltung nutzbar, mit Audit-Log und Rollen.
- [ ] `/meta` und `openapi.yaml` enthalten die neuen Felder; `README-API.md` ergänzt.
- [ ] Migrationen mit Rollback, Backup-Hinweis vor dem Rollout, Abschlussbericht.

## Verboten

- Verbindung des Shops zur Faktura-App aufbauen oder deren Zugangsdaten speichern (Pull-Prinzip).
- Nummern im Bereich `KD7xxxxx` erzeugen, Nummern ändern oder wiederverwenden.
- Eigene Rechnungsnummern erzeugen.
- Meldungen, die verraten, ob eine E-Mail-Adresse bereits existiert.
- Öffentliche, erratbare Rechnungslinks; Kundendaten ohne Berechtigungsprüfung ausliefern.

## Offene Fragen an den Projektinhaber

1. Gäste bekommen eigene Kundennummern (hier so festgelegt, weil die Faktura-App sie braucht). Einverstanden?
2. Soll die Rückmeldung der Zuordnung (K4) gebaut werden, und soll der Kunde im Konto die Faktura-Nummer sehen oder nur die Shop-Nummer?
3. Bereich `KD900001` … `KD999999` so beibehalten?
4. Newsletter geplant (eigene Einwilligung, getrennt vom Konto)?
5. Firmenkunden: USt-IdNr. nur speichern (Standard) oder prüfen?
