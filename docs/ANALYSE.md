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

## Kundenverwaltung, Kundenkonten, Kundennummern – Phase K0 (25.11.2026)

Analyse gemäß `03 ANWEISUNG SHOP AGENT KUNDENKONTEN.md`, Phase K0. **Es wurden keine
Daten, Tabellen oder Anwendungsfunktionen verändert.** Phase K1 beginnt erst nach
Freigabe durch den Projektinhaber.

### Vorab: Unstimmigkeit in den Unterlagen

Beide übergebenen Dateien (`00 API VERTRAG.md` und
`03 ANWEISUNG SHOP AGENT KUNDENKONTEN.md`) sind **inhaltlich identisch** (MD5
`631320ed1372e39c857e2460fd29d2f3`) und enthalten die Kunden-Anweisung, nicht den
angerufenen API-Vertrag v1.2. Im Repo liegt `API-VERTRAG.md` in der alten Fassung
(keine Markierungen **[NEU v1.1]/[NEU v1.2]**, kein Abschnitt 14, kein §7.2,
kein `refunded_cents`). Für K3 werden die echte v1.2-Fassung und die
Hauptanweisung `01-ANWEISUNG-SHOP-AGENT.md` benötigt. Siehe KQ0 in
`VERTRAGS-ANMERKUNGEN.md`.

### Bestand im Shop (Ist-Zustand)

| Thema | Befund |
| --- | --- |
| `users` | Existiert (`001_init.sql:16-25`): `id`, `email` UNIQUE COLLATE NOCASE, `password_hash`, `name`, `role` CHECK (`admin`\\|`customer`), `totp_secret`, `created_at`, `updated_at`. Aktuell **1 Admin, 0 Kundenkonten**. |
| `sessions` | `001_init.sql:27-34`: ID, `user_id`, JSON-Daten, `expires_at`. 8 Stunden TTL (`auth.ts:9`). Cookie `mir3d_admin`, `path=/admin`, HttpOnly, signed, SameSite=Lax, Secure bei HTTPS (`auth.ts:192-201`). |
| Passwörter | argon2id, memoryCost 19456, timeCost 2, parallelism 1 (`auth.ts:11-16`, `hashPassword`/`verifyPassword` 56-66). TOTP/2FA und Passkeys sind vorhanden, aber nur für Admins. |
| Rollen | Im Code wird nur `role === 'admin'` geprüft (`getSession`, `adminGuard`). Die Rolle `support` ist **nicht** implementiert. |
| Admin-Rechte/CSRF | `adminGuard` (`admin.ts:668-692`) prüft Session, Origin und `_csrf` (timingSafeEqual, `auth.ts:234-246`). |
| Audit-Log | Tabelle `audit_log` (`001_init.sql:156-162`), Schreiber `writeAudit(actor, action, details)` (`auth.ts:248-253`), derzeit ohne Admin-Anzeige (außer API-Seite). |
| E-Mail | `sendMail()` (`mailer.ts:67`) über SMTP aus den Benachrichtigungseinstellungen; ohne SMTP Ablage als `.eml` unter `/var/log/3d-mir/mail/`. Geeignet für Double-Opt-in und Reset. |
| Gäste | Keine `customers`-Tabelle. Gäste stehen nur als Snapshot in `orders` (`user_id` NULL). Alle **8** vorhandenen Bestellungen sind Gastbestellungen. |
| Feature-Flag | `config/site.json:51` enthält `features.customerAccounts: false`; es gibt **keine** `/konto/`-Routen und keine Kunden-Registrierung. |
| Kleinunternehmer | `config.site.json:16-17` `smallBusiness: true`, `vatNote` hinterlegt; API liefert `tax_rate_percent = 0`. |

### Kundenbestand für den Nachtrag (K1)

Abgeleitete Kunden über `lower(email)` (2 Datensätze), IDs nach
`src/lib/api-mapper.ts` (`customerExternalId`):

| E-Mail | Bestellungen | `user_id` | aktuelle abgeleitete ID |
| --- | --- | --- | --- |
| `test@example.com` | 1 | NULL | `cus_973dfe463ec85785` |
| `alex@knutas.de` | 7 | NULL | `cus_66fe2995d11c03be` |

Zeitraum der Bestellungen: 12.11.2026 11:48 – 13.11.2026 20:55 UTC. Nachtrag in
`created_at ASC, id ASC` würde `KD900001` (test@example.com) und `KD900002`
(alex@knutas.de) vergeben. Die IDs `cus_…` bleiben unverändert, weil die
Faktura-App sie bereits als `external_id` gespeichert haben kann.

### Mapping Shop-Feld → neue API-Felder

| Neues API-Feld | Quelle / Zweck |
| --- | --- |
| `id` | Bisher abgeleitete ID (`usr_<user_id>` bzw. `cus_<16 Hex>`); nach Anlage des Kunden unverändert. |
| `customer_number` | Neu: `customers.customer_no`, `KD` + 6 Ziffern, Pflichtfeld. |
| `status` | Neu: `customers.status` (`active`\\|`blocked`\\|`anonymized`). |
| `email_verified` | `customers.email_verified_at IS NOT NULL` (neu; Double-Opt-in in K5). |
| `is_guest` | Kein Eintrag in `customer_accounts` ⇒ Gast; `customers.is_guest`. |
| `customer_snapshot.customer_number` / `.is_guest` | Aus `customers` zum Bestellzeitpunkt; `customer_snapshot` selbst bleibt Snapshot. |
| `faktura_customer_no` | Nur Hinweis aus K4; ändert die Shop-Nummer nie. |
| `billing_address` / `shipping_address` | Derzeit identisch aus dem Order-Snapshot (A5); künftig getrennte `customer_addresses` als Snapshot. |

### Bewertung / Voraussetzungen für K1

- Konten-Grundgerüst (`users`, Argon2id, Sessions, CSRF, Mail, Audit) ist vorhanden;
  Kundenkonten und `/konto/` müssen neu gebaut werden.
- Vor dem Nachtrag: Backup-Hinweis und ausdrückliche Bestätigung des Projektinhabers
  (Regel 6 der Hauptanweisung). Migrationen bekommen ein Rollback-Skript.
- Die nummerierte Zähler-Tabelle startet bei `900000`; erster vergebener Wert `KD900001`.
- Offene Entscheidungen: KQ0–KQ5 in `VERTRAGS-ANMERKUNGEN.md`.
