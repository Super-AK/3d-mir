# Deployment und Betrieb

Diese Anleitung beschreibt Installation, Update, Backup und Wiederherstellung auf einem frischen Ubuntu-Server (24.04 LTS oder 26.04 LTS, arm64 oder x86_64).

## Voraussetzungen

- Ubuntu-Server mit Root-Zugang (SSH).
- Domain `3d-mir.de` und `www.3d-mir.de`, DNS zeigt auf den Server (für TLS).
- Ports 22, 80 und 443 erreichbar; Port 3000 bleibt lokal.
- Mindestens 1 GB RAM, 10 GB freier Speicher (empfohlen: 2 GB / 20 GB).
- Node.js 22 LTS (das Installationsskript prüft die Version und bricht bei älteren Versionen ab).

Verzeichnisse nach der Installation:

| Pfad | Inhalt |
| --- | --- |
| `/var/www/3d-mir.de` | Anwendung, Build, Konfiguration |
| `/var/lib/3d-mir` | SQLite-Datenbank, Uploads, Backups |
| `/var/log/3d-mir` | Anwendungslog, E-Mail-Fallback (`.eml`) |
| `/etc/3d-mir/3d-mir.env` | Umgebungsvariablen inkl. `SESSION_SECRET` (chmod 600) |

## Erstinstallation

1. Code auf den Server bringen, z. B. per Git oder `rsync`:

   ```bash
   sudo mkdir -p /var/www/3d-mir.de
   sudo rsync -a --exclude node_modules --exclude .git ./ /var/www/3d-mir.de/
   ```

2. Installer starten:

   ```bash
   cd /var/www/3d-mir.de
   sudo deploy/install.sh
   ```

   Der Installer fragt Domain, Let's-Encrypt-E-Mail und optional den Admin-Zugang ab. Nicht-interaktiv:

   ```bash
   sudo DOMAIN=3d-mir.de CERTBOT_EMAIL=admin@example.de SKIP_TLS=1 deploy/install.sh --non-interactive
   ```

3. Nach der DNS-Umstellung TLS einrichten (falls beim Installer übersprungen):

   ```bash
   sudo certbot --nginx -d 3d-mir.de -d www.3d-mir.de --redirect -m admin@example.de --agree-tos
   ```

4. Admin-Zugang anlegen (falls nicht im Installer geschehen):

   ```bash
   sudo -u mir3d npm run admin:create -- --email admin@example.de --name "Betreiber"
   ```

5. Prüfen:

   ```bash
   sudo deploy/verify.sh
   ```

Der Installer ist idempotent: Vorhandene `.env`-Dateien und NGINX-Konfigurationen werden gesichert und nicht ungefragt überschrieben. Ein erneuter Lauf aktualisiert Pakete, Build und Dienst.

## Update und Rollback

```bash
sudo deploy/update.sh           # Backup, optional Git-Pull, Build, Neustart, Health-Check
sudo deploy/update.sh --no-pull # ohne Git-Pull (z. B. nach manuellem Upload)
```

Ablauf:

1. Backup über `deploy/backup.sh`.
2. Falls ein Git-Remote konfiguriert ist: `git fetch` und `git merge --ff-only`.
3. `npm ci` und `npm run build`.
4. Neustart von `3d-mir.service` und Health-Check (`/api/health`).
5. Bei Fehler: Rücksetzen auf den vorherigen Commit bzw. die gesicherten Build-Artefakte, Neustart und erneuter Health-Check.

Migrationen laufen beim Start der Anwendung und sind idempotent.

## Backup

```bash
sudo deploy/backup.sh [Zielverzeichnis]
```

Standardziel ist `/var/lib/3d-mir/backups`. Gesichert werden:

- SQLite-Datenbank (konsistent über `sqlite3 .backup`, inkl. Integritätsprüfung),
- Uploads aus `/var/lib/3d-mir/uploads`,
- `config/*.json`,
- `/etc/3d-mir/3d-mir.env`,
- aktueller Git-Commit.

Aufbewahrung: 14 Tage (`BACKUP_KEEP_DAYS`). Archive sind nur für root lesbar.

Tägliches Backup per Cron:

