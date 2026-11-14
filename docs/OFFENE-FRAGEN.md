# Offene Fragen an den Auftraggeber

**Stand:** 14.11.2026 · **Version:** 2.5 · **Zuletzt geprüft:** 14.11.2026

Diese Liste wird gesammelt gepflegt. Bitte alle Punkte auf einmal beantworten; Einzelfragen sind mit `[F1]` usw. nummeriert. Erledigte Punkte bleiben mit Datum und Nachweis dokumentiert, damit Verweise und die Historie erhalten bleiben.

**Legende:**

| Status | Bedeutung |
| --- | --- |
| 🔴 Offen | blockiert den Livegang oder eine Freigabe |
| 🟡 In Arbeit | technisch vorbereitet, aber Werte, Zugangsdaten oder Freigabe fehlen |
| ✅ Erledigt | umgesetzt und geprüft; Datum und Nachweis sind angegeben |
| 🟢 Später | wichtig, aber nicht für den Start erforderlich |

**Kurzstand:** Version 1.0.0-rc.1: Zahlung, Benachrichtigungen, Kontakt-Spam-Schutz, Kategorien, Etsy-Import, Veröffentlichungsschalter, Setup-Menü und Installationsanleitung sind technisch umgesetzt. Preise, Kalkulation, Versandkosten und Lieferzeiten sind bestätigt. Offen sind vor allem Rechtstexte, Zugangsdaten (Bank, SMTP, Telegram, Stripe live), die Bestätigung der Länder-Allowlist, die Etsy-API-Freigabe und DNS/TLS.

---

## Statusübersicht

| Bereich | Status | Kurzbemerkung |
| --- | --- | --- |
| Zahlungsarten | 🟡 In Arbeit | Testmodus und alle Methoden geprüft; Bankdaten und Live-Schaltung offen |
| Kontakt/Spam-Schutz | 🟡 In Arbeit | Antworten und IP-basierte Länderprüfung umgesetzt; Allowlist bestätigen |
| Benachrichtigungen | 🟡 In Arbeit | Admin/Setup vorhanden; SMTP- und Telegram-Daten offen |
| Kategorien | ✅ Erledigt | Verwaltung, Mehrfachzuordnung und Shop-Filter umgesetzt |
| Veröffentlichung | ✅ Erledigt | Platzhalter-Hinweise im Admin schaltbar |
| Etsy-Import | 🟡 In Arbeit | CSV-Import umgesetzt und 13 Produkte übernommen; API wartet auf Etsy-Freigabe |
| Installation/Deployment | ✅ Erledigt | Installationsanleitung und interaktives Setup-Menü vorhanden |
| Preise/Kalkulation | ✅ Erledigt | Vom Betreiber am 14.11.2026 bestätigt |
| Versand | ✅ Erledigt | Vom Betreiber am 14.11.2026 bestätigt |
| DNS/TLS | 🔴 Offen | Domain zeigt noch auf WordPress; TLS nicht aktiv |
| Rechtstexte | 🔴 Offen | Entwürfe vorhanden; rechtliche Prüfung offen |
| Betrieb/Backup | 🟡 In Arbeit | Backup-Skripte vorhanden; externes Ziel/Monitoring offen |

---

## 1. Preise und Kalkulation (Rechner) ✅

Alle Werte stehen aktuell als **Platzhalter** in `config/pricing.json` und sind in der Oberfläche als „unverbindliche Schätzung“ gekennzeichnet. Einzelne Werte werden bereits durch Admin-Overrides überlagert.

| Nr. | Status | Frage | Aktueller Platzhalter |
| --- | --- | --- | --- |
| F1 | ✅ Erledigt | Materialpreis pro Gramm für PLA, PLA Tough, PETG, ABS, ASA, ABS-PC? | 0,05–0,10 €/g |
| F2 | ✅ Erledigt | Maschinenstundensatz für Bambu Lab X1C und Anycubic i3 Mega S? | 2,50 €/h bzw. 1,20 €/h |
| F3 | ✅ Erledigt | Rüstkosten pro Auftrag und pro zusätzlichem Teil? | 3,50 € / 0,75 € |
| F4 | ✅ Erledigt | Mindestauftragswert? | aktuell 6,00 € (Admin-Override), Grunddatei 15,00 € |
| F5 | ✅ Erledigt | Mengenrabatte (ab welcher Stückzahl, wie viel Prozent)? | 5 % ab 3, 10 % ab 5, 15 % ab 10, 20 % ab 25 |
| F6 | ✅ Erledigt | Aufschläge für Nachbearbeitung (Schleifen, Grundieren/Lackieren)? | 4,00 € / 9,00 € pro Teil |
| F7 | ✅ Erledigt | Sollen Druckzeit und Materialverbrauch pauschal oder modellgenau geschätzt werden? (Die Berechnung nutzt Volumen × Füllung + Wandstärken; eine exakte Slicer-Zeit ist ohne Slicer nicht möglich.) | modellgenaue Schätzung |
| F8 | ✅ Erledigt | Sollen Preise inkl. oder zzgl. der gesetzlichen USt. gedacht sein? (Kleinunternehmer: kein USt.-Ausweis) | Brutto, kein USt.-Ausweis |

