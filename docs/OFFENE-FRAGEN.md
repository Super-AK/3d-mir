# Offene Fragen an den Auftraggeber

Stand: 11.11.2026 · Diese Liste wird gesammelt gepflegt. Bitte alle Punkte auf einmal beantworten; Einzelfragen sind mit `[F1]` usw. nummeriert.

**Legende:** 🔴 blockiert eine Phase · 🟡 wichtig, aber mit Platzhalter überbrückbar · 🟢 später klärbar

---

## 1. Preise und Kalkulation (Rechner) 🔴

Alle Werte stehen aktuell als **Platzhalter** in `config/pricing.json` und sind in der Oberfläche als „unverbindliche Schätzung“ gekennzeichnet.

| Nr. | Frage | Aktueller Platzhalter |
| --- | --- | --- |
| F1 | Materialpreis pro Gramm für PLA, PLA Tough, PETG, ABS, ASA, ABS-PC? | 0,05–0,10 €/g |
| F2 | Maschinenstundensatz für Bambu Lab X1C und Anycubic i3 Mega S? | 2,50 €/h bzw. 1,20 €/h |
| F3 | Rüstkosten pro Auftrag und pro zusätzlichem Teil? | 3,50 € / 0,75 € |
| F4 | Mindestauftragswert? | 15,00 € |
| F5 | Mengenrabatte (ab welcher Stückzahl, wie viel Prozent)? | 5 % ab 3, 10 % ab 5, 15 % ab 10, 20 % ab 25 |
| F6 | Aufschläge für Nachbearbeitung (Schleifen, Grundieren/Lackieren)? | 4,00 € / 9,00 € pro Teil |
| F7 | Sollen Druckzeit und Materialverbrauch pauschal oder modellgenau geschätzt werden? (Die Berechnung nutzt Volumen × Füllung + Wandstärken; eine exakte Slicer-Zeit ist ohne Slicer nicht möglich.) | modellgenaue Schätzung |
| F8 | Sollen Preise inkl. oder zzgl. der gesetzlichen USt. gedacht sein? (Kleinunternehmer: kein USt.-Ausweis) | Brutto, kein USt.-Ausweis |

## 2. Zahlungsarten 🟡

Die Altseite nennt Kreditkarte, Überweisung, Nachnahme, PayPal, iDEAL und Klarna (WooPayments/PayPal-Plugins). Technisch umgesetzt sind Vorkasse, Karte, PayPal, Amazon Pay, Klarna und iDEAL über Stripe. Offen sind Konto, Schlüssel und Bankdaten.

