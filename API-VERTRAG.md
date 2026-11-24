# API-Vertrag: Shop (3d-mir.de) ⇄ Faktura-App (faktura-app.knutas.de)

> **Dieses Dokument ist die verbindliche Schnittstellenbeschreibung.**
> Beide KIs (Shop-Agent und Faktura-Agent) bekommen exakt diese Datei.
> Abweichungen nur nach Rücksprache mit dem Projektinhaber. Wenn etwas unklar
> oder unpassend ist: **nicht raten, sondern Frage/Änderungsvorschlag notieren**
> (siehe Abschnitt 11).

## 1. Ziel

Die Faktura-App soll Bestellungen, Kunden und Artikel aus dem Shop übernehmen,
um daraus Angebote, Rechnungen und Lieferscheine zu erzeugen.

- **Shop** = führendes System für Bestellungen, Kunden, Artikel (Quelle).
- **Faktura-App** = führendes System für Angebote, Rechnungen, Lieferscheine,
  Rechnungsnummern (Ziel).
- Die beiden laufen auf **verschiedenen Servern** und kommunizieren nur über
  diese HTTPS-API.

## 2. Architektur (Pull-Prinzip)

```
Faktura-App  ──(HTTPS, Bearer-Token)──▶  Shop-API  (/api/v1/...)
     │                                        │
     │  holt neue/geänderte Daten             │  liest nur, ändert nichts
     │  (Abruf per Zeitplan + Button)         │  außer Rückmeldung (Abschn. 7)
```

- Die Faktura-App **ruft** den Shop ab (Pull). Der Shop muss die Faktura-App
  nicht kennen und braucht keinen Zugriff auf deren Datenbank.
- **Die Anbindung ist nicht statisch:** Sie wird auf beiden Seiten im jeweiligen
  Admin-Bereich verwaltet (Abschnitt 13). Nichts Wesentliches ist hartcodiert.
- Optional später: Webhooks als Beschleuniger (Abschnitt 8). Der Pull bleibt
  immer die Wahrheit (Webhook verloren ⇒ nächster Pull holt es nach).

## 3. Basis

| Punkt | Wert |
|---|---|
| Base-URL | `https://www.3d-mir.de/api/v1` |
| Protokoll | ausschließlich HTTPS |
| Format | JSON, UTF-8, `Content-Type: application/json` |
| Authentifizierung | `Authorization: Bearer <API_TOKEN>` |
| Zeitangaben | ISO 8601 in UTC, z. B. `2026-11-23T14:05:00Z` |
| Geldbeträge | **Ganzzahlen in Cent** (kein Float!), Währung `EUR` |
| Mengen | Ganzzahl (Stück) bzw. Dezimal-String, falls nötig |
| IDs | Strings (`"1042"`), unveränderlich, vom Shop vergeben |
| Versionierung | Pfadpräfix `/v1`. Breaking Changes nur über `/v2` |

## 4. Authentifizierung & Sicherheit

- Ein langer, zufälliger Token (mind. 32 Byte, z. B. 64 Hex-Zeichen).
- Shop speichert den Token **nur als Hash** (SHA-256 oder besser), nie im Klartext.
- Token hat **Scopes**: `orders:read`, `customers:read`, `products:read`,
  `orders:write_status` (nur für Rückmeldung, Abschnitt 7).
- Token ist rotierbar/widerrufbar. Mehrere Tokens möglich (z. B. Test/Produktiv).
- Rate-Limit: z. B. 60 Requests/Minute pro Token → bei Überschreitung
  `429` mit `Retry-After`.
- Optional: IP-Allowlist auf die Server-IP der Faktura-App.
- Der Token liegt in der Faktura-App **ausschließlich serverseitig**
  (Umgebungsvariable/Secret), niemals im Frontend, niemals im Git-Repo.
- Keine personenbezogenen Daten in Logfiles (E-Mail/Adresse maskieren).
- Es werden **keine Zahlungsdaten** übertragen (keine IBAN, keine Kartendaten),
  nur Zahlungsart, Zahlungsstatus und Transaktions-Referenz.

## 5. Endpunkte (Lesen)

Alle Listen-Endpunkte unterstützen:

- `limit` (Standard 50, max. 200)
- `cursor` (opaker String aus `next_cursor` der vorherigen Antwort)
- `updated_since` (ISO 8601 UTC; liefert alles mit `updated_at >= Wert`)

