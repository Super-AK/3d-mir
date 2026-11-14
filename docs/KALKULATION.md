# Kalkulation des 3D-Druck-Rechners

> **Status: Vom Betreiber am 14.11.2026 bestätigt.** Die Werte in
> `config/pricing.json` gelten als freigegeben. Die Preise im Rechner sind
> weiterhin unverbindliche Schätzungen; der verbindliche Preis steht im
> individuellen Angebot.

## Ziele

- Server und Browser verwenden **dieselbe Formel** (`src/lib/pricing.ts`).
- Der Browser zeigt eine sofortige Live-Schätzung; der Server rechnet bei der
  Angebotsanfrage erneut und speichert das Ergebnis zur Anfrage.
- Keine erfundenen Geschäftsdaten: Materialpreise, Maschinenstundensätze,
  Rüstkosten, Mindestauftragswert und Rabattstaffel sind konfigurierbar.

## Eingaben

| Eingabe | Quelle | Grenzen |
| --- | --- | --- |
| Volumen, Oberfläche, Maße | STL/OBJ/3MF-Analyse (`src/lib/mesh.ts`) | max. 50 MB Upload, max. 500.000 Dreiecke |
| Skalierung | Formular | 10–400 % |
| Füllgrad | Formular | 0–100 % (Standard 20 %) |
| Schichthöhe | Formular | 0,05–0,6 mm (Standard 0,2 mm) |
| Stückzahl | Formular | 1–500 |
| Material | `materials` | Dichte, Preis pro Gramm, Farben |
| Drucker | `printers` | Bauraum, Stundensatz, freigegebene Materialien |
| Nachbearbeitung | `coatings` | Preis pro Teil, prozentualer Aufschlag |

## Formel

Alle Längen werden intern in Zentimetern gerechnet, Preise in Cent.

1. **Skalierte Geometrie**
   - `Volumen = Volumen_Datei × Skalierung³`
   - `Oberfläche = Oberfläche_Datei × Skalierung²`
   - `Maße = Maße_Datei × Skalierung`

2. **Materialvolumen**
   - `Wandvolumen = min(Volumen, Oberfläche × Wandstärke)`
   - `Innenvolumen = Volumen − Wandvolumen`
   - `Material pro Teil = (Wandvolumen + Innenvolumen × Füllgrad) × (1 + Verschnitt)`
   - `Gesamtmaterial = Material pro Teil × Stückzahl`
   - `Gewicht = Gesamtmaterial × Dichte`

3. **Druckzeit**
   - `Druckzeit = Gesamtmaterial / Materialdurchsatz × (0,2 mm / Schichthöhe)^0,3`
   - Der Exponent bildet den Zeitgewinn durch dickere Schichten näherungsweise ab.

4. **Preisbestandteile**
   - `Materialkosten = Gewicht × Preis pro Gramm`
   - `Maschinenkosten = Druckzeit × Stundensatz des Druckers`
   - `Nachbearbeitung = Preis pro Teil × (1 + Aufschlag) × Stückzahl`
   - `Rüstkosten = Rüstkosten + Zusatz pro weiterem Teil × (Stückzahl − 1)`

5. **Rabatt und Mindestwert**
   - `Mengenrabatt = (Material + Maschine + Nachbearbeitung) × Rabattprozent`
   - `Zwischensumme = Material + Maschine + Nachbearbeitung + Rüstkosten − Rabatt`
   - `Mindestanpassung = max(0, Mindestauftragswert − Zwischensumme)`
   - `Endpreis = aufgerundet(Zwischensumme + Mindestanpassung, Rundungsschritt)`

Die Positionen werden im Rechner und in der Anfrage-E-Mail einzeln ausgewiesen.

## Parameter in `config/pricing.json`

| Schlüssel | Bedeutung | Aktueller Wert |
| --- | --- | --- |
| `meta.minOrderValue` | Mindestauftragswert in Euro | 15,00 € |
| `meta.setupFee` | Rüstkosten pro Auftrag | 3,50 € |
| `meta.setupFeePerExtraPart` | Zusatz pro weiterem Teil | 0,75 € |
| `meta.roundTo` | Rundungsschritt in Euro | 0,10 € |
| `calculation.wallThicknessMm` | Rechenwandstärke für Schalenmodell | 1,2 mm |
| `calculation.materialCm3PerHour` | Durchsatz pro Drucker (vereinfacht) | 10 cm³/h |
| `calculation.wastePercent` | Verschnitt/Fehldrucke | 5 % |
| `materials[].pricePerGram` | Materialpreis | 0,05–0,10 €/g |
| `printers[].hourlyRate` | Maschinenstundensatz | 1,20–2,50 €/h |
| `quantityDiscounts` | Rabattstaffel | 3 Teile 5 %, 5 Teile 10 %, 10 Teile 15 %, 25 Teile 20 % |

## Grenzen des Modells

- Das Schalenmodell ist eine **Näherung**. Es kennt weder Stützstrukturen noch
  Infill-Muster, Wandlinien, Füllungen oder Bauteilorientierung.
- Der Durchsatz ist ein Mittelwert über beide Drucker; große oder filigrane
  Teile können deutlich länger dauern.
- Der Mindestauftragswert und die Rundung werden erst nach allen Positionen
  angewendet.
- Bei mehr als 100 Teilen erscheint ein Hinweis auf ein individuelles Angebot.
- Überschreitet das Modell den Bauraum, wird gewarnt; die Anfrage bleibt
  trotzdem möglich, damit wir Alternativen prüfen können.

## Änderung der Werte

1. `config/pricing.json` bearbeiten (nur bestätigte Werte eintragen).
2. `meta.status`/`calculation.status` von `PLATZHALTER` auf `BESTAETIGT`
   setzen und `hinweis` entfernen oder anpassen.
3. `npm test` ausführen (die Unit-Tests prüfen Mindestwert, Rabatt, Rundung
   und Bauraum).
4. `npm run build`, Dienst neu starten, Rechner mit einem Testmodell prüfen.

Die Datei ist die einzige Quelle für Preise; im Code stehen keine Preise.
