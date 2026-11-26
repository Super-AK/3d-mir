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
| Zahlungsarten | 🟡 In Arbeit | Bankdaten und Methoden auf Prod eingerichtet; Stripe-Live-Schaltung offen |
| Kontakt/Spam-Schutz | ✅ Erledigt | Länderprüfung aktiv; DE, AT und CH zugelassen, übrige Länder zur Prüfung |
| Benachrichtigungen | ✅ Erledigt | SMTP und Telegram auf Prod eingerichtet; Kanal und Kopieoption im Admin wählbar |
| Kategorien | ✅ Erledigt | Verwaltung, Mehrfachzuordnung und Shop-Filter umgesetzt |
| Veröffentlichung | ✅ Erledigt | Platzhalter-Hinweise im Admin schaltbar |
| Etsy-Import | ✅ Erledigt | CSV-Import umgesetzt und 13 Produkte übernommen; Etsy-API wurde abgelehnt |
| Installation/Deployment | ✅ Erledigt | Installationsanleitung und interaktives Setup-Menü vorhanden |
| Preise/Kalkulation | ✅ Erledigt | Vom Betreiber am 14.11.2026 bestätigt |
| Versand | ✅ Erledigt | Vom Betreiber am 14.11.2026 bestätigt |
| DNS/TLS | ✅ Erledigt | Laut Betreiber auf dem Produktivserver erledigt |
| Rechtstexte | ✅ Erledigt | Impressum, AGB, Widerruf und Datenschutz überarbeitet und anwaltlich geprüft |
| Betrieb/Backup | 🟡 In Arbeit | Uptime-Check eingerichtet; externes Backup-Ziel offen |

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
| F13 | ✅ Erledigt | **Erledigt:** Bankverbindung laut Betreiber auf dem Produktivserver unter **Admin → Zahlungen** hinterlegt.<br>*(14.11.2026)* |
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
| F21 | ✅ Erledigt | **Erledigt:** SMTP-Zugang laut Betreiber auf dem Produktivserver eingerichtet.<br>*(14.11.2026)* |
| F22 | ✅ Erledigt | **Entschieden:** Ja, es gibt eine interaktive Maske im Setup-Menü und im Admin. Zugangsdaten werden nicht im Repository gespeichert. Nachweis: Commit `a1234d2`.<br>*(13.11.2026)* |
| F23 | ✅ Erledigt | Absender und Betreiber-Postfach sind auf dem Produktivserver eingerichtet und bestätigt.<br>*(14.11.2026)* |
| F24 | ✅ Erledigt | **Umgesetzt:** Checkbox unter **Admin → Benachrichtigungen**; Kunden-E-Mails können als BCC an das Betreiber-Postfach gehen.<br>*(14.11.2026)* |
| F69 | ✅ Erledigt | **Erledigt:** Telegram ist laut Betreiber auf dem Produktivserver eingerichtet.<br>*(14.11.2026)* |
| F70 | ✅ Erledigt | Der Kanal lässt sich unter **Admin → Benachrichtigungen** wählen (E-Mail, Telegram oder beides).<br>*(14.11.2026)* |
| F71 | ✅ Erledigt | **Entschieden:** Keine Erweiterung der Telegram-Ereignisse. Statusänderungen an Kunden laufen weiterhin per E-Mail.<br>*(15.11.2026)* |

## 5. GitHub und Deployment 🟢

| Nr. | Status | Frage / Entscheidung |
| --- | --- | --- |
| F25 | ✅ Erledigt | **Entschieden:** Repository `git@github.com:Super-AK/3d-mir.git`.<br>*(13.11.2026)* |
| F26 | ✅ Erledigt | **Entschieden:** SSH-Deploy-Key; Push von `main` nach `origin/main` funktioniert.<br>*(13.11.2026)* |
| F27 | 🟡 In Arbeit | Sichtbarkeit des Repositories (privat/öffentlich) bestätigen. Der Push funktioniert unabhängig davon. |
| F28 | 🟡 In Arbeit | **Produktionsserver:** `kap-srv` mit weiteren Web-Apps. Bitte bestätigen, ob dies die endgültige Maschine ist und welcher Portbereich für 3D-MIR reserviert werden soll. |
| F29 | 🟡 In Arbeit | Gibt es einen Staging-/Testserver? Aktuell nicht dokumentiert. |
| F72 | ✅ Erledigt | **Erledigt:** Portkonflikt auf dem Produktivserver laut Betreiber behoben.<br>*(14.11.2026)* |

## 6. Domain, DNS und TLS 🔴