Listen sind stabil sortiert nach `updated_at ASC, id ASC`, damit der Abruf
lückenlos fortgesetzt werden kann.

| Methode | Pfad | Scope | Beschreibung |
|---|---|---|---|
| GET | `/health` | beliebig | `{"status":"ok","version":"1.0.0","time":"..."}` |
| GET | `/meta` | beliebig | Selbstbeschreibung: Version, aktive Ressourcen, erlaubte Felder, Status-Liste, Steuermodus, Beispiel-Attribute (Abschnitt 13.3) |
| GET | `/orders` | orders:read | Bestellungen (Filter: `status`, `updated_since`) |
| GET | `/orders/{id}` | orders:read | Eine Bestellung vollständig |
| GET | `/customers` | customers:read | Kunden |
| GET | `/customers/{id}` | customers:read | Ein Kunde |
| GET | `/products` | products:read | Artikel |
| GET | `/products/{id}` | products:read | Ein Artikel |

### Listen-Antwort

```json
{
  "data": [ { "...": "..." } ],
  "next_cursor": "eyJ1IjoiMjAyNi0xMS0yM1QxNDowNTowMFoiLCJpIjoiMTA0MiJ9",
  "has_more": true,
  "server_time": "2026-11-23T14:10:00Z"
}
```

`server_time` dient der Faktura-App als Basis für den nächsten
`updated_since` (abzüglich 60 s Sicherheitspuffer, Duplikate werden über
Idempotenz abgefangen).

## 6. Datenmodelle

### 6.1 Order

```json
{
  "id": "1042",
  "order_number": "3DM-2026-001042",
  "status": "paid",
  "created_at": "2026-11-20T09:12:44Z",
  "updated_at": "2026-11-21T10:03:10Z",
  "currency": "EUR",
  "customer_id": "311",
  "customer_snapshot": {
    "type": "private",
    "company": null,
    "first_name": "Max",
    "last_name": "Mustermann",
    "email": "max@example.com",
    "phone": "+49 170 0000000",
    "vat_id": null
  },
  "billing_address": {
    "name": "Max Mustermann",
    "company": null,
    "street": "Musterstraße 1",
    "address_2": null,
    "postal_code": "75328",
    "city": "Schömberg",
    "country_code": "DE"
  },
  "shipping_address": {
    "name": "Max Mustermann",
    "company": null,
    "street": "Musterstraße 1",
    "address_2": null,
    "postal_code": "75328",
    "city": "Schömberg",
    "country_code": "DE"
  },
  "items": [
    {
      "line_id": "1042-1",
      "product_id": "88",
      "sku": "HALTER-PETG-SW",
      "name": "Halter, PETG schwarz",
      "description": "Füllung 20 %",
      "quantity": 2,
      "unit": "Stk",
      "unit_price_net_cents": 1250,
      "unit_price_gross_cents": 1250,
      "tax_rate_percent": 0,
      "line_total_net_cents": 2500,
      "line_total_gross_cents": 2500,
      "attributes": {
        "material": "PETG",
        "color": "schwarz",
        "infill_percent": 20,
        "model_file": null
      }
    }
  ],
  "shipping": {
    "method": "DHL Paket",
    "cost_net_cents": 490,
    "cost_gross_cents": 490,
    "tax_rate_percent": 0,
    "tracking_number": null,
    "shipped_at": null
  },
  "discounts": [
    { "label": "Gutschein XYZ", "amount_net_cents": 0, "amount_gross_cents": 0 }
  ],
  "totals": {
    "subtotal_net_cents": 2500,
    "shipping_net_cents": 490,
    "discount_net_cents": 0,
    "tax_cents": 0,
    "total_net_cents": 2990,
    "total_gross_cents": 2990
  },
  "tax_info": {
    "small_business_19_ustg": true,
    "note": "Kein Mehrwertsteuerausweis, da Kleinunternehmer nach § 19 UStG."
  },
  "payment": {
    "method": "paypal",
    "status": "paid",
    "paid_at": "2026-11-20T09:15:02Z",
    "transaction_ref": "PAYID-XXXX"
  },
  "customer_note": "Bitte neutral verpacken.",
  "meta": { "source_channel": "shop", "custom_key": "custom_value" },
  "invoice": {
    "number": null,
    "date": null,
    "url": null
  }
}
```

**Order-Status (Enum, genau diese Werte):**
`pending` · `awaiting_payment` · `paid` · `processing` · `shipped` ·
`completed` · `cancelled` · `refunded`

