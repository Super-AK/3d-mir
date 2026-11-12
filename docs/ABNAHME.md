# Abnahme

Stand: 12. November 2026

Diese Checkliste fasst den technischen Stand zusammen und dient als Grundlage für die Abnahme durch den Auftraggeber. Sie ersetzt keine rechtliche Prüfung der Texte und keine Freigabe der Preise.

## Umfang

- Statische Seiten: Start, Leistungen, Kontakt, Impressum, Datenschutz, AGB, Widerruf, Versand, Zahlung.
- 3D-Druck-Rechner mit Modell-Upload (STL/OBJ/3MF), Analyse, Preis-Schätzung, 3D-Vorschau und Angebotsanfrage.
- Shop mit Produktseite, Farbvarianten, Warenkorb, Kasse, Bestellbestätigung und E-Mail-Benachrichtigungen.
- Admin-Bereich: Anmeldung, Dashboard, Bestellungen, Anfragen, Kontaktnachrichten, Produkte, Preise, Passwort.
- Betrieb: NGINX, systemd, SQLite (WAL), Backups, Update/Rollback, Deployment-Skripte, Dokumentation.
- SEO: Sitemap, robots.txt, Canonicals, JSON-LD, 301-Weiterleitungen der Alt-URLs.
- Sicherheit: CSP, Security-Header, CSRF-Schutz, Argon2id, Rate-Limits, gehärteter systemd-Dienst, UFW.

## Prüfergebnisse

| Kriterium | Ergebnis | Nachweis |
| --- | --- | --- |
| Build und TypeScript | bestanden | `npm run typecheck`, `npm run build` |
| Unit-Tests | 19/19 bestanden | `npm test` |
| E2E-Tests | 7/7 ausführbar bestanden (Admin-Test optional, benötigt Zugangsdaten) | `npm run test:e2e` |
| Betriebsprüfung | 26/26 bestanden | `sudo deploy/verify.sh` |
| Lighthouse mobil – Startseite | Performance 100, Accessibility 100, Best Practices 100, SEO 100 | Lighthouse 12, gedrosselt |
| Lighthouse mobil – Shop | 99 / 100 / 100 / 100 | Lighthouse 12 |
| Lighthouse mobil – Rechner | 97 / 100 / 100 / 100 | Lighthouse 12 |
| Lighthouse mobil – Kontakt | 99 / 100 / 100 / 100 | Lighthouse 12 |
| 301-Weiterleitungen | geprüft für Alt-URLs inkl. `/produkt/*`, `/wp-*`, `/versandarten/`, `/mein-konto/` | E2E-Test, `curl -I` |
| Sitemap/robots.txt | 200, Sitemap gültiges XML, alle aktiven Produkte enthalten | E2E-Test |
| Datenbank/Backup | Integrität `ok`, Backup und Restore beschrieben | `deploy/backup.sh`, `deploy/verify.sh` |
| Rechtstexte | inhaltlich aus Altbestand übernommen, Prüfhinweis sichtbar | Seiten `/impressum/`, `/datenschutz/`, `/agb/`, `/widerruf/` |
| Preise/Versand/Zahlung | technisch aktiv, aber als Platzhalter gekennzeichnet | `config/*.json`, Shop- und Rechnerhinweise |

## Abnahmekriterien

| Kriterium | Status | Anmerkung |
| --- | --- | --- |
| Alle Seiten und Funktionen erreichbar | ✅ | per E2E und `verify.sh` geprüft |
| Keine erfundenen Geschäftsdaten | ✅ | Platzhalter zentral in `config/`, offene Fragen dokumentiert |
| Keine externen CDNs, Fonts, Tracker | ✅ | Schriften und Skripte lokal; CSP ohne externe Quellen |
| Nur technisch notwendige Cookies | ✅ | Warenkorb und Admin-Sitzung |
| Rechtstexte unverändert übernommen, Prüfhinweis | ✅ | redaktionelle Prüfung durch Auftraggeber offen |
| Preise, Versand, Zahlung bestätigt | ⬜ | F1–F20, F66, F67 |
| SMTP-Zugang hinterlegt | ⬜ | F21–F24; aktuell `.eml`-Fallback |
| Admin-Zugang für Betreiber eingerichtet | ⬜ | F64; per `npm run admin:create` |
| DNS-Umstellung und TLS | ⬜ | F30–F33; Skripte und Checkliste vorbereitet |
| Test auf frischer VM | ⬜ | Checkliste in `docs/DEPLOYMENT.md`; Re-Run auf Produktionssystem bestanden |
| Rechtliche Freigabe | ⬜ | F54–F59 |

## Offene Punkte vor dem Livegang

1. Preise, Kalkulationswerte, Versandkosten und Zahlungsarten bestätigen (F1–F20, F66, F67).
2. SMTP-Zugangsdaten hinterlegen (F21–F24).
3. Admin-Zugang anlegen und TOTP-Entscheidung treffen (F63, F64).
4. DNS auf den neuen Server umstellen, TLS per certbot aktivieren, kanonische `www`-Variante bestätigen (F30–F33).
5. Rechtstexte durch Betreiber/Anwalt prüfen lassen (F54–F59).
6. Backup-Ziel und Aufbewahrung final festlegen (F61, F62).
7. Test auf einer frischen VM mit der Checkliste in `docs/DEPLOYMENT.md` durchführen.

## Abnahmeerklärung

Hiermit wird die technische Umsetzung gemäß den vereinbarten Phasen 1–8 abgenommen. Offene Punkte bleiben bis zur Klärung ausdrücklich zurückgestellt.

| | Auftraggeber | Auftragnehmer |
| --- | --- | --- |
| Name | | |
| Ort, Datum | | |
| Unterschrift | | |

> **Hinweis:** Dieses Dokument ist ein technisches Abnahmeprotokoll. Es enthält keine Rechtsberatung. Rechtstexte, Preise und geschäftliche Angaben sind vor der Veröffentlichung vom Auftraggeber zu prüfen.