| Nr. | Entscheidung / offener Punkt |
| --- | --- |
| F9 | **Entschieden:** Vorkasse, Kredit-/Debitkarte, PayPal, Amazon Pay, Klarna und iDEAL zum Start. SEPA-Lastschrift, Nachnahme und Rechnung später. |
| F10 | **Entschieden:** PayPal läuft über Stripe. Das bestehende PayPal-Business-Konto wird für diese Shop-Zahlungen nicht genutzt; direkte PayPal-Anbindung bleibt Option für später. |
| F11 | **Entschieden:** Stripe Checkout für Karte, PayPal, Amazon Pay, Klarna und iDEAL. Stripe-Konto, Verifizierung und Freischaltung der Zahlungsarten sind noch anzulegen. |
| F12 | **Entschieden:** Nachnahme zum Start nicht. Die alte Gebühr (1,00 € + 8,99 €) wird nicht übernommen. |
| F13 | **Offen:** Bankverbindung (IBAN, BIC, Kontoinhaber) unter **Admin → Zahlungen** eintragen – nicht per E-Mail oder ins Repository. |
| F68 | **Offen:** Stripe-Konto anlegen, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` und `PAYMENT_BASE_URL` in `/etc/3d-mir/3d-mir.env` hinterlegen. |

## 3. Versand 🔴

| Nr. | Frage | Platzhalter |
| --- | --- | --- |
| F14 | Versanddienstleister (DHL, Hermes, …)? | DHL Paket |
| F15 | Versandkosten und Gewichts-/Größenstaffel? | 4,99 € pauschal |
| F16 | Ab welchem Bestellwert versandkostenfrei? | ab 50,00 € |
| F17 | Lieferzeit (Altseite: 2–5 Tage)? | 2–5 Werktage |
| F18 | Abholung in Schömberg möglich? | ja, nach Absprache |
| F19 | Versand ins Ausland? Wenn ja, welche Länder und zu welchen Kosten? | nein |
| F20 | Versand von Rechner-Aufträgen: pauschal, nach Gewicht oder individuell im Angebot? | individuell im Angebot |

## 4. E-Mail / SMTP 🔴

Ohne SMTP-Zugang werden E-Mails derzeit **nicht versendet**, sondern als `.eml`-Dateien unter `/var/log/3d-mir/mail/` abgelegt (nur für Tests).

| Nr. | Frage |
| --- | --- |
| F21 | SMTP-Host, Port, Verschlüsselung (STARTTLS/SSL) und Postfach (z. B. `info@3d-mir.de`)? |
| F22 | Zugangsdaten bitte **nicht** im Chat/Repo, sondern später in `/etc/3d-mir/3d-mir.env` eintragen. Soll ich dafür eine interaktive Maske im Installer vorsehen? |
| F23 | Absenderadresse und Empfänger für Betreiber-Benachrichtigungen (Angebote, Bestellungen, Kontakt)? |
| F24 | Sollen Kunden-E-Mails (Bestellbestätigung, Angebot) eine Kopie an den Betreiber erhalten? |

## 5. GitHub und Deployment 🔴

| Nr. | Frage |
| --- | --- |
| F25 | Repository-URL (z. B. `git@github.com:USER/3d-mir.git`)? |
| F26 | Authentifizierung: SSH-Deploy-Key (empfohlen) oder HTTPS mit Token? |
| F27 | Soll ich das Repo öffentlich oder privat anlegen? (Anlegen kann ich es nur mit Zugang; alternativ pushen Sie es selbst.) |
| F28 | Ist dieser Server (`www3d-mir`, Ubuntu 26.04, aarch64) die endgültige Produktionsmaschine? |
| F29 | Gibt es einen Staging-/Testserver? |

## 6. Domain, DNS und TLS 🟡

| Nr. | Frage |
| --- | --- |
| F30 | Wo liegen DNS und Mail? Aktuell zeigt `www.3d-mir.de` auf die alte WordPress-Installation. |
| F31 | Auf welche IP soll `3d-mir.de`/`www.3d-mir.de` zeigen? (Bitte erst umstellen, wenn die neue Seite getestet ist – Anleitung in `docs/INSTALLATION.md`.) |
| F32 | E-Mail-Adresse für Let's-Encrypt-Benachrichtigungen (vermutlich `info@3d-mir.de`)? |
| F33 | Soll `3d-mir.de` auf `www.3d-mir.de` (oder umgekehrt) weiterleiten? |

## 7. Inhalte, Bilder und Marke 🟡

| Nr. | Frage |
| --- | --- |
| F34 | Liegt das Logo als **Vektor** (SVG/AI/EPS) vor? Aktuell nutze ich das PNG (611 × 600) aus dem WordPress-Upload. |
| F35 | Welche der alten Fotos sind **eigene Drucke** und dürfen weiterverwendet werden? Gibt es Freigaben für Fremdmotive? |
| F36 | Bitte 3–6 aktuelle, gut ausgeleuchtete Fotos eigener Drucke (Querformat, mind. 1600 px) für Hero und Galerie. |
| F37 | Gibt es Referenzkunden/Projekte, die genannt werden dürfen? |
| F38 | Sollen die Etsy-Bewertungen verlinkt werden? Bitte direkte URL (Platzhalter `TODO-ETSY-BEWERTUNGEN-URL`). |
| F39 | Schreibweise Etsy-Shop: `3DlMIR` (mit kleinem L) oder `3DIMIR`? Die alte URL lautet `…/shop/3DlMIR`. |
| F40 | Gibt es Öffnungszeiten/Erreichbarkeit, die im Footer/Kontakt stehen sollen? |

## 8. Drucker und Materialien 🟡

| Nr. | Frage | Annahme |
| --- | --- | --- |
| F41 | Bauraum Bambu Lab X1C? | 256 × 256 × 256 mm |
| F42 | Bauraum Anycubic i3 Mega S? | 210 × 210 × 205 mm |
| F43 | Welche Materialien laufen auf welchem Drucker? | X1C: alle; i3: PLA, PLA Tough, PETG |
| F44 | Steht AMS/Mehrfarbdruck zur Verfügung? | nein (TODO) |
| F45 | Welche Farben sind je Material tatsächlich vorrätig? | Standardfarben aus Altprodukt |
| F46 | Gibt es Mindestwandstärken/Designregeln, die wir Kunden nennen sollen? | noch keine |
| F47 | „Coating“ auf der Altseite: Was genau wird angeboten (Glätten, Lackieren, Versiegeln)? | Schleifen/Lackieren als Platzhalter |
| F66 | Sind die Kalkulationswerte realistisch: Wandstärke 1,2 mm, Materialdurchsatz 10 cm³/h, Verschnitt 5 %, Rüstkosten 3,50 € + 0,75 € je weiterem Teil, Mindestauftrag 15 €, Rundung 0,10 €? Bitte in `config/pricing.json` bestätigen oder korrigieren (siehe `docs/KALKULATION.md`). | Platzhalter |

## 9. Shop und Produkte 🟡

| Nr. | Frage |
| --- | --- |
| F48 | Das Altprodukt „Recycling-Box“ kostet 11,00–12,50 € je nach Farbe. Welche Farben kosten welchen Preis? |
| F49 | Gewicht wird auf der Altseite mit „0,70 g“ angegeben – ist das ein Tippfehler (70 g)? |
| F50 | Lagerbestand: Wird auf Bestellung gedruckt (kein Bestand) oder sollen Stückzahlen gepflegt werden? |
| F51 | Sind weitere Produkte geplant? Bitte Name, Beschreibung, Preis, Varianten, Fotos. |
| F52 | Sollen Produktbewertungen möglich sein? (Erfordert Konto + Moderation.) |
| F53 | Kundenkonto gewünscht oder nur Gastbestellungen? (Aktuell ist das Konto optional und nicht aktiv.) |
| F67 | Soll der Shop vor Bestätigung von Preisen, Versand und Zahlung live gehen – oder zunächst nur als Katalog ohne Bestellfunktion? Aktuell ist der Checkout technisch aktiv, aber deutlich als Platzhalter gekennzeichnet. |

## 10. Recht und Datenschutz 🔴

| Nr. | Frage |
| --- | --- |
| F54 | Wer prüft die Rechtstexte (Anwalt/Steuerberater)? Ich übernehme die Alttexte **inhaltlich unverändert** und erstelle einen Datenschutz-Entwurf. |
| F55 | Hosting: Ist dieser Server ein gemieteter Root-Server? Bitte Anbieter und Anschrift für die Datenschutzerklärung (AVV mit dem Hoster nötig). |
| F56 | Sollen die im alten Impressum genannten Absätze zu **Google Analytics/AdSense** entfallen? Auf der neuen Seite gibt es keinerlei Tracking. |
| F57 | Die alte AGB enthält Passagen, die nicht mehr passen („Vertrag kommt durch Annehmen und Bezahlen zustande“, Nachnahme, Klarna). Soll ich die AGB nur formatieren oder sprachlich an den neuen Checkout anpassen (weiterhin als „juristisch zu prüfen“ markiert)? |
| F58 | Für individuell gefertigte Drucke gilt der Widerrufsausschluss (§ 312g Abs. 2 Nr. 1 BGB). Soll dieser Hinweis im Rechner/Checkout explizit ergänzt werden? |
| F59 | Soll die **Datenschutzerklärung** den Rechner-Upload (Datei, Metadaten, Speicherdauer) und die E-Mail-Ablage korrekt beschreiben? Vorschlag: Uploads nach 90 Tagen löschen. |
| F60 | Soll ein **Consent-Banner** vorbereitet werden? Nach aktuellem Stand (nur technisch notwendige Cookies, keine externen Dienste) ist keines nötig. |

## 11. Betrieb 🟢

| Nr. | Frage |
| --- | --- |
| F61 | Tägliches Backup: nur lokal unter `/var/lib/3d-mir/backups` oder zusätzlich extern (z. B. Hetzner Storage Box/S3)? |
| F62 | Aufbewahrungsdauer für Bestellungen/Rechnungen (steuerlich 10 Jahre) und für Angebotsanfragen? |
| F63 | Soll die Admin-Anmeldung zusätzlich per TOTP-2FA abgesichert werden? Das Datenfeld ist vorbereitet, 2FA ist noch nicht aktiviert. |
| F64 | Wer soll Admin-Zugang erhalten (Name/E-Mail)? Der Zugang wird mit `npm run admin:create -- --email … --name …` angelegt; das Passwort wird dabei gesetzt und nie im Repo gespeichert. |
| F65 | Soll ein Monitoring/Alerting (z. B. Uptime-Check) eingerichtet werden? |