Regeln:
- Bestellungen werden **nie gelöscht**, nur `cancelled`/`refunded` gesetzt.
- Adressen und Artikelnamen/-preise einer Bestellung sind **Snapshots** zum
  Bestellzeitpunkt und ändern sich nachträglich nicht (rechtlich wichtig für
  Rechnungen).
- `tax_info.small_business_19_ustg = true` solange der Shop Kleinunternehmer
  ist; dann ist `tax_rate_percent` überall `0` und `net == gross`.
  Für einen späteren Wechsel zur Regelbesteuerung muss das Modell bereits
  Netto/Brutto/Steuersatz korrekt führen.

### 6.2 Customer

```json
{
  "id": "311",
  "created_at": "2026-10-01T08:00:00Z",
  "updated_at": "2026-11-20T09:12:44Z",
  "type": "private",
  "company": null,
  "first_name": "Max",
  "last_name": "Mustermann",
  "email": "max@example.com",
  "phone": "+49 170 0000000",
  "vat_id": null,
  "billing_address": { "name": "Max Mustermann", "street": "Musterstraße 1", "address_2": null, "postal_code": "75328", "city": "Schömberg", "country_code": "DE" },
  "default_shipping_address": null,
  "is_guest": false,
  "marketing_consent": false
}
```

`type`: `private` | `business`. Gast-Bestellungen: `customer_id = null`,
Daten stehen dann nur in `customer_snapshot`.

### 6.3 Product

```json
{
  "id": "88",
  "sku": "HALTER-PETG-SW",
  "name": "Halter, PETG schwarz",
  "description": "…",
  "unit": "Stk",
  "price_net_cents": 1250,
  "price_gross_cents": 1250,
  "tax_rate_percent": 0,
  "active": true,
  "weight_grams": 35,
  "variants": [],
  "created_at": "2026-09-01T10:00:00Z",
  "updated_at": "2026-11-01T10:00:00Z"
}
```

## 7. Rückmeldung Faktura-App → Shop (Schreiben, minimal)

Damit der Shop (und der Kunde im Konto) die Rechnung kennt:

| Methode | Pfad | Scope |
|---|---|---|
| PATCH | `/orders/{id}/invoice` | orders:write_status |

Body:

```json
{
  "invoice_number": "RE-2026-0042",
  "invoice_date": "2026-11-23",
  "invoice_url": "https://faktura-app.knutas.de/…",
  "delivery_note_number": "LS-2026-0042"
}
```

- Setzt nur die Felder im `invoice`-Objekt der Order; ändert **keine**
  Preise/Positionen/Adressen.
- Idempotent: gleicher Body ⇒ gleiches Ergebnis (`200`).
- Der Shop darf `invoice_url` nur anzeigen, wenn sie ohne Login geschützt
  ist oder Token-gesichert; **keine öffentlichen, erratbaren PDF-Links.**

Optional (Phase 2, nicht in Phase 1 bauen):
`PATCH /orders/{id}/status` mit `{ "status": "shipped", "tracking_number": "…" }`.

## 8. Webhooks (optional, Phase 2)

Shop → Faktura-App `POST https://faktura-app.knutas.de/api/webhooks/shop`

Events: `order.created`, `order.updated`, `customer.updated`, `product.updated`.

```json
{ "event": "order.created", "id": "1042", "occurred_at": "2026-11-20T09:12:44Z" }
```

- Header `X-Signature: sha256=<HMAC-SHA256(body, WEBHOOK_SECRET)>` und
  `X-Timestamp`. Faktura-App prüft Signatur (konstante Zeit) und lehnt
  Nachrichten älter als 5 Minuten ab.
- Webhook enthält **nur die ID**. Die Faktura-App holt die Daten danach per
  `GET /orders/{id}`.
- Antwort der Faktura-App: `2xx` = ok. Sonst Retry mit Backoff (1 min, 5 min,
  30 min, 2 h, 12 h), danach aufgeben (Pull holt es nach).

## 9. Fehlerformat & Statuscodes

```json
{
  "error": {
    "code": "not_found",
    "message": "Order 9999 not found",
    "request_id": "req_01HXYZ..."
  }
}
```

| Code | Bedeutung |
|---|---|
| 200 | OK |
| 400 | Ungültige Parameter (`invalid_request`) |
| 401 | Token fehlt/ungültig (`unauthorized`) |
| 403 | Scope fehlt (`forbidden`) |
| 404 | Nicht gefunden (`not_found`) |
| 422 | Validierungsfehler (`validation_failed`) |
| 429 | Rate-Limit (`rate_limited`, Header `Retry-After`) |
| 500/503 | Serverfehler (Client macht Retry mit Backoff) |

