# Vertrags-Anmerkungen (Shop-Agent)

**Stand:** 24. November 2026 · **Vertrag:** `API-VERTRAG.md` (identisch mit `ANWEISUNG-SHOP-AGENT.md`)

Nach Abschnitt 11 des Vertrags werden hier Abweichungen und offene Fragen festgehalten.
Der Projektinhaber entscheidet; nach einer Vertragsaktualisierung werden die Änderungen
an beide Agents gegeben. Einträge mit „umgesetzt" beschreiben den aktuellen Stand der
Shop-Implementierung, nicht bereits eine vertragliche Einigung.

| Nr. | Problem | Vorschlag | Auswirkung | Status |
|---|---|---|---|---|
| A1 | Der Shop hat **keine `customers`-Tabelle**. Kundendaten stehen als Snapshot in `orders` (E-Mail, Telefon, Firma, Name, Adresse). | Kunden aus `orders` nach normalisierter E-Mail ableiten; `id` = `usr_` + 16 Hex-Zeichen SHA-256 der E-Mail (bei angemeldeten Bestellungen `user_id` bevorzugt). `type` aus `company`, `vat_id`/`marketing_consent`/`is_guest` nicht vorhanden → `null`/`false`. | `/customers` liefert abgeleitete Datensätze; neue Felder brauchen eine echte Kunden-Tabelle. | umgesetzt, Rückmeldung erbeten |
| A2 | Interne Bestellstatus sind deutsch (`neu`, `bezahlt`, `in_druck`, `versandt`, `abgeschlossen`, `storniert`) und der Zahlungsstatus separat. | Mapping: `neu`→`pending`/`awaiting_payment` (je nach `payment_status`), `bezahlt`→`paid`, `in_druck`→`processing`, `versandt`→`shipped`, `abgeschlossen`→`completed`, `storniert`→`cancelled`, `payment_status=erstattet`→`refunded`. Nach außen erscheinen **nur** die Vertrags-Werte. | Keine Änderung an internen Daten; die Faktura-App sieht das definierte Enum. | umgesetzt |
| A3 | `order_items` speichert Name, Preis und Menge als Snapshot, aber **kein SKU/Material zum Bestellzeitpunkt**; `model_file` wird nicht mit der Bestellung gespeichert. | `sku`/`material` aus dem aktuellen Produkt, `variant`/`color`/`personalization` aus `order_items`; `model_file: null`. | Eine spätere Produktänderung kann diese Attribute verändern. Name/Preis/Adresse bleiben Snapshots. | umgesetzt, Rückmeldung erbeten |
| A4 | Der Shop ist Kleinunternehmer; Preise sind Brutto, es gibt keine Netto-/Steuerspalten. | `tax_rate_percent = 0`, `net == gross`, `tax_info.small_business_19_ustg = true`, Hinweis aus `config/site.json`. | Bei Wechsel zur Regelbesteuerung müssen Netto/Brutto/Steuer im Shop ergänzt werden; das Datenmodell ist darauf vorbereitet. | umgesetzt |
| A5 | Bestellungen haben **eine** Adresse (`address_extra` = Adresszusatz), keine getrennte Rechnungs-/Lieferadresse. | `billing_address` und `shipping_address` erhalten beide denselben Snapshot; `address_2` aus `address_extra`. | Abweichende Lieferadressen können nicht übermittelt werden. | umgesetzt, Rückmeldung erbeten |
| A6 | Vertrag Abschnitt 8 (Webhooks) und optionales `PATCH /orders/{id}/status` sind als **Phase 2** markiert. | In Phase 1 nicht gebaut. `/meta` meldet `webhooks_enabled: false`; die Admin-Oberfläche zeigt einen Hinweis. | Beschleuniger und Status-Rückmeldung erst nach Freigabe. | wie vertraglich vorgesehen |
| A7 | „Bereits ausgelieferte Bestellungen weiter liefern, auch wenn der Status nicht mehr freigegeben ist" erfordert Merkung. | Internes Feld `orders.api_first_exposed_at` wird beim ersten Ausliefern gesetzt. Es ist kein Geschäftsdatum und wird nicht über die API verändert. | Zusätzliche Spalte in der Shop-DB; kein Einfluss auf Preise/Belege. | umgesetzt |
| A8 | `invoice_url` darf nur geschützt oder token-gesichert sein. | API akzeptiert `https://…`; Anzeige im Shop nur, wenn Admin „Rechnungslink anzeigen" aktiv ist. Der Betreiber muss sicherstellen, dass die Ziel-URL nicht öffentlich erratbar ist. | Bei falsch konfiguriertem Ziel liegt das Risiko beim Betreiber. | umgesetzt, Rückmeldung erbeten |
| A9 | Produkte haben `price_from_cents`/`price_to_cents`, `weight_g` (REAL), `product_variants`, aber kein `unit`/Netto/Brutto. | `unit: "Stk"`, `price_*_cents` aus `price_from_cents` (Fallback `price_to_cents`), `weight_grams = round(weight_g)`, Varianten aus `product_variants`. | Bei Produkten mit Preisspanne wird der From-Preis übermittelt. | umgesetzt, Rückmeldung erbeten |
| A10 | Token-Rotation soll eine Übergangszeit erlauben. | Alter Token bleibt nach der Rotation 24 Stunden gültig (`rotated_at`), danach automatisch ungültig; explizites Sperren wirkt sofort. | Während 24 h sind beide Tokens gültig. | umgesetzt, Rückmeldung erbeten |
| A11 | `/health` soll laut Vertrag `version: "1.0.0"` liefern; die App-Version ist `1.0.0-rc.N`. | `/api/v1/health` meldet die **API-Vertragsversion** `1.0.0`; `/api/health` bleibt bei der App-Version. | Zwei verschiedene Versionsangaben – bewusst getrennt. | umgesetzt |

