# Phasenplan und Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Analyse, Systemprüfung, Projektgerüst, NGINX, systemd, Git | ✅ abgeschlossen |
| 2 | Design-System, statische Seiten, Rechtsseiten, Kontakt | ⬜ offen |
| 3 | Rechner: Upload, 3D-Vorschau, Preis, Angebotsanfrage | ⬜ offen |
| 4 | Shop: Produkte, Warenkorb, Checkout, E-Mails | ⬜ offen |
| 5 | Admin: Login, Produkte, Bestellungen, Anfragen, Preise | ⬜ offen |
| 6 | Konto (optional), SEO, Redirects, Performance, Security | ⬜ offen |
| 7 | Deployment-Paket und Test auf frischer VM | ⬜ offen |
| 8 | Abnahme und Abschlussbericht | ⬜ offen |

## Phase 1 – Bericht

**Fertig**
- Alte Seite vollständig ausgelesen (13 URLs), Rechts- und Produkttexte gesichert (`docs/alt-inhalte/`).
- 21 Bilder heruntergeladen, EXIF/GPS beim Bild-Build entfernt, AVIF/WebP/JPG-Varianten erzeugt.
- Projektgerüst: Fastify 5 + TypeScript, Nunjucks, Vite, SQLite mit Migrationen, systemd, NGINX.
- Startseite (Grundgerüst), Health-Endpunkt `/api/health`, 404-/Fehlerseiten, Security-Header.
- NGINX-Vhost `3d-mir.de` (Port 80) mit Reverse Proxy, gzip, Cache-Headern; UFW nur 22/80/443.
- Benutzer `mir3d`, Datenverzeichnisse `/var/lib/3d-mir` und `/var/log/3d-mir`, `.env` unter `/etc/3d-mir` (chmod 600).
- Dokumentation: README, ANALYSE, OFFENE-FRAGEN, REDIRECTS.

**Getestet**
- `npm run typecheck`, `npm run build` fehlerfrei.
- `curl /` → 200, `/api/health` → 200 mit DB-Status, unbekannte URL → 404.
- `nginx -t` erfolgreich, Dienst `3d-mir.service` aktiv, Port 3000 nur auf 127.0.0.1.

**Offen**
- Beantwortung der Fragen in `docs/OFFENE-FRAGEN.md` (Preise, Zahlung, Versand, SMTP, GitHub, DNS).
- Inhalte/Design der Phase 2.
