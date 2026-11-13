# Offene Fragen an den Auftraggeber

Stand: 13.11.2026 · Zuletzt geprüft: 13.11.2026 · Diese Liste wird gesammelt gepflegt. Bitte alle Punkte auf einmal beantworten; Einzelfragen sind mit `[F1]` usw. nummeriert.

**Legende:** 🔴 blockiert eine Phase · 🟡 wichtig, aber mit Platzhalter überbrückbar · 🟢 später klärbar

**Kurzstand:** Zahlung, Benachrichtigungen, Setup-Menü und Installationsanleitung sind technisch umgesetzt. Offen sind vor allem fachliche Freigaben (Preise, Versand, Recht), Zugangsdaten (Bank, SMTP, Telegram, Stripe live) und DNS/TLS.

---

## 1. Preise und Kalkulation (Rechner) 🔴

Alle Werte stehen aktuell als **Platzhalter** in `config/pricing.json` und sind in der Oberfläche als „unverbindliche Schätzung“ gekennzeichnet.

| Nr. | Frage | Aktueller Platzhalter |
| --- | --- | --- |
| F1 | Materialpreis pro Gramm für PLA, PLA Tough, PETG, ABS, ASA, ABS-PC? | 0,05–0,10 €/g |
| F2 | Maschinenstundensatz für Bambu Lab X1C und Anycubic i3 Mega S? | 2,50 €/h bzw. 1,20 €/h |
| F3 | Rüstkosten pro Auftrag und pro zusätzlichem Teil? | 3,50 € / 0,75 € |
| F4 | Mindestauftragswert? | aktuell 6,00 € (Admin-Override), Grunddatei 15,00 € |
| F5 | Mengenrabatte (ab welcher Stückzahl, wie viel Prozent)? | 5 % ab 3, 10 % ab 5, 15 % ab 10, 20 % ab 25 |
| F6 | Aufschläge für Nachbearbeitung (Schleifen, Grundieren/Lackieren)? | 4,00 € / 9,00 € pro Teil |
| F7 | Sollen Druckzeit und Materialverbrauch pauschal oder modellgenau geschätzt werden? (Die Berechnung nutzt Volumen × Füllung + Wandstärken; eine exakte Slicer-Zeit ist ohne Slicer nicht möglich.) | modellgenaue Schätzung |
| F8 | Sollen Preise inkl. oder zzgl. der gesetzlichen USt. gedacht sein? (Kleinunternehmer: kein USt.-Ausweis) | Brutto, kein USt.-Ausweis |

## 2. Zahlungsarten 🟡

Die Altseite nennt Kreditkarte, Überweisung, Nachnahme, PayPal, iDEAL und Klarna (WooPayments/PayPal-Plugins). Technisch umgesetzt sind Vorkasse, Karte, PayPal, Amazon Pay, Klarna und iDEAL über Stripe. Der Stripe-Testmodus ist eingerichtet; alle fünf Online-Zahlungsarten wurden als Checkout-Session erfolgreich geprüft. Offen sind Bankverbindung, Live-Schlüssel, Live-Webhook und der Live-Test.

| Nr. | Entscheidung / offener Punkt |
| --- | --- |
| F9 | **Entschieden:** Vorkasse, Kredit-/Debitkarte, PayPal, Amazon Pay, Klarna und iDEAL zum Start. SEPA-Lastschrift, Nachnahme und Rechnung später. |
| F10 | **Entschieden:** PayPal läuft über Stripe. Das bestehende PayPal-Business-Konto wird für diese Shop-Zahlungen nicht genutzt; direkte PayPal-Anbindung bleibt Option für später. |
| F11 | **Entschieden:** Stripe Checkout für Karte, PayPal, Amazon Pay, Klarna und iDEAL. Testkonto und Testschlüssel sind eingerichtet, die Zahlungsarten sind freigeschaltet. Offen: Live-Verifizierung und Live-Webhook. |
| F12 | **Entschieden:** Nachnahme zum Start nicht. Die alte Gebühr (1,00 € + 8,99 €) wird nicht übernommen. |
| F13 | **Offen:** Bankverbindung (IBAN, BIC, Kontoinhaber) unter **Admin → Zahlungen** eintragen – nicht per E-Mail oder ins Repository. |
| F68 | **Offen:** Livegang von Stripe: Live-Schlüssel (`sk_live_…`), Live-Webhook-Secret, finaler `PAYMENT_BASE_URL` und eine echte Live-Testzahlung. Der Testmodus läuft bereits. |

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