## 2. Zahlungsarten 🟡

Die Altseite nennt Kreditkarte, Überweisung, Nachnahme, PayPal, iDEAL und Klarna (WooPayments/PayPal-Plugins). Technisch umgesetzt sind Vorkasse, Karte, PayPal, Amazon Pay, Klarna und iDEAL über Stripe. Der Stripe-Testmodus ist eingerichtet; alle fünf Online-Zahlungsarten wurden als Checkout-Session erfolgreich geprüft. Offen sind Bankverbindung, Live-Schlüssel, Live-Webhook und der Live-Test.

| Nr. | Status | Entscheidung / offener Punkt |
| --- | --- | --- |
| F9 | ✅ Erledigt | **Entschieden:** Vorkasse, Kredit-/Debitkarte, PayPal, Amazon Pay, Klarna und iDEAL zum Start. SEPA-Lastschrift, Nachnahme und Rechnung später. Nachweis: Commit `c21ac49`, `764d8a7`.<br>*(13.11.2026)* |
| F10 | ✅ Erledigt | **Entschieden:** PayPal läuft über Stripe. Das bestehende PayPal-Business-Konto wird für diese Shop-Zahlungen nicht genutzt; direkte PayPal-Anbindung bleibt Option für später. Nachweis: Stripe-Test.<br>*(13.11.2026)* |
| F11 | 🟡 In Arbeit | **Entschieden:** Stripe Checkout für Karte, PayPal, Amazon Pay, Klarna und iDEAL. Testkonto und Testschlüssel sind eingerichtet, die Zahlungsarten sind freigeschaltet. Offen: Live-Verifizierung und Live-Webhook. |
| F12 | ✅ Erledigt | **Entschieden:** Nachnahme zum Start nicht. Die alte Gebühr (1,00 € + 8,99 €) wird nicht übernommen.<br>*(13.11.2026)* |
| F13 | 🔴 Offen | Bankverbindung (IBAN, BIC, Kontoinhaber) unter **Admin → Zahlungen** eintragen – nicht per E-Mail oder ins Repository. |
| F68 | 🟡 In Arbeit | **Livegang von Stripe:** Testmodus läuft. Offen: Live-Schlüssel (`sk_live_…`), Live-Webhook-Secret, finaler `PAYMENT_BASE_URL` und eine echte Live-Testzahlung. |

## 3. Versand ✅

Die Versandseite, Versandoptionen und die Checkout-Logik sind umgesetzt. Versandkosten und Lieferzeiten wurden am 14.11.2026 bestätigt.

| Nr. | Status | Frage | Bestätigter Wert |
| --- | --- | --- | --- |
| F14 | ✅ Erledigt | Versanddienstleister (DHL, Hermes, …)? | DHL Paket |
| F15 | ✅ Erledigt | Versandkosten und Gewichts-/Größenstaffel? | 4,99 € pauschal |
| F16 | ✅ Erledigt | Ab welchem Bestellwert versandkostenfrei? | ab 50,00 € |
| F17 | ✅ Erledigt | Lieferzeit (Altseite: 2–5 Tage)? | 2–5 Werktage |
| F18 | ✅ Erledigt | Abholung in Schömberg möglich? | ja, nach Absprache |
| F19 | ✅ Erledigt | Versand ins Ausland? Wenn ja, welche Länder und zu welchen Kosten? | nein |
| F20 | ✅ Erledigt | Versand von Rechner-Aufträgen: pauschal, nach Gewicht oder individuell im Angebot? | individuell im Angebot |

