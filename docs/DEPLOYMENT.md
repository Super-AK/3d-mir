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

## Zahlungen mit Stripe

Die Anwendung unterstützt Vorkasse, Kredit-/Debitkarte, PayPal, Amazon Pay, Klarna und iDEAL. Karte, PayPal, Amazon Pay, Klarna und iDEAL laufen über Stripe Checkout (Weiterleitung, keine Zahlungsdaten auf dem eigenen Server).

### Umgebungsvariablen

In `/etc/3d-mir/3d-mir.env` (chmod 600):

```bash
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
PAYMENT_BASE_URL=https://www.3d-mir.de
```

- `STRIPE_MODE` dient nur der Anzeige im Admin (`test`/`live`).
- `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` sind Pflicht, damit Karte, PayPal, Amazon Pay, Klarna und iDEAL im Checkout erscheinen.
- `PAYMENT_BASE_URL` ist die öffentliche Basis für Erfolgs-/Abbruch-URLs. Für lokale Tests z. B. `http://127.0.0.1:3000`; produktiv `https://www.3d-mir.de`.
- Nach Änderungen: `sudo systemctl restart 3d-mir.service`.

### Stripe-Dashboard

1. Geschäftskonto bei Stripe anlegen und verifizieren.
2. Im Dashboard **Karte**, **PayPal**, **Amazon Pay**, **Klarna** und **iDEAL** aktivieren.
3. Webhook-Endpunkt `https://www.3d-mir.de/zahlung/webhook/stripe/` anlegen und diese Ereignisse abonnieren:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Das Webhook-Secret als `STRIPE_WEBHOOK_SECRET` eintragen.
5. Bankverbindung unter **Admin → Zahlungen** pflegen.

### Test und Livegang

- Zuerst mit `sk_test_…` und Testkarten arbeiten; Live-Schlüssel erst nach DNS-/TLS-Umstellung eintragen.
- Der Webhook muss öffentlich über HTTPS erreichbar sein. Bis die Domain auf den neuen Server zeigt, kann er z. B. mit der Stripe CLI weitergeleitet werden.
- Prüfung: `sudo deploy/verify.sh` (unsignierte Webhook-Anfrage muss mit HTTP 400 abgelehnt werden).
- Testbestellung mit Karte, PayPal, Amazon Pay, Klarna und iDEAL; anschließend Status im Admin und in der Datenbank prüfen.
- Bei Zahlungsausfall oder Abbruch muss die Bestellung auf „fehlgeschlagen“ stehen und über die Bestellübersicht erneut zahlbar sein.

### Wichtige Hinweise

- Die Domain muss auf den neuen Server zeigen, sonst leitet Stripe nach der Zahlung auf die alte WordPress-Seite.
- Ohne `STRIPE_WEBHOOK_SECRET` werden Stripe-Methoden nicht angeboten; Vorkasse bleibt verfügbar.
- Zahlungsdaten (Kartennummern) werden nie auf dem eigenen Server gespeichert.
- Stripe- und PayPal-Gebühren sind in die Preise einkalkuliert; Aufschläge für Karte/PayPal/SEPA sind nach PSD2 unzulässig.

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

Unbezahlte Bestellungen nach Ablauf der Zahlungsfrist stornieren und Bestand freigeben:

```bash
sudo -u mir3d npm run orders:cleanup -- --days 7
```

Empfohlener Cron-Lauf (täglich):

```cron
45 3 * * * cd /var/www/3d-mir.de && sudo -u mir3d npm run orders:cleanup -- --days 7 >>/var/log/3d-mir/cleanup.log 2>&1
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
- [ ] Stripe-Testmodus: Karte, PayPal, Amazon Pay, Klarna und iDEAL getestet; Webhook-Signatur und Zahlungsstatus geprüft.
- [ ] Bankverbindung unter **Admin → Zahlungen** hinterlegt und auf `/zahlung/` sichtbar.
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
| Zahlung bleibt „offen“ | Stripe-Webhook prüfen: URL, Secret, Ereignisse; `journalctl -u 3d-mir` nach `Stripe-Webhook` durchsuchen. |
| Stripe-Methoden fehlen | `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` setzen und Dienst neu starten. |
| Login gesperrt | Rate-Limit (5 Versuche/15 Min.) abwarten oder Sitzungen in der DB löschen. |

## Offene Punkte

- DNS-/TLS-Umstellung und kanonische `www`-Variante bestätigen (F30–F33).
- Externes Backup-Ziel festlegen (F61).
- SMTP-Zugangsdaten hinterlegen (F21–F24).
- Stripe-Konto anlegen, Live-Schlüssel und Webhook-Secret hinterlegen (F9–F13).
- Bankverbindung für Vorkasse im Admin eintragen (F13).
