# Analyse der bestehenden Webseite (Ist-Zustand)

Stand der Erfassung: 11.11.2026 · Quelle: `https://www.3d-mir.de`

## Technischer Ist-Zustand

| Merkmal | Befund |
| --- | --- |
| CMS | WordPress mit Theme **Neve** |
| Shop | WooCommerce (+ WooCommerce Germanized, WooPayments, PayPal Payments) |
| Rechner | Plugin **3dprint-lite** (Modell-Upload, 3D-Vorschau, Preis) |
| Consent | Complianz GDPR (Cookie-Banner, Kategorien Statistik/Marketing) |
| Tracking | Im Impressum werden Google Analytics und AdSense genannt; im Quelltext waren keine entsprechenden Skripte sichtbar (Consent blockiert sie ggf.) |
| Server | Alte Installation, nicht dieser Server |
| Sprache | Deutsch, aber Rechner-Oberfläche teilweise englisch („Upload Model“, „Request a Quote“) |

## Seiteninventar (HTTP-Status am 11.11.2026)

| Alte URL | Status | Inhalt | Neue URL |
| --- | --- | --- | --- |
| `/` | 200 | Begrüßungstext, ein Foto, doppelter Footer | `/` |
| `/3d-druck-rechner/` | 200 | Rechner (3dprint-lite), englische UI | `/3d-druck-rechner/` |
| `/shop/` | 200 | 1 Produkt | `/shop/` |
| `/produkt/recycling-box-…/` | 200 | Produktdetail, 16 Bilder | `/shop/recycling-box-batterien/` |
| `/warenkorb/` | 200 | WooCommerce | `/warenkorb/` |
| `/kasse/` | 200 | WooCommerce-Checkout | `/kasse/` |
| `/mein-konto/` | 200 | WooCommerce-Konto | `/konto/` (optional) |
| `/kontakt` | **404** | Seite fehlt (Navigation verlinkt ins Leere) | `/kontakt/` |
| `/versandarten/` | 200 | Versandkosten (DHL, Express, Abholung, international) | `/versand/` |
| `/bezahlmoeglichkeiten/` | 200 | Karte, Überweisung, Nachnahme, PayPal, iDEAL, Klarna | `/zahlung/` |
| `/impressum/` | 200 | Angaben gem. § 5 TMG, Haftungsausschluss, veraltete Google-Absätze | `/impressum/` |
| `/agb/` | 200 | 11 Abschnitte | `/agb/` |
| `/widerrufsbelehrung/` | 200 | Widerruf + Musterformular | `/widerruf/` |
| `/cookie-richtlinie-eu/` | 200 | Complianz-Standardtext (nicht projektspezifisch) | `/datenschutz/#cookies` |
| `/echtheit-von-bewertungen/` | 200 | leer | entfällt (zusammengeführt) |
| `/datenschutz/` | – | **fehlt vollständig** (Pflicht!) | `/datenschutz/` (neu) |
| `/hallo-welt/` | 200 | WordPress-Beispielbeitrag | entfällt (301 → `/`) |

## Produktdaten (Recycling-Box)

- Name: „Recycling-Box mit Deckel für leere Batterien, zur Aufbewahrung gebrauchter Batterien“
- Preis: 11,00 € – 12,50 € (variantenabhängig), Kleinunternehmer § 19 UStG, zzgl. Versand, Lieferzeit 2–5 Tage
- Artikelnummer: `KAP-202308`
- Maße: 110 × 65 × 87 mm; Gewicht laut Altseite „0,70 g“ (vermutlich 70 g – **zu bestätigen**)
- Material: PLA, 14 Farbvarianten (Gelb, Grau, Himmelblau, Orange, Rose, Silber, Violett, Wasserblau, Schwarz, Weiß, Blau, Grün, Regenbogen, Rot)
- 16 Produktbilder (eigene Fotos, iPhone-EXIF inkl. GPS-Daten – werden beim Optimieren entfernt)

## Rechner-Optionen (übernommen)

- Materialien: PLA, PETG, ABS, ABS-PC, ASA, PLA Tough
- Drucker: Bambu Lab X1C, Anycubic i3 Mega S
- Infill: 10, 15, 35, 45, 65, 75, 95 %
- Weitere Optionen: Farbe, Coating, Stückzahl; Einheit mm/inch, Skalierung, Volumen, Gewicht, Maße, Preis
- Fehlermeldungen des Plugins (englisch) u. a.: Modell zu groß → automatisch verkleinert/passender Drucker, Modell zu klein → hochskaliert, OBJ mit mehreren Meshes nicht unterstützt

## Schwächen (behoben durch Neubau)

1. Textlastige Startseite ohne Struktur, Vertrauenselemente und klare Handlungsaufforderung.
2. Nur ein Shop-Produkt, keine Produktpflege ohne Plugin-Kenntnisse.
3. Rechner teilweise unübersetzt, an ein wartungsintensives Plugin gebunden.
4. **Keine Datenschutzerklärung**, im Footer nur Cookie-Richtlinie.
5. Doppelter Footer, Kontaktdaten nur als Fließtext.
6. Schweres WordPress mit vielen Plugins, Sicherheits- und Wartungsaufwand.
7. Kontaktseite liefert 404.

## Übernommene Assets

Alle Bilder aus `/wp-content/uploads/` wurden heruntergeladen und liegen in `web/static/img/`:

| Datei | Verwendung |
| --- | --- |
| `3D-MIR-Logo-v2.png` | Logo, Favicons |
| `FDM3DDrucker-Rechnu.jpg` | Hero, OG-Bild |
| `3DDruck-Service-mit.jpg` | Leistungsseite |
| `FDM3DDrucker-calcul.jpg` | Rechner-Seite |
| `IMG_5003-…jpg` | Produkt Recycling-Box |
| `IMG_4007`–`IMG_4013`, `IMG_4263`–`IMG_4270` | Galerie/Referenzen |
| `gruen_alle.png` | Material-/Farbübersicht |
| `das-bild-soll-versandarten-…png` | Versandseite |

Die Originale werden beim Bild-Build nach AVIF/WebP/JPG skaliert; EXIF-/GPS-Metadaten werden dabei entfernt.

## Farbwelt aus dem Logo

Das Logo ist überwiegend silbern/metallic auf tiefem Marineblau, mit hellblauen Reflexen:

- Primär: `#0a1530` (Marineblau)
- Akzent: `#2f6fb0` (Stahlblau), hell `#8fb8dd`
- Neutral: Silber `#d8dee8`, Text `#121926`

## Alttexte

Die extrahierten Altinhalte liegen unverändert in `docs/alt-inhalte/` (nur Navigation/Consent-Banner entfernt). Sie dienen als Quelle für die Übernahme der Rechtstexte.