Jede Antwort enthält den Header `X-Request-Id`.

## 10. Nicht-funktionale Anforderungen

- **Idempotenz auf Client-Seite:** Faktura-App legt pro Shop-Objekt genau einen
  Datensatz an (Schlüssel: `source="3d-mir"`, `external_id`). Mehrfaches
  Importieren erzeugt **keine Duplikate**.
- **Rechtliches (GoBD/DE):** Importierte Bestellungen erzeugen nur **Entwürfe**.
  Eine Rechnung bekommt ihre endgültige, lückenlose Rechnungsnummer erst beim
  bewussten „Finalisieren“ in der Faktura-App. Finalisierte Rechnungen werden
  nie durch einen späteren Import verändert.
- **Zeitzonen:** Speicherung UTC, Anzeige `Europe/Berlin`.
- **DSGVO:** Nur Felder übertragen, die für Rechnung/Lieferung nötig sind.
  `marketing_consent` nur informativ, keine Werbe-Nutzung ohne Einwilligung.
- **Performance:** Abruf in Seiten (`limit`), nie „alles auf einmal“.
- **Beobachtbarkeit:** Jede Seite loggt `request_id`, Dauer, Anzahl, Status.

## 11. Zusammenarbeit der beiden KIs

Beide KIs arbeiten getrennt, daher:

1. **Dieser Vertrag ist die einzige gemeinsame Quelle.** Keine Annahmen über
   den Code der Gegenseite.
2. Muss ein Agent vom Vertrag abweichen (z. B. Feld fehlt im Shop), legt er
   eine Datei `VERTRAGS-ANMERKUNGEN.md` in seinem Repo an mit:
   *Problem · Vorschlag · Auswirkung*. Der Projektinhaber entscheidet und
   aktualisiert diesen Vertrag; danach wird die neue Version an beide gegeben.
3. Der Shop-Agent liefert am Ende eine `openapi.yaml` (OpenAPI 3.1) sowie
   Beispiel-Antworten. Der Faktura-Agent entwickelt bis dahin gegen
   Mock-Daten aus Abschnitt 6.
4. Gemeinsamer Abnahmetest: siehe Abschnitt 12.

## 12. Abnahmekriterien (Ende-zu-Ende)

- [ ] `GET /health` aus der Faktura-App mit gültigem Token → 200.
- [ ] Ungültiger/fehlender Token → 401, falscher Scope → 403.
- [ ] Testbestellung im Shop → erscheint nach Sync als **Entwurf** in der Faktura-App.
- [ ] Zweiter Sync erzeugt **keine** Duplikate (Order, Kunde, Artikel).
- [ ] Geänderte Bestellung (Status `paid` → `shipped`) wird aktualisiert,
      solange die Rechnung noch nicht finalisiert ist.
- [ ] Beträge stimmen auf den Cent mit dem Shop überein (Summe der Positionen
      + Versand − Rabatt = Gesamtsumme).
- [ ] Kleinunternehmer-Hinweis (§ 19 UStG) steht auf der Rechnung, keine USt.
- [ ] Rückmeldung (Rechnungsnummer) ist danach in der Shop-Bestellung sichtbar.
- [ ] Stornierte Bestellung wird als storniert markiert, keine Rechnung wird
      automatisch gelöscht.
- [ ] Bei Shop-Ausfall (503/Timeout) bricht die Faktura-App sauber ab, zeigt
      den Fehler an und macht beim nächsten Lauf weiter.

## 13. Verwaltbarkeit: Admin-Bereich auf beiden Seiten

Die Anbindung muss **ohne Code-Änderung** im Admin-Bereich beider Systeme
steuerbar sein. Rollenverteilung: Der **Shop entscheidet, was er herausgibt**
(Freigabe), die **Faktura-App entscheidet, was sie davon übernimmt und wie**
(Zuordnung). Beide Seiten müssen mit Konfigurationsänderungen der Gegenseite
robust umgehen können.

### 13.1 Shop-Admin („API & Schnittstellen“)

Nur für Admin-Rolle, alle Änderungen werden im Audit-Log protokolliert
(wer, wann, was, alt → neu).

