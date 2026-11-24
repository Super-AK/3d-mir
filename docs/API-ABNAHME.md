# Abnahme-Checkliste: Shop-API ⇄ Faktura-App

**Stand:** 24. November 2026 · **Vertrag:** `API-VERTRAG.md` · **Abweichungen:** `VERTRAGS-ANMERKUNGEN.md`

Diese Liste ist für den gemeinsamen Ende-zu-Ende-Test beider Systeme. Der Shop ist
technisch geprüft (Unit- und E2E-Tests); die Punkte hier brauchen die echte
Faktura-App und einen dort serverseitig hinterlegten Token.

## Vorbereitung

1. Im Shop unter **Admin → API & Schnittstellen** einen Token mit den Scopes
   `orders:read`, `customers:read`, `products:read` und `orders:write_status`
   anlegen. Der Klartext erscheint nur einmal – nie in Repo, Ticket oder E-Mail.
2. Token in der Faktura-App als Secret hinterlegen (serverseitig, z. B. Env-Variable).
3. Für die Kommandos unten lokal (ohne Commit) setzen:
   `export API_TOKEN='…'`, `export API='https://www.3d-mir.de/api/v1'`.
4. Für Webhooks: Ziel-URL, Secret und Ereignisse im Shop-Admin eintragen und
   denselben Secret in der Faktura-App hinterlegen.

## 1. Verbindung und Authentifizierung (Kap. 12)

- [ ] `GET $API/health` mit gültigem Token → `200`, `version: "1.0.0"`, Header `X-Request-Id`.
- [ ] Ohne Token → `401`, Fehlerformat `{"error":{"code":"unauthorized",…}}`.
- [ ] Token mit falschem Scope → `403` (`forbidden`), z. B. `/customers` ohne `customers:read`.
- [ ] `GET $API/meta` → `200`; `config_version`, `resources`, `order_statuses_exposed`,
      `tax_mode` und `fields` passen zur Admin-Konfiguration.

```bash
curl -sS -D - -H "Authorization: Bearer $API_TOKEN" "$API/health"
curl -sS -H "Authorization: Bearer $API_TOKEN" "$API/meta" | jq .
```

## 2. Import und Idempotenz (Kap. 12)

- [ ] Testbestellung im Shop anlegen (bezahlte und unbezahlte Variante).
- [ ] Erster Sync: Bestellung erscheint als **Entwurf**, nicht als finalisierte Rechnung.
- [ ] Zweiter Sync mit gleichem `updated_since`: **keine Duplikate** bei Order, Kunde, Artikel.
      Schlüssel in der Faktura-App: `source="3d-mir"`, `external_id`.
- [ ] Kunden und Artikel ebenfalls genau einmal angelegt.
- [ ] Beträge stimmen auf den Cent: Summe Positionen + Versand − Rabatt = Gesamtsumme.
- [ ] Kleinunternehmer-Hinweis (§ 19 UStG) auf dem Entwurf; keine USt ausgewiesen.

```bash
curl -sS -H "Authorization: Bearer $API_TOKEN" "$API/orders?limit=2" | jq .
curl -sS -H "Authorization: Bearer $API_TOKEN" "$API/customers?limit=2" | jq .
curl -sS -H "Authorization: Bearer $API_TOKEN" "$API/products?limit=2" | jq .
```

## 3. Pagination und Aktualisierung (Kap. 12)

- [ ] Mit `limit=1` und `next_cursor` werden alle Bestellungen lückenlos erfasst.
- [ ] `updated_since = server_time - 60s` liefert auch knapp davor geänderte Datensätze.
- [ ] Statuswechsel `paid → shipped` in der Faktura-App per
      `PATCH /orders/{id}/status` wird im Shop sichtbar und löst ein `order.updated`-Webhook aus.
- [ ] Solange die Rechnung **nicht finalisiert** ist, wird der Entwurf aktualisiert.
- [ ] Nach dem Finalisieren ändert ein erneuter Import den Beleg **nicht** mehr;
      die Faktura-App zeigt nur einen Hinweis.

```bash
curl -sS -X PATCH -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"shipped","tracking_number":"0034..."}' \
  "$API/orders/1042/status" | jq .status
```

## 4. Rückmeldung und Storno (Kap. 12)

- [ ] `PATCH /orders/{id}/invoice` mit Rechnungsnummer, Datum und (optional) Link → `200`.
- [ ] Zweiter Aufruf mit gleichem Body → `200`, kein zweites Audit-Ereignis.
- [ ] Rechnungsnummer und Datum erscheinen im Shop unter **Admin → Bestellungen → Bestellung**.
- [ ] Link wird nur angezeigt, wenn „Rechnungslink anzeigen" aktiv und die URL token-gesichert ist.
- [ ] Stornierte Bestellung wird als `cancelled` geliefert; es wird **keine** Rechnung automatisch gelöscht.
- [ ] `payment_status=erstattet` wird als `refunded` geliefert.

```bash
curl -sS -X PATCH -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"invoice_number":"RE-2026-0042","invoice_date":"2026-11-24","invoice_url":"https://…?token=…","delivery_note_number":"LS-2026-0042"}' \
  "$API/orders/1042/invoice" | jq .invoice
```

## 5. Konfigurationsänderungen (Kap. 13.5)

- [ ] Shop-Admin: Feld „Telefon" abschalten → beim nächsten Abruf fehlt `phone`;
      die Faktura-App läuft ohne Fehler weiter (fehlendes Optionalfeld → leer).
- [ ] Shop-Admin: Status `bezahlt` abschalten → neue Bestellungen in diesem Status
      werden nicht ausgeliefert; bereits importierte melden Änderungen weiterhin.
- [ ] Shop-Admin: Zusatzfeld anlegen → erscheint in `/meta` und ist in der
      Faktura-App zuordenbar (nach „Zuordnung prüfen").
- [ ] Faktura-Admin: Status-Regel ändern (z. B. `paid` → Angebot statt Rechnung)
      → der nächste Import erzeugt die neue Belegart.
- [ ] Shop-Admin: Token sperren → Faktura-App meldet „Zugriff verweigert" und
      pausiert nach mehrfachem Fehlschlag.
- [ ] Shop-Admin: Not-Aus oder Wartungsmodus → API antwortet `503` mit
      `Retry-After`; die Faktura-App bricht sauber ab und macht beim nächsten Lauf weiter.
- [ ] Faktura-App: „Testlauf (Dry-Run)" speichert nichts.
- [ ] Alle Konfigurationsänderungen erscheinen im Audit-Log **beider** Systeme.

## 6. Webhooks (Phase 2)

- [ ] Test-Event im Shop-Admin senden → Faktura-App antwortet `2xx`; Zustellprotokoll
      zeigt „zugestellt" mit Signatur und Timestamp.
- [ ] Bei `4xx/5xx` oder Timeout: Retry nach 1/5/30/120/720 Minuten, danach „aufgegeben".
- [ ] Webhook enthält nur `event`, `id`, `occurred_at`; die Daten werden per
      `GET /orders/{id}` nachgeholt.
- [ ] Ausgebliebener Webhook wird beim nächsten Pull nachgeholt (Pull bleibt Wahrheit).

## 7. Ergebnis

| Datum | Tester | Ergebnis | Offene Punkte (F-Nummer) |
| --- | --- | --- | --- |
| | | ☐ bestanden ☐ fehlgeschlagen | F87–F93 |