## 4. E-Mail / SMTP und Benachrichtigungen 🟡

E-Mails können über SMTP versendet werden. Die Einrichtung ist sowohl im Admin unter **Benachrichtigungen** als auch über das Setup-Menü (`sudo deploy/setup.sh`) möglich. Ohne SMTP werden E-Mails als `.eml` unter `/var/log/3d-mir/mail/` gespeichert (nur für Tests).

| Nr. | Status | Frage / Entscheidung |
| --- | --- | --- |
| F21 | 🟡 In Arbeit | SMTP-Host, Port, Verschlüsselung (STARTTLS/SSL) und Postfach (z. B. `info@3d-mir.de`). Die Maske ist vorhanden; Zugangsdaten fehlen. |
| F22 | ✅ Erledigt | **Entschieden:** Ja, es gibt eine interaktive Maske im Setup-Menü und im Admin. Zugangsdaten werden nicht im Repository gespeichert. Nachweis: Commit `a1234d2`.<br>*(13.11.2026)* |
| F23 | 🟡 In Arbeit | Absender und Betreiber-Postfach sind aktuell `MAIL_FROM=3D-MIR <info@3d-mir.de>` und `MAIL_TO=info@3d-mir.de`. Bitte bestätigen oder korrigieren. |
| F24 | 🔴 Offen | Sollen Kunden-E-Mails (Bestellbestätigung, Angebot) zusätzlich eine Kopie an den Betreiber erhalten? Aktuell nein. |
| F69 | 🟡 In Arbeit | **Telegram:** Bot-Token und Chat-ID unter **Admin → Benachrichtigungen** eintragen und Testnachricht senden. Die Integration ist vorhanden; Zugangsdaten fehlen. |
| F70 | 🔴 Offen | **Standardkanal** für Admin-Benachrichtigungen: nur E-Mail, nur Telegram oder beides? Aktuell ist „nur E-Mail“ voreingestellt. |
| F71 | 🔴 Offen | **Ereignisse für Telegram:** Aktuell neue Bestellung, Kontaktanfrage, Angebotsanfrage, Zahlungseingang und Zahlung nach Stornierung. Statusänderungen an Kunden laufen weiterhin nur per E-Mail. Soll das erweitert werden? |

## 5. GitHub und Deployment 🟢

| Nr. | Status | Frage / Entscheidung |
| --- | --- | --- |
| F25 | ✅ Erledigt | **Entschieden:** Repository `git@github.com:Super-AK/3d-mir.git`.<br>*(13.11.2026)* |
| F26 | ✅ Erledigt | **Entschieden:** SSH-Deploy-Key; Push von `main` nach `origin/main` funktioniert.<br>*(13.11.2026)* |
| F27 | 🟡 In Arbeit | Sichtbarkeit des Repositories (privat/öffentlich) bestätigen. Der Push funktioniert unabhängig davon. |
| F28 | 🟡 In Arbeit | **Produktionsserver:** `kap-srv` mit weiteren Web-Apps. Bitte bestätigen, ob dies die endgültige Maschine ist und welcher Portbereich für 3D-MIR reserviert werden soll. |
| F29 | 🟡 In Arbeit | Gibt es einen Staging-/Testserver? Aktuell nicht dokumentiert. |
| F72 | 🟡 In Arbeit | **Port auf `kap-srv`:** Der Installer prüft die Belegung und wählt bei freier Wahl automatisch einen Port im Bereich 3000–3099. Soll ein fester Port reserviert werden? |

## 6. Domain, DNS und TLS 🔴

| Nr. | Status | Frage |
| --- | --- | --- |
| F30 | 🔴 Offen | Wo liegen DNS und Mail? Aktuell zeigt `www.3d-mir.de` auf die alte WordPress-Installation. |
| F31 | 🔴 Offen | Auf welche IP soll `3d-mir.de`/`www.3d-mir.de` zeigen? (Bitte erst umstellen, wenn die neue Seite getestet ist – Anleitung in `docs/INSTALLATION.md`.) |
| F32 | 🔴 Offen | E-Mail-Adresse für Let's-Encrypt-Benachrichtigungen (vermutlich `info@3d-mir.de`)? |
| F33 | 🔴 Offen | Soll `3d-mir.de` auf `www.3d-mir.de` (oder umgekehrt) weiterleiten? |

## 7. Inhalte, Bilder und Marke 🟡