```cron
15 3 * * * /var/www/3d-mir.de/deploy/backup.sh >/var/log/3d-mir/backup.log 2>&1
```

Externe Kopie (empfohlen, sobald Storage Box/S3 bestätigt ist – F61): Archiv zusätzlich per `rsync`/`rclone` ausleiten.

### Wiederherstellung

```bash
sudo deploy/restore.sh /var/lib/3d-mir/backups/3d-mir-YYYYmmdd-HHMMSS.tar.gz
```

Das Skript sichert zuerst den aktuellen Zustand, stoppt den Dienst, prüft die Datenbank, spielt Datenbank, Uploads, Konfiguration und `.env` ein und startet den Dienst mit Health-Check.

## Betriebsprüfung

```bash
sudo deploy/verify.sh
```

Prüft Node-Version, Dienststatus, `nginx -t`, alle wichtigen Seiten, Sicherheits-Header, 301-/404-Regeln, SQLite-Integrität, Verzeichnisrechte und den TLS-Ablauf (falls Zertifikat vorhanden). Exit-Code 1 bei Fehlern, geeignet für Monitoring.

## Test auf frischer VM

Der Installer wurde auf dem vorhandenen Ubuntu-26.04-System als idempotenter Re-Run getestet (Pakete, Build, Dienst, NGINX, Health-Check). Für die Abnahme auf einer frischen VM die folgende Checkliste abarbeiten:

- [ ] Ubuntu 24.04/26.04 minimal, nur SSH erreichbar.
- [ ] Code nach `/var/www/3d-mir.de` kopieren, `sudo deploy/install.sh` ausführen.
- [ ] Installer endet mit `Health-Check` und `{"status":"ok"}`.
- [ ] `sudo deploy/verify.sh` meldet 0 Fehler (TLS-Zeile darf vor DNS-Umstellung leer sein).
- [ ] `systemctl status 3d-mir` und `journalctl -u 3d-mir` ohne Fehler.
- [ ] `sudo ufw status` zeigt nur 22/80/443.
- [ ] `curl -I http://<server>/versandarten/` liefert `301` auf `/versand/`.
- [ ] `curl http://<server>/sitemap.xml` liefert gültiges XML.
- [ ] Admin-Login unter `/admin/` funktioniert, Passwortänderung möglich.
- [ ] Testbestellung im Shop und Angebotsanfrage im Rechner funktionieren.
- [ ] `sudo deploy/backup.sh` erzeugt ein Archiv; `deploy/restore.sh` spielt es erfolgreich zurück.
- [ ] Nach DNS-Umstellung: `certbot --nginx …`, HTTPS erzwingen, `verify.sh` prüft Zertifikat.
- [ ] Lighthouse auf Startseite, Shop, Rechner und Kontakt ≥ 95 in allen Kategorien.

## Logs und Fehlersuche

```bash
journalctl -u 3d-mir.service -n 100 --no-pager   # Anwendung
tail -f /var/log/3d-mir/app.log                  # Anwendungslog
nginx -t && systemctl reload nginx               # Webserver
sqlite3 /var/lib/3d-mir/db/3d-mir.sqlite 'PRAGMA integrity_check;'
```

| Problem | Ursache / Lösung |
| --- | --- |
| 502 Bad Gateway | Dienst nicht aktiv: `systemctl status 3d-mir`, Logs prüfen. |
| Health-Check rot, DB-Fehler | Rechte auf `/var/lib/3d-mir` prüfen; Dienst läuft als `mir3d`. |
| Kein TLS | DNS noch nicht umgestellt oder Port 80 blockiert; `certbot` erneut ausführen. |
| E-Mails fehlen | Ohne SMTP werden `.eml`-Dateien unter `/var/log/3d-mir/mail/` abgelegt. |
| Login gesperrt | Rate-Limit (5 Versuche/15 Min.) abwarten oder Sitzungen in der DB löschen. |

## Offene Punkte

- DNS-/TLS-Umstellung und kanonische `www`-Variante bestätigen (F30–F33).
- Externes Backup-Ziel festlegen (F61).
- SMTP-Zugangsdaten hinterlegen (F21–F24).