## 4. E-Mail / SMTP und Benachrichtigungen 🟡

E-Mails können über SMTP versendet werden. Die Einrichtung ist sowohl im Admin unter **Benachrichtigungen** als auch über das Setup-Menü (`sudo deploy/setup.sh`) möglich. Ohne SMTP werden E-Mails als `.eml` unter `/var/log/3d-mir/mail/` gespeichert (nur für Tests).

| Nr. | Frage / Entscheidung |
| --- | --- |
| F21 | **Offen:** SMTP-Host, Port, Verschlüsselung (STARTTLS/SSL) und Postfach (z. B. `info@3d-mir.de`). |
| F22 | **Entschieden:** Ja, es gibt eine interaktive Maske im Setup-Menü und im Admin. Zugangsdaten werden nicht im Repository gespeichert. |
| F23 | Absender und Betreiber-Postfach sind aktuell `MAIL_FROM=3D-MIR <info@3d-mir.de>` und `MAIL_TO=info@3d-mir.de`. Bitte bestätigen oder korrigieren. |
| F24 | **Offen:** Sollen Kunden-E-Mails (Bestellbestätigung, Angebot) zusätzlich eine Kopie an den Betreiber erhalten? Aktuell nein. |
| F69 | **Offen:** Telegram: Bot-Token und Chat-ID unter **Admin → Benachrichtigungen** eintragen und Testnachricht senden. |
| F70 | **Offen:** Standardkanal für Admin-Benachrichtigungen: nur E-Mail, nur Telegram oder beides? Aktuell ist „nur E-Mail“ voreingestellt. |
| F71 | **Offen:** Für welche Ereignisse soll Telegram zusätzlich informieren? Aktuell: neue Bestellung, Kontaktanfrage, Angebotsanfrage, Zahlungseingang und Zahlung nach Stornierung. Statusänderungen an Kunden laufen weiterhin nur per E-Mail. |

## 5. GitHub und Deployment 🟢

| Nr. | Frage / Entscheidung |
| --- | --- |
| F25 | **Entschieden:** Repository `git@github.com:Super-AK/3d-mir.git`. |
| F26 | **Entschieden:** SSH-Deploy-Key; Push von `main` nach `origin/main` funktioniert. |
| F27 | **Offen:** Sichtbarkeit des Repositories (privat/öffentlich) bestätigen. Der Push funktioniert unabhängig davon. |
| F28 | **Offen:** Ist der aktuelle Server `www3d-mir` die endgültige Produktionsmaschine? Aktuell ist die Anwendung dort installiert. |
| F29 | **Offen:** Gibt es einen Staging-/Testserver? Aktuell nicht dokumentiert. |

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
| F66 | Sind die Kalkulationswerte realistisch: Wandstärke 1,2 mm, Materialdurchsatz 15 cm³/h (Override), Verschnitt 5 %, Rüstkosten 3,50 € + 0,75 € je weiterem Teil, Mindestauftrag 6,00 € (Override), Rundung 0,10 €? Bitte in `config/pricing.json` bzw. im Admin bestätigen oder korrigieren (siehe `docs/KALKULATION.md`). | Platzhalter |

## 9. Shop und Produkte 🟡