| Nr. | Status | Frage |
| --- | --- | --- |
| F34 | 🟡 In Arbeit | Liegt das Logo als **Vektor** (SVG/AI/EPS) vor? Aktuell wird das PNG (611 × 600) aus dem WordPress-Upload genutzt. |
| F35 | 🟡 In Arbeit | Welche der alten Fotos sind **eigene Drucke** und dürfen weiterverwendet werden? Gibt es Freigaben für Fremdmotive? |
| F36 | 🟡 In Arbeit | Bitte 3–6 aktuelle, gut ausgeleuchtete Fotos eigener Drucke (Querformat, mind. 1600 px) für Hero und Galerie. |
| F37 | 🟡 In Arbeit | Gibt es Referenzkunden/Projekte, die genannt werden dürfen? |
| F38 | 🟡 In Arbeit | Sollen die Etsy-Bewertungen verlinkt werden? Bitte direkte URL (Platzhalter `TODO-ETSY-BEWERTUNGEN-URL`). |
| F39 | 🟡 In Arbeit | Schreibweise Etsy-Shop: `3DlMIR` (mit kleinem L) oder `3DIMIR`? Die alte URL lautet `…/shop/3DlMIR`. |
| F40 | 🟡 In Arbeit | Gibt es Öffnungszeiten/Erreichbarkeit, die im Footer/Kontakt stehen sollen? |

## 8. Drucker und Materialien 🟡

| Nr. | Status | Frage | Annahme |
| --- | --- | --- | --- |
| F41 | 🟡 In Arbeit | Bauraum Bambu Lab X1C? | 256 × 256 × 256 mm |
| F42 | 🟡 In Arbeit | Bauraum Anycubic i3 Mega S? | 210 × 210 × 205 mm |
| F43 | 🟡 In Arbeit | Welche Materialien laufen auf welchem Drucker? | X1C: alle; i3: PLA, PLA Tough, PETG |
| F44 | 🟡 In Arbeit | Steht AMS/Mehrfarbdruck zur Verfügung? | nein (TODO) |
| F45 | 🟡 In Arbeit | Welche Farben sind je Material tatsächlich vorrätig? | Standardfarben aus Altprodukt |
| F46 | 🟡 In Arbeit | Gibt es Mindestwandstärken/Designregeln, die wir Kunden nennen sollen? | noch keine |
| F47 | 🟡 In Arbeit | „Coating“ auf der Altseite: Was genau wird angeboten (Glätten, Lackieren, Versiegeln)? | Schleifen/Lackieren als Platzhalter |
| F66 | ✅ Erledigt | **Bestätigt:** Wandstärke 1,2 mm, Materialdurchsatz 15 cm³/h (Override), Verschnitt 5 %, Rüstkosten 3,50 € + 0,75 € je weiterem Teil, Mindestauftrag 6,00 € (Override), Rundung 0,10 €.<br>*(14.11.2026)* | – |

## 9. Shop und Produkte 🟡

| Nr. | Status | Frage |
| --- | --- | --- |
| F48 | 🟡 In Arbeit | Das Altprodukt „Recycling-Box“ kostet 11,00–12,50 € je nach Farbe. Welche Farben kosten welchen Preis? |
| F49 | 🟡 In Arbeit | Gewicht wird auf der Altseite mit „0,70 g“ angegeben – ist das ein Tippfehler (70 g)? |
| F50 | 🟡 In Arbeit | Lagerbestand: Wird auf Bestellung gedruckt (kein Bestand) oder sollen Stückzahlen gepflegt werden? |
| F51 | 🟡 In Arbeit | Sind weitere Produkte geplant? Bitte Name, Beschreibung, Preis, Varianten, Fotos. |
| F52 | 🟡 In Arbeit | Sollen Produktbewertungen möglich sein? (Erfordert Konto + Moderation.) |
| F53 | 🟡 In Arbeit | Kundenkonto gewünscht oder nur Gastbestellungen? (Aktuell ist das Konto optional und nicht aktiv.) |
| F67 | 🔴 Offen | Soll der Shop nach Freigabe von Preisen, Versand und Recht live gehen? Checkout und Zahlung (Stripe-Testmodus) sind technisch aktiv; der Livegang erfolgt erst nach fachlicher Freigabe und Stripe-Live-Schaltung. |

## 10. Recht und Datenschutz 🔴

