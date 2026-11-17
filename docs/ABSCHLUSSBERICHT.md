# Abschlussbericht

**Projekt:** Neuaufbau der Website 3D-MIR (3D-Druck Service, Schömberg)
**Stand:** 14. November 2026 · **Version:** 1.0.0-rc.43
**Technischer Status:** Release-Kandidat, alle geplanten Funktionen umgesetzt; Abnahme und Livegang offen

## 1. Ausgangslage und Ziel

Die bisherige WordPress-Seite wurde vollständig ausgelesen und durch eine eigene Anwendung ersetzt. Ziel war ein schneller, datenschutzfreundlicher Auftritt mit Sofort-Preisrechner, kleinerem Shop und einem Admin-Bereich, der ohne externe Dienste und ohne Tracking auskommt.

Alle Alt-URLs werden dauerhaft per 301 auf die neuen Seiten umgeleitet. Rechtstexte wurden inhaltlich unverändert übernommen und als „rechtlich zu prüfen“ gekennzeichnet. Preise, Kalkulation, Versandkosten und Lieferzeiten wurden am 14.11.2026 bestätigt; die Live-Schaltung der Zahlungsarten ist noch offen.

## 2. Ergebnis

| Bereich | Inhalt |
| --- | --- |
| Startseite | Leistungsversprechen, Ablauf, Materialien, Galerie, Preishinweis, Handlungsaufrufe |
| Leistungen | FDM-Druck, Materialien, Drucker, typische Anwendungen |
| Rechner | Upload von STL/OBJ/3MF, serverseitige Analyse, Preis-Schätzung, three.js-Vorschau im Browser, Angebotsanfrage |
| Shop | Produkte (inkl. 13 Etsy-Importe), Kategorien und Filter, Farbvarianten, Warenkorb, Kasse, Bestellbestätigung |
| Recht | Impressum, Datenschutz, AGB, Widerruf, Versand, Zahlung – mit Prüfhinweis |
| Kontakt | Formular mit IP-basierter Länderprüfung, Zeit-Token, Honeypot, Rate-Limit und Direktantwort im Admin |
| Admin | Login, Dashboard, Stammdaten, Bestellungen, Anfragen, Nachrichten, Produkte, Kategorien, Preise, Zahlungen, Benachrichtigungen, Veröffentlichung, Rechtstexte, Etsy-Import, Passwort |
| SEO | Sitemap, robots.txt, Canonicals, JSON-LD, 301-Weiterleitungen, sprechende URLs |
| Betrieb | NGINX, systemd, SQLite WAL, Backups, Update/Rollback, Verify-Skript, Dokumentation |

## 3. Technik

- **Backend:** Node.js 22 LTS, Fastify 5, TypeScript, Zod-Validierung.
- **Datenbank:** SQLite im WAL-Modus über `better-sqlite3`, versionierte SQL-Migrationen.
- **Templates:** Nunjucks, serverseitiges Rendering, progressive Enhancement.
- **Frontend:** eigenes CSS, Vanilla TypeScript, Vite; three.js lokal gebündelt.
- **Betrieb:** NGINX als Reverse Proxy, systemd-Dienst `3d-mir` (gehärtet), UFW nur 22/80/443.
- **Tests:** Vitest (Unit) und Playwright (E2E).
- **Keine externen Laufzeitabhängigkeiten:** keine CDNs, keine Google Fonts, kein Tracking, keine Social-Plugins.

## 4. Phasen

1. **Analyse und Gerüst:** Altseite ausgelesen, Bilder optimiert, Fastify/SQLite/Nunjucks/Vite aufgesetzt, NGINX und systemd eingerichtet.
2. **Statische Seiten und Recht:** Design-System, Start-, Leistungs- und Kontaktseite, Rechtsseiten mit Prüfhinweis.
3. **Rechner:** Mesh-Parser für STL/OBJ/3MF, gemeinsame Preisformel für Server und Browser, 3D-Vorschau, Angebotsanfrage.
4. **Shop:** Produkt, Varianten, Warenkorb-Cookie, Kasse, transaktionale Bestellung, Bestätigung, E-Mail-Fallback.
5. **Admin:** Argon2id-Login, serverseitige Sitzungen, CSRF, Bestellungen, Anfragen, Nachrichten, Produkte, dynamische Preise, Passwortänderung.
6. **SEO und Performance:** Sitemap, robots.txt, JSON-LD, 301-Regeln, Schrift-Subset, LCP-Optimierung, HSTS-Vorbereitung.
7. **Deployment:** Installer, Update mit Rollback, Backup/Restore, Verify-Skript, NGINX-/systemd-Vorlagen, Betriebsdokumentation.
8. **Abnahme:** Abschlussprüfungen, Abnahmeprotokoll, Abschlussbericht.

