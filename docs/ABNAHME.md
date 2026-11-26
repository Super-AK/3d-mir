# Abnahme

Stand: 26. November 2026 · Version 1.0.0-rc.84

Diese Checkliste fasst den technischen Stand zusammen und dient als Grundlage für die Abnahme durch den Auftraggeber. Sie ersetzt keine rechtliche Prüfung der Texte und keine Freigabe der Preise.

## Umfang

- Statische Seiten: Start, Leistungen, Kontakt, Impressum, Datenschutz, AGB, Widerruf, Versand, Zahlung.
- 3D-Druck-Rechner mit Modell-Upload (STL/OBJ/3MF), Analyse, Preis-Schätzung, 3D-Vorschau und Angebotsanfrage.
- Shop mit Produktseite, Farbvarianten, Kategorien und Filter, Warenkorb, Kasse, Bestellbestätigung und E-Mail-Benachrichtigungen.
- Zahlungen: Vorkasse, Karte, PayPal, Amazon Pay, Klarna und iDEAL über Stripe Checkout; Zahlungsstatus, Webhook und Bestätigungen.
- Kontakt: Formular mit IP-basierter Länderprüfung, Spam-Schutz, Prüfmodus und Direktantwort im Admin.
- Admin-Bereich: Anmeldung, Dashboard, Stammdaten, Bestellungen, Anfragen, Kontaktnachrichten, Produkte, Kategorien, Preise, Zahlungen, Benachrichtigungen, Veröffentlichung, Rechtstexte, Etsy-Import, Passwort.
- Etsy-Import: CSV und API, Bildübernahme, Varianten, Testlauf.
- Betrieb: NGINX, systemd, SQLite (WAL), Backups, Update/Rollback, GeoIP-Aktualisierung, Setup-Menü (TUI), Deployment-Skripte, Dokumentation.
- SEO: Sitemap, robots.txt, Canonicals, JSON-LD, 301-Weiterleitungen der Alt-URLs.
- Sicherheit: CSP, Security-Header, CSRF-Schutz, Argon2id, Rate-Limits, gehärteter systemd-Dienst, UFW.

## Prüfergebnisse

| Kriterium | Ergebnis | Nachweis |
| --- | --- | --- |
| Build und TypeScript | bestanden | `npm run typecheck`, `npm run build` |
| Unit-Tests | 48/48 bestanden | `npm test` |
| E2E-Tests | 7/7 ausführbare Tests bestanden, Admin-Test optional übersprungen (benötigt Zugangsdaten) | `npm run test:e2e` |
| Betriebsprüfung | 28/28 bestanden | `sudo deploy/verify.sh` |
| Lighthouse mobil – Startseite | Performance 100, Accessibility 100, Best Practices 100, SEO 100 | Lighthouse 12, gedrosselt |
| Lighthouse mobil – Shop | 99 / 100 / 100 / 100 | Lighthouse 12 |
| Lighthouse mobil – Rechner | 97 / 100 / 100 / 100 | Lighthouse 12 |
| Lighthouse mobil – Kontakt | 99 / 100 / 100 / 100 | Lighthouse 12 |
| 301-Weiterleitungen | geprüft für Alt-URLs inkl. `/produkt/*`, `/wp-*`, `/versandarten/`, `/mein-konto/` | E2E-Test, `curl -I` |
| Sitemap/robots.txt | 200, Sitemap gültiges XML, alle aktiven Produkte enthalten | E2E-Test |
| Datenbank/Backup | Integrität `ok`, Backup und Restore beschrieben | `deploy/backup.sh`, `deploy/verify.sh` |
| Rechtstexte | inhaltlich aus Altbestand übernommen, Prüfhinweis sichtbar | Seiten `/impressum/`, `/datenschutz/`, `/agb/`, `/widerruf/` |
| Preise/Versand/Zahlung | Zahlung technisch umgesetzt (Vorkasse + Stripe mit Karte, PayPal, Amazon Pay, Klarna und iDEAL); Preise/Versand weiterhin Platzhalter | `config/*.json`, `settings`, Stripe-Env |
| Kontakt/Spam-Schutz | Länderprüfung aus IP, Prüfmodus, Direktantwort und Freigabe im Admin | `/kontakt/`, Admin → Nachrichten |
| Kategorien | Verwaltung, Mehrfachzuordnung und Shop-Filter | Admin → Kategorien, `/shop/?kategorie=…` |
| Etsy-Import | CSV und API, Testlauf, Bildübernahme, Hintergrundprozess | Admin → Produkte → Aus Etsy importieren |
| Veröffentlichung | Platzhalter-Hinweise im Admin schaltbar | Admin → Veröffentlichung |
| Stammdaten | Geschäftsdaten, Kontakt, SEO, Startseiten-Texte und Bilder im Admin | Admin → Stammdaten |
| Widerrufsformular | Muster-Widerrufsformular als PDF, 200/application/pdf | E2E-Test, `/widerruf/formular.pdf` |