| Nr. | Status | Frage |
| --- | --- | --- |
| F54 | 🔴 Offen | Wer prüft die Rechtstexte (Anwalt/Steuerberater)? Die Texte sind als technische Entwürfe markiert und müssen vor dem Livegang freigegeben werden. |
| F55 | 🔴 Offen | Hosting: Ist dieser Server ein gemieteter Root-Server? Bitte Anbieter und Anschrift für die Datenschutzerklärung (AVV mit dem Hoster nötig). |
| F56 | ✅ Erledigt | **Entschieden:** Die Abschnitte zu Google Analytics/AdSense wurden entfernt. Die neue Seite setzt kein Tracking ein.<br>*(13.11.2026)* |
| F57 | 🟡 In Arbeit | **Umgesetzt:** Die AGB wurden sprachlich an den neuen Checkout und die Zahlungsarten angepasst. Offen: rechtliche Prüfung. |
| F58 | ✅ Erledigt | **Umgesetzt:** Widerrufsbelehrung enthält den Ausschluss für Sonderanfertigungen; Muster-Widerrufsformular als PDF unter `/widerruf/formular.pdf`. Die rechtliche Gesamtprüfung bleibt F54.<br>*(14.11.2026)* |
| F59 | 🟡 In Arbeit | **Entwurf aktualisiert:** Die Datenschutzerklärung beschreibt Rechner-Upload, E-Mail-Ablage und Zahlungsdienstleister. Offen: automatische Löschung der Uploads nach 90 Tagen technisch umsetzen und rechtlich bestätigen. |
| F60 | 🟡 In Arbeit | **Empfehlung:** Kein Consent-Banner nötig, solange nur technisch notwendige Cookies und keine externen Skripte/Tracker eingesetzt werden. Bitte rechtlich bestätigen. |

## 11. Betrieb 🟢

| Nr. | Status | Frage |
| --- | --- | --- |
| F61 | 🔴 Offen | Tägliches Backup: nur lokal unter `/var/lib/3d-mir/backups` oder zusätzlich extern (z. B. Hetzner Storage Box/S3)? |
| F62 | 🟡 In Arbeit | Aufbewahrungsdauer für Bestellungen/Rechnungen (steuerlich 10 Jahre) und für Angebotsanfragen? |
| F63 | 🔴 Offen | Soll die Admin-Anmeldung zusätzlich per TOTP-2FA abgesichert werden? Das Datenfeld ist vorbereitet, 2FA ist noch nicht aktiviert. |
| F64 | ✅ Erledigt | **Erledigt:** Der Admin-Zugang des Betreibers ist eingerichtet. Offen: Sollen weitere Personen Zugang erhalten? Zugänge werden mit `npm run admin:create -- --email … --name …` angelegt; Passwörter werden nie im Repo gespeichert.<br>*(13.11.2026)* |
| F65 | 🔴 Offen | Soll ein Monitoring/Alerting (z. B. Uptime-Check) eingerichtet werden? |

---

## 12. Kontakt, Antworten und Spam-Schutz 🟡

Kontaktanfragen werden mit Länderprüfung, signiertem Zeit-Token, Honeypot, Rate-Limit und Inhaltsprüfung angenommen. Auffällige Nachrichten landen im Prüfmodus und werden erst nach manueller Freigabe an den Betreiber weitergeleitet. Antworten können direkt aus dem Admin per E-Mail gesendet werden.