| Nr. | Status | Frage |
| --- | --- | --- |
| F30 | ✅ Erledigt | DNS und Mail liegen laut Betreiber auf dem Produktivserver; die Domain zeigt auf die neue Anwendung.<br>*(14.11.2026)* |
| F31 | ✅ Erledigt | **Erledigt:** Domain zeigt laut Betreiber auf den Produktivserver.<br>*(14.11.2026)* |
| F32 | ✅ Erledigt | **Erledigt:** TLS ist auf dem Produktivserver eingerichtet.<br>*(14.11.2026)* |
| F33 | ✅ Erledigt | **Erledigt:** Weiterleitung ist auf dem Produktivserver eingerichtet.<br>*(14.11.2026)* |

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
| F54 | ✅ Erledigt | **Erledigt:** Die Rechtstexte wurden anwaltlich geprüft und freigegeben.<br>*(15.11.2026)* |
| F55 | ✅ Erledigt | **Erledigt:** Hosting-Anbieter, Anschrift und AVV sind laut Betreiber geklärt.<br>*(14.11.2026)* |
| F56 | ✅ Erledigt | **Entschieden:** Die Abschnitte zu Google Analytics/AdSense wurden entfernt. Die neue Seite setzt kein Tracking ein.<br>*(13.11.2026)* |
| F57 | ✅ Erledigt | **Geprüft:** AGB zu Vertragsschluss, Preisen, Versand, Zahlung, Widerruf, Eigentumsvorbehalt, Gewährleistung, 3D-Druck, Datenschutz und Streitbeilegung anwaltlich freigegeben.<br>*(15.11.2026)* |
| F58 | ✅ Erledigt | **Umgesetzt:** Widerrufsbelehrung enthält den Ausschluss für Sonderanfertigungen; Muster-Widerrufsformular als PDF unter `/widerruf/formular.pdf`. Die rechtliche Gesamtprüfung bleibt F54.<br>*(14.11.2026)* |
| F59 | ✅ Erledigt | **Umgesetzt:** Modelldateien aus Angebotsanfragen werden nach 90 Tagen automatisch gelöscht (`3d-mir-cleanup.timer`); Anfrage- und Kontaktdaten bleiben erhalten. Datenschutzerklärung und Technik stimmen überein.<br>*(15.11.2026)* |
| F60 | 🟡 In Arbeit | **Empfehlung:** Kein Consent-Banner nötig, solange nur technisch notwendige Cookies und keine externen Skripte/Tracker eingesetzt werden. Bitte rechtlich bestätigen. |

## 11. Betrieb 🟢

| Nr. | Status | Frage |
| --- | --- | --- |
| F61 | 🔴 Offen | Tägliches Backup: nur lokal unter `/var/lib/3d-mir/backups` oder zusätzlich extern (z. B. Hetzner Storage Box/S3)? |
| F62 | ✅ Erledigt | **Umgesetzt:** Modelldateien 90 Tage; Angebotsanfragen und Kontaktnachrichten 24 Monate; Bestelldaten bleiben gemäß gesetzlicher Aufbewahrung erhalten. Cleanup läuft täglich um 03:30 Uhr.<br>*(15.11.2026)* |
| F63 | ✅ Erledigt | **Umgesetzt:** TOTP-2FA und Passkeys (WebAuthn) unter **Admin → Passwort und Sicherheit**; beim Login sind je nach Einrichtung Code und/oder Passkey erforderlich.<br>*(15.11.2026)* |
| F64 | ✅ Erledigt | **Erledigt:** Der Admin-Zugang des Betreibers ist eingerichtet. Offen: Sollen weitere Personen Zugang erhalten? Zugänge werden mit `npm run admin:create -- --email … --name …` angelegt; Passwörter werden nie im Repo gespeichert.<br>*(13.11.2026)* |
| F65 | ✅ Erledigt | **Umgesetzt:** systemd-Timer prüft alle fünf Minuten `/api/health` und benachrichtigt über den gewählten Kanal; Wiederherstellung wird ebenfalls gemeldet.<br>*(14.11.2026)* |

---

## 12. Kontakt, Antworten und Spam-Schutz 🟡

Kontaktanfragen werden mit Länderprüfung, signiertem Zeit-Token, Honeypot, Rate-Limit und Inhaltsprüfung angenommen. Auffällige Nachrichten landen im Prüfmodus und werden erst nach manueller Freigabe an den Betreiber weitergeleitet. Wiederholte auffällige Versuche werden pseudonymisiert gezählt und nach 3 oder 5 Versuchen automatisch gesperrt. Antworten können direkt aus dem Admin per E-Mail gesendet werden.

