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
| Mengenrabatt | Staffel ab Stückzahl, Rabatt in Prozent | ✓ | ✓ |

**Speichern:** Alle Änderungen werden mit einer Schaltfläche am Seitenende gespeichert. Löschmarkierungen gelten erst beim Speichern.

**Neu anlegen:** Die Zeile „Neues …“ am Ende jeder Tabelle ausfüllen. Eine leere Zeile wird ignoriert. Die ID wird aus der Bezeichnung erzeugt (`PLA Tough` → `pla-tough`) und bei Bedarf durchnummeriert.

**Löschen:** Mindestens ein Material, ein Drucker, eine Nachbearbeitung und eine Versandart müssen bestehen bleiben. Mengenrabattstaffeln dürfen vollständig entfernt werden. Wird ein Material gelöscht, entfernen sich seine Verknüpfungen zu Druckern automatisch.

**Aktiv:** Materialien, Drucker, Nachbearbeitung und Versandarten haben eine Checkbox „Aktiv“. Inaktive Einträge bleiben im Admin erhalten, werden aber im Rechner, im Shop, im Checkout und auf der Seite „Versandarten und Kosten“ nicht angezeigt. Mindestens ein Eintrag je Bereich muss aktiv bleiben.

**Versandseite:** Die öffentliche Seite `/versand/` wird aus den Versandarten unter „Preise → Versand“ erzeugt. Bezeichnung, Preis, Lieferzeit und die Schwelle für kostenlosen Versand erscheinen dort automatisch; inaktive Versandarten werden ausgeblendet.

**Wo liegen die Daten?** `config/pricing.json` bleibt die dokumentierte Grundeinstellung. Änderungen im Admin werden als `pricing.overrides` in der Tabelle `settings` gespeichert und überlagern die JSON-Datei ohne Neustart. Sobald ein Katalog im Admin gespeichert wurde, gilt die Datenbank als führend; „Auf Grundeinstellung zurücksetzen“ löscht die Überlagerung und stellt `config/pricing.json` wieder her.

**Hinweise:**

- Preise sind weiterhin Platzhalter, bis der Betreiber sie bestätigt.
- Gelöschte Materialien/Drucker bleiben in alten Angebotsanfragen als ID erhalten; die Anzeige fällt auf die ID zurück.
- Gelöschte Versandarten in alten Bestellungen werden ebenfalls als ID angezeigt.
- Die Materialauswahl eines Druckers steuert, für welche Materialien er im Rechner angeboten wird. Ohne Auswahl gilt der Drucker für alle Materialien.

## Produkte und Bilder

Unter **Admin → Produkte** lassen sich Produkte, Farbvarianten und Bilder pflegen.

### Produktdaten

Name, Slug, Kurz- und Langbeschreibung, Preise, SKU, Gewicht, Maße, Lagerbestand, Sortierung und Sichtbarkeit. Der Slug bestimmt die URL `/shop/<slug>/`.

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