| Nr. | Status | Frage / Entscheidung |
| --- | --- | --- |
| F73 | ✅ Erledigt | **Umgesetzt:** Direkte Antwort auf Kontaktnachrichten aus dem Admin inklusive Speicherung des Antworttexts und `.eml`-Fallback ohne SMTP. Nachweis: Antwortversand im Test.<br>*(14.11.2026)* |
| F74 | ✅ Erledigt | **Umgesetzt:** Add-Buttons in allen Preis-Kategorien; mehrere neue Materialien, Drucker, Nachbearbeitungen, Versandarten, Versandoptionen und Rabattstaffeln können in einem Speichervorgang angelegt werden.<br>*(14.11.2026)* |
| F75 | ✅ Erledigt | **Umgesetzt:** Bankdaten erscheinen nicht mehr auf der öffentlichen Seite „Zahlungsarten“ und nicht auf der Bestell-Danke-Seite. Kunden erhalten sie ausschließlich in der Bestellbestätigung per E-Mail bei Auswahl „Vorkasse“.<br>*(14.11.2026)* |
| F76 | 🟡 In Arbeit | **Länder-Allowlist bestätigen:** Das Land wird serverseitig aus der IP-Adresse ermittelt (lokale GeoIP-Datenbank, kein Besucherfeld). Aktuell ist nur Deutschland (`DE`) freigegeben; andere Länder werden zur Prüfung gespeichert. Sollen weitere Länder (z. B. AT, CH, NL) zugelassen werden? Einstellung unter **Admin → Nachrichten**. |
| F77 | ✅ Erledigt | **Umgesetzt:** Länder-Header von Proxy/CDN (`CF-IPCountry` usw.) werden nur ausgewertet, wenn sie über `COUNTRY_HEADER` ausdrücklich konfiguriert sind und die Verbindung von einem in `TRUST_PROXY` eingetragenen Proxy stammt. Standardmäßig entscheidet ausschließlich die lokale GeoIP-Datenbank; damit sind gefälschte Header ausgeschlossen. Nachweis: Test mit `X-Forwarded-For` (DE/US) und ohne ermittelbares Land.<br>*(14.11.2026)* |
| F78 | 🟢 Später | **Externer Captcha-Dienst:** Bewusst nicht eingebaut, um keine externen Skripte und Tracking einzubinden. Soll später ein datenschutzfreundlicher Captcha ergänzt werden? |
| F79 | 🟡 In Arbeit | **Etsy-API-Freigabe:** Die Etsy-App steht auf „Pending Personal Approval“. Der CSV-Import ist erfolgt (13 Produkte); nach der Freigabe werden die exakten Variationspreise und Bestände per API nachgezogen. |

## 13. Nächste Schritte bis zum Livegang

1. **Zahlung live schalten:** F13 (Bankverbindung) und F68 (Stripe-Live-Schlüssel, Live-Webhook, Live-Test).
2. **Benachrichtigungen einrichten:** F21–F24, F69–F71 (SMTP, Telegram, Kanal und Ereignisse).
3. **Kontakt-Spam-Schutz bestätigen:** F76 (erlaubte Länder) prüfen; GeoIP-Datenbank mit `deploy/update-geoip.sh` installieren und monatlich aktualisieren; Antworten und Prüfmodus im Admin testen.
4. **DNS, TLS und Port:** F30–F33 (Domain, certbot, kanonische www-Variante) und F72 (reservierter Port auf dem Shared Server).
5. **Rechtstexte prüfen lassen:** F54–F59; danach Prüfhinweis entfernen.
6. **Betrieb absichern:** F61–F65 (externes Backup, Aufbewahrung, 2FA, Monitoring).
7. **Abnahme:** Test auf frischer VM anhand `docs/INSTALLATION.md`, danach `deploy/verify.sh` und Live-Testbestellung.

---

## Erledigt / Archiv

| Nr. | Erledigt am | Nachweis |
| --- | --- | --- |
| F9 | 13.11.2026 | Zahlungsarten festgelegt; Commit `c21ac49`, `764d8a7` |
| F10 | 13.11.2026 | PayPal über Stripe; Stripe-Test |
| F12 | 13.11.2026 | Nachnahme nicht zum Start |
| F22 | 13.11.2026 | Admin-/Setup-Maske für Benachrichtigungen; Commit `a1234d2` |
| F25 | 13.11.2026 | Repository eingerichtet |
| F26 | 13.11.2026 | SSH-Push funktioniert |
| F56 | 13.11.2026 | Tracking-Abschnitte entfernt |
| F58 | 14.11.2026 | Widerrufsausschluss für Sonderanfertigungen und PDF-Formular ergänzt |
| F64 | 13.11.2026 | Admin-Zugang eingerichtet |
| F1–F8, F66 | 14.11.2026 | Preise und Kalkulation bestätigt |
| F14–F20 | 14.11.2026 | Versandkosten und Lieferzeiten bestätigt |
| F73 | 14.11.2026 | Direktantwort aus dem Admin inkl. `.eml`-Fallback |
| F74 | 14.11.2026 | Add-Buttons und mehrere Neu-Zeilen im Preis-Admin |
| F75 | 14.11.2026 | Bankdaten nur noch in der Vorkasse-Bestätigungsmail |
| F77 | 14.11.2026 | Länder-Header nur von vertrauenswürdigem Proxy; sonst lokale GeoIP-Datenbank |