## Abnahmekriterien

| Kriterium | Status | Anmerkung |
| --- | --- | --- |
| Alle Seiten und Funktionen erreichbar | ✅ | per E2E und `verify.sh` geprüft |
| Keine erfundenen Geschäftsdaten | ✅ | Platzhalter zentral in `config/`, offene Fragen dokumentiert |
| Keine externen CDNs, Fonts, Tracker | ✅ | Schriften und Skripte lokal; CSP ohne externe Quellen |
| Nur technisch notwendige Cookies | ✅ | Warenkorb und Admin-Sitzung; Reichweitenmessung cookie-frei |
| Besucherstatistik im Admin | ✅ | Aufrufe, Länder, Tag/Woche/Monat; Dashboard-Zusammenfassung; 12 Monate Aufbewahrung |
| Produkte als CSV importieren/exportieren | ✅ | Zusätzlich zum JSON-Format; SKU-Update, Varianten/Farben/Kategorien; E2E geprüft |
| Rechtstexte unverändert übernommen, Prüfhinweis | ✅ | redaktionelle Prüfung durch Auftraggeber offen |
| Preise und Kalkulation bestätigt | ✅ | F1–F8, F66 (14.11.2026) |
| Versand bestätigt | ✅ | F14–F20 (14.11.2026) |
| Zahlung technisch umgesetzt | ✅ | Vorkasse + Stripe Checkout, Webhook, Admin; Stripe-Konto/Schlüssel offen |
| Benachrichtigungen | ✅ | E-Mail/Telegram im Admin wählbar; SMTP-/Telegram-Test |
| SMTP-Zugang hinterlegt | ⬜ | F21–F24; aktuell `.eml`-Fallback |
| Admin-Zugang für Betreiber eingerichtet | ⬜ | F64; per `npm run admin:create` |
| DNS-Umstellung und TLS | ⬜ | F30–F33; Skripte und Checkliste vorbereitet |
| Test auf frischer VM | ⬜ | Checkliste in `docs/INSTALLATION.md`; Re-Run auf Produktionssystem bestanden |
| Rechtliche Freigabe | ⬜ | F54–F59 |

## Offene Punkte vor dem Livegang

1. Stripe-Konto anlegen, Live-Schlüssel/Webhook-Secret hinterlegen und Bankverbindung im Admin eintragen (F9–F13, F68).
2. SMTP- und Telegram-Zugangsdaten hinterlegen und Testnachrichten versenden (F21–F24, F69–F71).
3. Admin-Zugang anlegen und TOTP-Entscheidung treffen (F63, F64).
4. DNS auf den neuen Server umstellen, TLS per certbot aktivieren, kanonische `www`-Variante bestätigen (F30–F33).
5. Rechtstexte durch Betreiber/Anwalt prüfen lassen (F54–F59).
6. Backup-Ziel und Aufbewahrung final festlegen (F61, F62).
7. Länder-Allowlist bestätigen und GeoIP-Datenbank monatlich aktualisieren (F76).
8. Etsy-App-Freigabe abwarten, danach API-Import für exakte Variationen ausführen.
9. Portkonflikt auf `kap-srv` beheben und Installation dort abschließen (F72).
10. Test auf einer frischen VM mit der Checkliste in `docs/INSTALLATION.md` durchführen.

## Abnahmeerklärung

Hiermit wird die technische Umsetzung gemäß den vereinbarten Phasen 1–8 in Version 1.0.0-rc.84 abgenommen. Offene Punkte bleiben bis zur Klärung ausdrücklich zurückgestellt.

| | Auftraggeber | Auftragnehmer |
| --- | --- | --- |
| Name | | |
| Ort, Datum | | |
| Unterschrift | | |

> **Hinweis:** Dieses Dokument ist ein technisches Abnahmeprotokoll. Es enthält keine Rechtsberatung. Rechtstexte, Preise und geschäftliche Angaben sind vor der Veröffentlichung vom Auftraggeber zu prüfen.