## 5. Qualität und Messungen

- **Lighthouse mobil:** Start 100/100/100/100, Shop 99/100/100/100, Rechner 97/100/100/100, Kontakt 99/100/100/100 (Performance/Accessibility/Best Practices/SEO).
- **Tests:** 48 Unit-Tests, 7 ausführbare E2E-Tests; Admin-E2E optional mit Zugangsdaten.
- **Betriebsprüfung:** 28/28 Prüfungen bestanden (`deploy/verify.sh`).
- **Sicherheit:** CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS bei HTTPS; Admin mit `noindex`.
- **Barrierefreiheit:** Kontraste, Fokus-Stile, Skip-Link, semantische Struktur, Tastaturbedienbarkeit; Lighthouse Accessibility 100.

## 6. Datenschutz und Recht

- Nur technisch notwendige Cookies: Warenkorb (signiert, httpOnly) und Admin-Sitzung.
- Keine Analyse- oder Marketingdienste, keine externen Schriftarten, keine eingebetteten Karten oder Videos.
- Uploads liegen außerhalb des Webroots unter `/var/lib/3d-mir/uploads`.
- Kontakt- und Bestelldaten werden in SQLite gespeichert; E-Mails ohne SMTP als `.eml` unter `/var/log/3d-mir/mail/`.
- Rechtstexte sind Entwürfe bzw. Alttexte und müssen vor Veröffentlichung geprüft werden.

## 7. Betrieb und Übergabe

- Installation: `sudo deploy/install.sh`
- Update: `sudo deploy/update.sh`
- Backup: `sudo deploy/backup.sh`
- Restore: `sudo deploy/restore.sh <archiv>`
- Prüfung: `sudo deploy/verify.sh`
- Admin-Zugang: `sudo -u mir3d npm run admin:create -- --email … --name …`

Alle Schritte sind in `docs/INSTALLATION.md` (Neuinstallation/Umzug) und `docs/DEPLOYMENT.md` (Betrieb) beschrieben. Die Abnahme-Checkliste liegt in `docs/ABNAHME.md`, die offenen Fragen in `docs/OFFENE-FRAGEN.md`.

## 8. Offene Punkte

| Thema | Referenz |
| --- | --- |
| Preise, Kalkulation, Mindestauftragswert | F1–F8, F66 |
| Stripe-Konto, Live-Schlüssel, Bankverbindung | F9–F13, F67 |
| SMTP-/Telegram-Zugang | F21–F24, F69–F71 |
| Länder-Allowlist und GeoIP-Aktualisierung | F76 |
| Etsy-API-Freigabe (Variationen) | F79 |
| Portkonflikt auf `kap-srv` | F72 |
| DNS, TLS, kanonische Domain | F30–F33 |
| Admin-Zugang und TOTP-2FA | F63, F64 |
| Rechtliche Prüfung der Texte | F54–F59 |
| Backup-Ziel und Aufbewahrung | F61, F62 |
| Test auf frischer VM | Checkliste in `docs/INSTALLATION.md` |

## 9. Risiken und Hinweise

- **Domain zeigt noch auf die alte Seite.** Die neue Anwendung läuft auf dem Server, ist aber erst nach DNS-Umstellung öffentlich erreichbar.
- **TLS ist noch nicht aktiv.** HSTS wird automatisch gesetzt, sobald HTTPS genutzt wird.
- **Preise und Versand sind bestätigt.** Der Shop ist technisch bestellbar; vor dem Livegang fehlen noch Stripe-Live-Schlüssel und die rechtliche Freigabe.
- **Admin-Zugang existiert noch nicht.** Er muss bewusst durch den Betreiber angelegt werden; das Passwort nie im Repository hinterlegen.
- **E-Mails ohne SMTP** landen als Dateien im Log-Verzeichnis und werden nicht zugestellt.

## 10. Fazit

Die technische Umsetzung ist vollständig, getestet und dokumentiert. Die Anwendung ist bereit für die DNS-Umstellung und die inhaltliche Abnahme. Vor dem Livegang sind noch die rechtliche Freigabe, Stripe live, SMTP/Telegram sowie DNS/TLS erforderlich.