| Bereich | Einstellungen |
|---|---|
| API gesamt | API aktiv/inaktiv (Not-Aus-Schalter), Rate-Limit, Wartungsmodus (liefert `503` + `Retry-After`) |
| Tokens | Anlegen, benennen, Scopes wählen, Ablaufdatum, IP-Allowlist, sperren/widerrufen, rotieren (Übergangszeit mit altem+neuem Token), „zuletzt benutzt“ |
| Freigabe Ressourcen | je Ressource an/aus: Bestellungen, Kunden, Artikel |
| Freigabe Bestellungen | welche **Status** ausgeliefert werden, ab Datum (`ab_datum`), nur bezahlte ja/nein, Gast-Bestellungen ja/nein |
| Freigabe Felder | je Feld-Gruppe an/aus (z. B. Telefon, USt-IdNr., Kundennotiz, Marketing-Einwilligung, 3D-Druck-Attribute, Modelldatei-Referenz). Pflichtfelder (IDs, Beträge, Adressen, Positionen) sind nicht abschaltbar |
| Freigabe Artikel | nur aktive, nur bestimmte Kategorien, nur mit SKU |
| Zusatzfelder | frei definierbare Schlüssel/Werte, die in `order.meta` bzw. `items[].attributes` ausgegeben werden (z. B. Kostenstelle, Kampagne). Zuordnung Shop-Feld → API-Schlüssel |
| Webhooks | Ziel-URL, Secret (anzeigen/neu erzeugen), welche Events, aktiv/inaktiv, Test-Event senden, Zustellprotokoll mit „erneut senden“ |
| Rückmeldung | ob Rechnungsnummer/-link per `PATCH /invoice` angenommen und im Shop angezeigt werden (an/aus) |
| Überwachung | Zugriffs-Log (Zeit, Token-Name, Endpunkt, Status, Dauer, Anzahl), Fehlerliste, letzter Abruf je Token |
| Test | Button „Beispielantwort ansehen“ (zeigt exakt, was die API mit den aktuellen Freigaben ausliefert, ohne Token-Aufruf) |

Verhalten der API:
- Die Freigaben gelten **sofort** und für jeden Abruf (kein Neustart nötig).
- Nicht freigegebene Felder werden **weggelassen** (nicht `null` mit Fehler);
  nicht freigegebene Ressourcen antworten `403 resource_disabled`.
- Nicht freigegebene Bestellstatus werden in Listen nicht ausgeliefert.
  **Wechselt eine bereits ausgelieferte Bestellung in einen nicht freigegebenen
  Status, wird sie weiterhin geliefert**, damit die Faktura-App Änderungen
  (z. B. Storno) nicht verpasst.
- Jede Änderung der Freigabe-Konfiguration erhöht `config_version` (in `/meta`
  und im Header `X-Config-Version`).

### 13.2 Faktura-Admin („Integrationen → Shop“)

Nur Admin-Rolle, Audit-Log wie oben, **alles pro Mandant** (falls die App
mandantenfähig ist).

| Bereich | Einstellungen |
|---|---|
| Verbindung | Base-URL, Token (maskiert, ersetzbar), Verbindung testen, Integration aktiv/pausiert |
| Synchronisation | Intervall (z. B. 5/10/15/60 min oder nur manuell), je Ressource an/aus, Startdatum („nur Bestellungen ab …“), „Jetzt synchronisieren“, „Komplett neu einlesen“ (mit Warnung) |
| Auswahl/Regeln | welche Shop-Status → welche Aktion: *ignorieren* / *nur Inbox* / *Rechnungsentwurf* / *Angebotsentwurf* / *Lieferscheinentwurf* (Tabelle, frei konfigurierbar) |
| Feld-Zuordnung | Tabelle *Shop-Feld → Feld der Faktura-App* mit Standardvorgabe, je Zeile: aktiv/inaktiv, Ziel-Feld, Transformation (Text kürzen, Präfix/Suffix, Wert ersetzen, Standardwert wenn leer) |
| Zusatzfelder | `order.meta.*` und `items[].attributes.*` einem Zielfeld zuordnen (z. B. Positionsbeschreibung, interne Notiz, Freitext-Feld) oder ignorieren |
| Belegvorgaben | Standard-Belegart, Zahlungsbedingungen/-ziel, Einleitungs-/Schlusstext, Kleinunternehmer-Hinweistext (Vorlage), Standard-Konto/Kategorie, Versandkosten-Bezeichnung, Nummernkreis-Zuordnung |
| Kundenabgleich | Strategie bei möglicher Dublette: *immer fragen* / *per E-Mail automatisch zuordnen* / *immer neu anlegen* |
| Artikel | Preise/Texte aus Shop überschreiben: *nie* / *nur bei neuen Artikeln* / *immer*; unbekannte Artikel: *anlegen* / *als freie Position* |
| Änderungsverhalten | Umgang mit Shop-Änderungen: Entwurf automatisch aktualisieren *ja/nein*; bei finalisierten Belegen nur Hinweis (nicht abschaltbar) |
| Rückmeldung | an Shop melden *ja/nein*, was gemeldet wird |
| Webhook | Empfang aktiv/inaktiv, Secret, letzte Ereignisse |
| Vorschau/Dry-Run | „Testlauf ohne Speichern“: zeigt, was bei aktueller Konfiguration importiert würde (Anzahl, Beispielbelege, Warnungen) |
| Protokoll | Sync-Läufe, Fehler, je Bestellung „erneut verarbeiten“ |