| Nr. | Status | Frage / Entscheidung |
| --- | --- | --- |
| F73 | ✅ Erledigt | **Umgesetzt:** Direkte Antwort auf Kontaktnachrichten aus dem Admin inklusive Speicherung des Antworttexts und `.eml`-Fallback ohne SMTP. Nachweis: Antwortversand im Test.<br>*(14.11.2026)* |
| F74 | ✅ Erledigt | **Umgesetzt:** Add-Buttons in allen Preis-Kategorien; mehrere neue Materialien, Drucker, Nachbearbeitungen, Versandarten, Versandoptionen und Rabattstaffeln können in einem Speichervorgang angelegt werden.<br>*(14.11.2026)* |
| F75 | ✅ Erledigt | **Umgesetzt:** Bankdaten erscheinen nicht mehr auf der öffentlichen Seite „Zahlungsarten“ und nicht auf der Bestell-Danke-Seite. Kunden erhalten sie ausschließlich in der Bestellbestätigung per E-Mail bei Auswahl „Vorkasse“.<br>*(14.11.2026)* |
| F76 | ✅ Erledigt | **Bestätigt:** Deutschland (`DE`), Österreich (`AT`) und die Schweiz (`CH`) sind zugelassen; übrige Länder werden zur Prüfung gespeichert.<br>*(15.11.2026)* |
| F77 | ✅ Erledigt | **Umgesetzt:** Länder-Header von Proxy/CDN (`CF-IPCountry` usw.) werden nur ausgewertet, wenn sie über `COUNTRY_HEADER` ausdrücklich konfiguriert sind und die Verbindung von einem in `TRUST_PROXY` eingetragenen Proxy stammt. Standardmäßig entscheidet ausschließlich die lokale GeoIP-Datenbank; damit sind gefälschte Header ausgeschlossen. Nachweis: Test mit `X-Forwarded-For` (DE/US) und ohne ermittelbares Land.<br>*(14.11.2026)* |
| F78 | 🟢 Später | **Externer Captcha-Dienst:** Bewusst nicht eingebaut, um keine externen Skripte und Tracking einzubinden. Soll später ein datenschutzfreundlicher Captcha ergänzt werden? |
| F79 | ✅ Erledigt | **Abgeschlossen:** Etsy hat die API-Freigabe abgelehnt. Der CSV-Import bleibt die Grundlage; die API-Importmaske wurde aus dem Admin entfernt.<br>*(15.11.2026)* |
| F80 | ✅ Erledigt | **Erledigt:** Der Betreiber ist bei LUCID (Zentrale Stelle Verpackungsregister) registriert und an der Systembeteiligung für versendete Verkaufsverpackungen beteiligt.<br>*(15.11.2026)* |
| F81 | ✅ Erledigt | **Bestätigt:** Herstellerangaben und Produktkennung auf den Produktseiten sind ausreichend; die Produktdaten wurden vom Betreiber geprüft.<br>*(15.11.2026)* |
| F82 | ✅ Erledigt | **Geprüft:** Impressum (DDG), AGB (dynamische Zahlungsarten, § 14 entfernt), Widerruf und Datenschutz (Rechtsgrundlagen, Aufsichtsbehörde, Drittland, Cookies) anwaltlich freigegeben.<br>*(15.11.2026)* |
| F83 | ✅ Erledigt | **Bestätigt:** Die gesetzlichen Aufbewahrungsfristen (in der Regel 6 bzw. 10 Jahre) wurden vom Steuerberater bestätigt.<br>*(15.11.2026)* |
| F84 | ✅ Erledigt | **Erledigt:** Der WordPress-Altbestand wurde entfernt und der Mischbetrieb beendet; die neuen Routen werden vollständig von der Anwendung ausgeliefert.<br>*(15.11.2026)* |
| F85 | 🟡 In Arbeit | **Neue Spam-Abwehr:** Die Datenschutzerklärung wurde um die Speicherung einer gekürzten IP-Adresse, einer nicht rückführbaren Prüfsumme und der Browserkennung ergänzt (Nachricht bis 24 Monate, reine Beobachtungen 30 Tage). Bitte bei der nächsten rechtlichen Prüfung bestätigen. |
| F86 | 🟡 Offen | **Besucherstatistik:** Die neue Auswertung im Admin zählt Aufrufe cookie-frei über einen täglich wechselnden, nicht rückführbaren HMAC aus gekürzter IP (IPv4 /24, IPv6 /48) und Datum. Die Datenschutzerklärung wurde entsprechend ergänzt (Abschnitt 7a, Aufbewahrung 12 Monate). Bitte bei der nächsten rechtlichen Prüfung bestätigen – insbesondere die Annahme, dass die täglichen Zähler ohne Einwilligung nach Art. 6 Abs. 1 lit. f DSGVO zulässig sind. |