## Kundenkonten – offene Fragen aus Phase K0 (25.11.2026)

| Nr. | Problem | Vorschlag | Auswirkung | Status |
|---|---|---|---|---|
| KQ0 | Die echte v1.2 wurde nachgeliefert und als `API-VERTRAG.md` im Repo hinterlegt (Abschnitt 14, §7.2, `[NEU v1.1/v1.2]`). Die Umbenennung `ANWEISUNG-SHOP-AGENT.md` → `01-ANWEISUNG-SHOP-AGENT.md` ist geklärt (identisch mit alter Vertragsfassung). | Erledigt – v1.2 ist verbindliche Grundlage. | K3/K4 können umgesetzt werden. | ✅ erledigt (25.11.2026) |
| KQ1 | Gäste bekommen eigene Kundennummern. | Vom Vertrag v1.2 §6.2/§6.4 verbindlich festgelegt: ja, `KD9xxxxx`, Zuordnung über normalisierte E-Mail. | Umgesetzt in K1/K2. | ✅ durch v1.2 entschieden |
| KQ2 | ✅ Erledigt | Faktura-Kundennummer wird im Kundenkonto angezeigt (falls gemeldet), sonst „Noch keine Zuordnung". Die Shop-Nummer bleibt unverändert. *(26.11.2026)* |
| KQ3 | Bereich `KD900001` … `KD999999` beibehalten? | Vom Vertrag v1.2 §6.4 festgelegt; `config/site.json` enthält `customerNumber` mit 90 % Warnschwelle. | Nur Anzeige im Admin, Zähler nicht editierbar. | ✅ durch v1.2 entschieden |
| KQ4 | ✅ Erledigt | Newsletter mit eigener Einwilligung umgesetzt (`/newsletter/`, Double-Opt-in, getrennt von `marketing_consent`, Abmeldelink in jeder Mail). *(26.11.2026)* |
| KQ5 | ✅ Erledigt | Empfehlung umgesetzt: USt-IdNr. wird nur gespeichert, nicht extern geprüft und nicht in Belege aufgenommen. Als Kleinunternehmer nach § 19 UStG bleibt `tax_rate_percent = 0` und es erfolgt kein Ausweis. Bei Wechsel zur Regelbesteuerung neu entscheiden. *(26.11.2026)* |