| Nr. | Frage |
| --- | --- |
| F48 | Das Altprodukt „Recycling-Box“ kostet 11,00–12,50 € je nach Farbe. Welche Farben kosten welchen Preis? |
| F49 | Gewicht wird auf der Altseite mit „0,70 g“ angegeben – ist das ein Tippfehler (70 g)? |
| F50 | Lagerbestand: Wird auf Bestellung gedruckt (kein Bestand) oder sollen Stückzahlen gepflegt werden? |
| F51 | Sind weitere Produkte geplant? Bitte Name, Beschreibung, Preis, Varianten, Fotos. |
| F52 | Sollen Produktbewertungen möglich sein? (Erfordert Konto + Moderation.) |
| F53 | Kundenkonto gewünscht oder nur Gastbestellungen? (Aktuell ist das Konto optional und nicht aktiv.) |
| F67 | Soll der Shop nach Freigabe von Preisen, Versand und Recht live gehen? Checkout und Zahlung (Stripe-Testmodus) sind technisch aktiv; der Livegang erfolgt erst nach fachlicher Freigabe und Stripe-Live-Schaltung. |

## 10. Recht und Datenschutz 🔴

| Nr. | Frage |
| --- | --- |
| F54 | Wer prüft die Rechtstexte (Anwalt/Steuerberater)? Die Texte sind als technische Entwürfe markiert und müssen vor dem Livegang freigegeben werden. |
| F55 | Hosting: Ist dieser Server ein gemieteter Root-Server? Bitte Anbieter und Anschrift für die Datenschutzerklärung (AVV mit dem Hoster nötig). |
| F56 | **Entschieden:** Die Abschnitte zu Google Analytics/AdSense wurden entfernt. Die neue Seite setzt kein Tracking ein. |
| F57 | **Umgesetzt:** Die AGB wurden sprachlich an den neuen Checkout und die Zahlungsarten angepasst; die rechtliche Prüfung bleibt offen. |
| F58 | **Offen:** Für individuell gefertigte Drucke gilt der Widerrufsausschluss (§ 312g Abs. 2 Nr. 1 BGB). Soll dieser Hinweis im Rechner/Checkout explizit ergänzt werden? |
| F59 | **Entwurf aktualisiert:** Die Datenschutzerklärung beschreibt Rechner-Upload, E-Mail-Ablage und Zahlungsdienstleister. Offen: automatische Löschung der Uploads nach 90 Tagen technisch umsetzen und rechtlich bestätigen. |
| F60 | **Empfehlung:** Kein Consent-Banner nötig, solange nur technisch notwendige Cookies und keine externen Skripte/Tracker eingesetzt werden. Bitte rechtlich bestätigen. |

## 11. Betrieb 🟢

| Nr. | Frage |
| --- | --- |
| F61 | Tägliches Backup: nur lokal unter `/var/lib/3d-mir/backups` oder zusätzlich extern (z. B. Hetzner Storage Box/S3)? |
| F62 | Aufbewahrungsdauer für Bestellungen/Rechnungen (steuerlich 10 Jahre) und für Angebotsanfragen? |
| F63 | Soll die Admin-Anmeldung zusätzlich per TOTP-2FA abgesichert werden? Das Datenfeld ist vorbereitet, 2FA ist noch nicht aktiviert. |
| F64 | **Erledigt:** Der Admin-Zugang des Betreibers ist eingerichtet. Offen: Sollen weitere Personen Zugang erhalten? Zugänge werden mit `npm run admin:create -- --email … --name …` angelegt; Passwörter werden nie im Repo gespeichert. |
| F65 | Soll ein Monitoring/Alerting (z. B. Uptime-Check) eingerichtet werden? |

---

## 12. Nächste Schritte bis zum Livegang

1. **Preise und Versand bestätigen:** F1–F8, F14–F20 und F66 in `config/pricing.json` bzw. im Admin korrigieren.
2. **Zahlung live schalten:** F13 (Bankverbindung) und F68 (Stripe-Live-Schlüssel, Live-Webhook, Live-Test).
3. **Benachrichtigungen einrichten:** F21–F24, F69–F71 (SMTP, Telegram, Kanal und Ereignisse).
4. **DNS und TLS:** F30–F33 (Domain auf neuen Server, certbot, kanonische www-Variante).
5. **Rechtstexte prüfen lassen:** F54–F59; danach Prüfhinweis entfernen.
6. **Betrieb absichern:** F61–F65 (externes Backup, Aufbewahrung, 2FA, Monitoring).
7. **Abnahme:** Test auf frischer VM anhand `docs/INSTALLATION.md`, danach `deploy/verify.sh` und Live-Testbestellung.