### 13.3 Selbstbeschreibung `GET /meta`

Damit die Faktura-App ihre Zuordnungs-Oberfläche **dynamisch** aufbauen kann:

```json
{
  "api_version": "1.0.0",
  "config_version": 17,
  "tax_mode": "small_business_19_ustg",
  "resources": { "orders": true, "customers": true, "products": false },
  "order_statuses_exposed": ["paid","processing","shipped","completed","cancelled","refunded"],
  "fields": {
    "orders": ["id","order_number","status","items","shipping","totals","payment","customer_note","meta.source_channel"],
    "customers": ["id","email","first_name","last_name","phone"],
    "item_attributes": ["material","color","infill_percent","model_file"]
  },
  "webhooks_enabled": false,
  "server_time": "2026-11-23T14:10:00Z"
}
```

Die Faktura-App ruft `/meta` bei „Verbindung testen“, vor jedem Sync-Lauf
und beim Öffnen der Zuordnungs-Seite ab. Neue Felder (z. B. in `meta.*`)
erscheinen dort automatisch als zuordenbar.

### 13.4 Robustheit bei Konfigurationsänderungen

- **Faktura-App** darf bei fehlenden, neuen oder umbenannten Feldern nicht
  abstürzen: fehlendes optionales Feld → Standardwert/leer; fehlendes
  Pflichtfeld → Datensatz in die Inbox mit Fehler, Lauf geht weiter.
- Ändert sich `config_version`, zeigt die Faktura-App einen Hinweis
  „Shop-Konfiguration hat sich geändert – Zuordnung prüfen“ und lädt `/meta`
  neu. Ein Neuabgleich bereits importierter Daten passiert nur auf Wunsch.
- **Shop** nimmt Freigaben nie rückwirkend zurück für bereits finalisierte
  Rechnungen: Daten, die schon in einem Beleg stehen, bleiben dort.
- Konfigurationen sind **export-/importierbar** (JSON, ohne Secrets), damit
  Test- und Produktivsystem gleich eingerichtet werden können.
- Standardwerte: Beide Seiten liefern eine sinnvolle Grundkonfiguration, mit
  der die Anbindung ohne Eingabe sofort funktioniert („Zurücksetzen auf
  Standard“-Button).

### 13.5 Zusätzliche Abnahmekriterien

- [ ] Im Shop-Admin wird ein Feld (z. B. Telefon) abgeschaltet → erscheint beim
      nächsten Abruf nicht mehr; Faktura-App läuft fehlerfrei weiter.
- [ ] Im Shop-Admin wird ein Status abgeschaltet → neue Bestellungen in diesem
      Status werden nicht ausgeliefert; bereits importierte Bestellungen
      melden Änderungen weiterhin.
- [ ] Zusatzfeld im Shop angelegt → taucht in `/meta` auf und ist in der
      Faktura-App zuordenbar.
- [ ] In der Faktura-App wird die Status-Regel geändert (z. B. `paid` →
      Angebot statt Rechnung) → der nächste Import verhält sich entsprechend.
- [ ] Token im Shop-Admin gesperrt → Faktura-App meldet verständlich
      „Zugriff verweigert“ und pausiert nach mehrfachem Fehlschlag.
- [ ] Not-Aus im Shop-Admin → API antwortet `503`, Faktura-App bricht sauber ab.
- [ ] „Testlauf (Dry-Run)“ in der Faktura-App speichert nichts.
- [ ] Alle Konfigurationsänderungen erscheinen im Audit-Log beider Systeme.