## 13. Nächste Schritte bis zum Livegang

1. **Zahlung live schalten:** F68 (Stripe-Live-Schlüssel, Live-Webhook, Live-Test); Bankverbindung ist auf Prod hinterlegt.
2. **Benachrichtigungen prüfen:** Test-E-Mail und Test-Telegram im Admin senden; über die Kopieoption (F24) entscheiden.
3. **Betrieb absichern:** F61 (externes Backup-Ziel) und F62 (Aufbewahrung); Monitoring, 2FA/Passkeys und die 90-Tage-Löschung sind umgesetzt.
4. **Abnahme:** Test auf frischer VM anhand `docs/INSTALLATION.md`, danach `deploy/verify.sh` und Live-Testbestellung.
5. **Shop live schalten:** F67 im Admin unter „Veröffentlichung“; Rechtstexte sind freigegeben.

## 10. Shop-API / Faktura-App 🟡

| Nr. | Status | Frage / offener Punkt |
| --- | --- | --- |
| F87 | 🟡 In Arbeit | **Vertrags-Anmerkungen:** Die Vorschläge A1, A3, A5, A8–A11 in `VERTRAGS-ANMERKUNGEN.md` (Kunden ableiten, Attribute, eine Adresse, Rechnungslink, Preisspanne, Token-Rotation, Versionsangabe) brauchen eine Entscheidung des Auftraggebers. Nach Zustimmung den Vertrag aktualisieren und die neue Version an beide Agents geben. |
| F88 | ✅ Erledigt | **Phase 2 der API:** Webhooks (Signatur, Retry, Zustellprotokoll) und `PATCH /orders/{id}/status` sind umgesetzt. Nachweis: `openapi.yaml`, Admin-Seite „API & Schnittstellen", Timer `3d-mir-webhook.timer`. *(24.11.2026)* |
| F89 | ✅ Erledigt | **Gemeinsamer Abnahmetest:** Shop-Seite 14/14 grün (`scripts/api-acceptance.sh`), Faktura-Seite v1.4.98 grün (Pull, Kundennummern, PATCH /invoice, Webhook-Empfänger, GoBD, Dry-Run). Beidseitige Bestätigung in `docs/API-ABNAHME.md`. *(25.11.2026)* |
| F90 | ✅ Erledigt | **Produktiv-Token:** Vom Betreiber bestätigt – Token ist serverseitig in der Faktura-App hinterlegt. Die IP-Allowlist wird bei Bedarf anhand der IP im Shop-Zugriffs-Log ergänzt. Kein Token in Repo, Ticket oder E-Mail. *(25.11.2026)* |
| F91 | ✅ Erledigt | **Rechnungslink:** Faktura-App liefert eine token-gesicherte, täglich erneuerte HTTPS-PDF-URL. Die Shop-API akzeptiert `invoice_url`; das Kundenkonto zeigt sie nur eingeloggten, berechtigten Kunden und bei Ablauf „Link abgelaufen, bitte anfragen". *(25.11.2026)* |
| F92 | 🟢 Später | **Rate-Limit:** Aktuell 60 Anfragen/Minute pro Token im Speicher des einen Servers. Bei mehreren Instanzen wäre ein gemeinsamer Zähler (z. B. in SQLite/Redis) nötig. |
| F93 | ✅ Erledigt | **Kundentabelle:** Mit K1 gibt es `customers`; die bisher abgeleiteten IDs bleiben stabil (Vertrag v1.2 §6.2). 3D-Attribute bleiben aus dem aktuellen Produkt (A3, von v1.2 angenommen). *(25.11.2026)* |
| F94 | ✅ Erledigt | **Bestands-Nachtrag (K1):** Dev und Prod nach Backup ausgeführt (`npm run customers:backfill -- --confirm`). Alle Bestellungen haben `customer_id`; Nummern wurden in `created_at`-Reihenfolge vergeben und nie wiederverwendet. Nachweis: GitHub Actions `45703639237`, Schritt „Kunden-Nachtrag (F94 …)" erfolgreich. *(25.11.2026)* |
| F95 | ✅ Erledigt | **Support-Rolle:** `users.role = support` (Migration 027), Anmeldung und Lesezugriff möglich; Schreiben nur noch für interne Notizen, kein Export, keine Status-/Anonymisierungs-/Passwortaktionen. Anlegen mit `npm run admin:create -- --email … --role support`. *(25.11.2026)* |

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
