# Deployment und Betrieb

Diese Anleitung beschreibt **Betrieb, Update, Backup und Wiederherstellung** auf einem Ubuntu-Server (24.04 LTS oder 26.04 LTS, arm64 oder x86_64).

> **Neuinstallation oder Umzug auf einen anderen Server?** Die vollständige Schritt-für-Schritt-Anleitung inklusive Node.js 22, DNS/TLS, bestehender NGINX-Sites und WordPress-Umzug steht in [`docs/INSTALLATION.md`](INSTALLATION.md). Dieses Dokument setzt eine installierte Anwendung voraus.

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

## Benachrichtigungen (E-Mail und Telegram)

Unter **Admin → Benachrichtigungen** wird eingestellt, wie der Betreiber informiert wird:

- **Nur E-Mail**
- **Nur Telegram**
- **E-Mail und Telegram**

Die Kanalwahl betrifft nur Admin-Benachrichtigungen (neue Bestellung, Kontaktanfrage, Angebotsanfrage, Zahlungseingang). Kunden-E-Mails werden immer per E-Mail versendet.

### E-Mail

SMTP-Server, Port, Benutzername, Passwort, Absender und Betreiber-Postfach können im Admin gepflegt werden. Alternativ gelten die Umgebungsvariablen `SMTP_*`, `MAIL_FROM` und `MAIL_TO`. Admin-Einstellungen haben Vorrang.

Ohne SMTP werden E-Mails als `.eml` unter `/var/log/3d-mir/mail/` gespeichert.

### Telegram

1. Bot bei **@BotFather** anlegen.
2. Bot-Token kopieren.
3. Bot in Telegram anschreiben.
4. Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates` ermitteln.
5. Bot-Token und Chat-ID im Admin eintragen.
6. Testnachricht senden.

Bot-Token und SMTP-Passwort liegen in der Datenbank und sind in Backups enthalten. Backups entsprechend schützen.

## Mischbetrieb mit WordPress beenden

**Status:** Auf dem Produktivserver erledigt (15.11.2026). Die folgenden Schritte bleiben als Referenz für weitere Installationen erhalten.

Die neue Anwendung liefert `/shop/`, `/3d-druck-rechner/`, `/warenkorb/` und `/mein-konto/` selbst aus. Die alten Footer-Links werden per 301 umgeleitet:

| Alt | Neu |
| --- | --- |
| `/versandarten/` | `/versand/` |
| `/bezahlmoeglichkeiten/` | `/zahlung/` |
| `/widerrufsbelehrung/` | `/widerruf/` |
| `/cookie-richtlinie-eu/` | `/datenschutz/#cookies` |

Vorgehen auf dem Produktivserver:

1. **Backup der alten WordPress-Installation** (Dateien und Datenbank) außerhalb des Webroots ablegen.
2. NGINX-Vhost der alten Seite deaktivieren und nur den 3D-MIR-Vhost aktiv lassen:
   ```bash
   sudo nginx -T | grep -n "server_name.*3d-mir"
   sudo unlink /etc/nginx/sites-enabled/<alter-wordpress-vhost>
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. WordPress-Dateien erst nach erfolgreicher Prüfung entfernen:
   ```bash
   curl -I https://www.3d-mir.de/wp-content/    # muss 404 sein
   curl -I https://www.3d-mir.de/shop/          # muss 200 vom Node-Dienst sein
   ```
4. Cookie-Banner und Marketing-Plugins entfallen mit WordPress. Die neue Seite setzt nur technisch notwendige Cookies (`warenkorb`, `mir3d_admin`, `mir3d_admin_pending`) und benötigt keinen Consent-Banner. Reichweitenstatistiken werden serverseitig ohne Cookies und ohne vollständige IP-Adressen erhoben.
5. `sudo deploy/verify.sh` prüft die Weiterleitungen und dass `/wp-content/...` nicht mehr ausgeliefert wird.

**Wichtig:** WordPress-Datenbank und Uploads erst löschen, wenn das Backup geprüft ist und keine alten Inhalte mehr benötigt werden.

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

### Produktiv-Update auf einem gemeinsam genutzten Server

Auf Servern wie `kap-srv`, auf denen NGINX weitere Webseiten bedient und Port
3000 belegt sein kann, in dieser Reihenfolge vorgehen:

**1. Vor dem Update prüfen**

```bash
cd /var/www/3d-mir.de
sudo git status --short
sudo git log --oneline -3
```

- Arbeitsbaum **sauber**: weiter mit Schritt 2.
- Lokale Änderungen an `config/*.json`: zuerst sichern, z. B.
  `sudo git stash push -u -m "prod-vor-update"`. Stammdaten künftig über
  **Admin → Stammdaten** pflegen, nicht in der Datei.

**2. Port prüfen (nur wenn der Dienst nicht läuft)**

```bash
sudo deploy/setup.sh
# Menüpunkt 15: „Port prüfen / freien Port setzen“
```

Das Skript schlägt einen freien Port vor, aktualisiert `.env`,
`/etc/nginx/sites-available/<domain>.conf` und den Dienst. Andere Vhosts
bleiben unangetastet.

**3. Code und Build aktualisieren**

```bash
# Variante A: neueste Skripte direkt aus Git holen, dann ohne erneuten Pull bauen
sudo git fetch origin
sudo git merge --ff-only origin/main
sudo deploy/update.sh --no-pull

# Variante B: Update-Skript erledigt Pull, Backup, Build, Neustart selbst
sudo deploy/update.sh
```

`update.sh` erstellt vorher ein Backup, führt `npm ci` aus, baut die Anwendung,
startet `3d-mir.service` neu und prüft `/api/health` **direkt am Anwendungsport**
(nicht über den NGINX-Default-Vhost). Bei einem Fehler wird automatisch auf
Commit und Build-Artefakte zurückgerollt.

**4. Nacharbeiten**

```bash
sudo deploy/update-geoip.sh    # GeoIP-Datenbank für die Länderprüfung
sudo deploy/verify.sh          # 28 Prüfungen
sudo systemctl status 3d-mir.service --no-pager
```

**5. Im Admin prüfen**

- **Veröffentlichung:** „Preise und Kalkulation sind bestätigt“ muss aktiv sein.
- **Stammdaten:** Adresse, Telefon, Logo, Hero- und Galeriebilder.
- **Kategorien:** sieben Startkategorien und Produktzuordnungen.
- **Zahlungen:** nur die gewünschten Arten aktiv.
- **Nachrichten:** Länder-Allowlist und GeoIP-Status.
- **Produkte → Aus Etsy importieren:** CSV/API nach Bedarf.

**Erstinstallation statt Update:** Wenn auf dem Server noch keine laufende
3D-MIR-Instanz existiert, `sudo deploy/install.sh` ausführen (oder
`sudo deploy/setup.sh` → Punkt 1). Der Installer prüft den Port und richtet
Dienst und NGINX-Vhost ein. Danach Admin-Zugang, GeoIP und `verify.sh`.

## GeoIP-Datenbank aktualisieren

Die Länderprüfung des Kontaktformulars nutzt eine lokale Datenbank. Sie sollte monatlich erneuert werden:

```bash
sudo deploy/update-geoip.sh              # Download, Prüfung, Installation, Neustart
sudo deploy/update-geoip.sh --no-restart # ohne Neustart (z. B. im Wartungsfenster)
```

Quelle ist DB-IP Lite (Lizenz CC BY 4.0). Die vorherige Datei bleibt als `.bak` erhalten. Alternativ steht der Menüpunkt **„GeoIP-Datenbank aktualisieren“** im Setup-Menü (`sudo deploy/setup.sh`) zur Verfügung.

## Monitoring

Der Installer richtet `3d-mir-monitor.timer` ein. Der Timer startet alle fünf Minuten einen Health-Check gegen den Anwendungsport und benachrichtigt über den im Admin gewählten Kanal (E-Mail/Telegram), wenn die Anwendung nicht erreichbar ist oder wieder läuft.

```bash
systemctl status 3d-mir-monitor.timer
systemctl list-timers '3d-mir-*'
journalctl -u 3d-mir-monitor.service -n 50 --no-pager
npm run monitor:check        # manuell, aus dem Projektverzeichnis
```

Der Zustand wird unter `/var/lib/3d-mir/monitor-state.json` gespeichert. Während eines anhaltenden Ausfalls wird höchstens alle sechs Stunden erneut erinnert.

## Löschung alter Uploads und Anfragen

Der Timer `3d-mir-cleanup.timer` läuft täglich um 03:30 Uhr:

- **Modelldateien** aus Angebotsanfragen werden nach **90 Tagen** gelöscht.
- **Angebotsanfragen** und **Kontaktnachrichten** werden nach **24 Monaten** gelöscht.
- **Spam-Beobachtungen und abgelaufene Absender-Sperren** werden nach **30 Tagen** ohne Aktivität entfernt.
- **Besucherstatistiken** (pseudonyme Zähler) werden nach **12 Monaten** gelöscht.
- Verwaiste Dateien im Upload-Verzeichnis werden mit aufgeräumt.

Die Fristen entsprechen der Datenschutzerklärung („Modell-Uploads bis zu 90 Tage“, „Kontaktanfragen bis zu 24 Monate“, „Besucherstatistik 12 Monate“). Steuerlich relevante Bestelldaten sind davon nicht betroffen; diese liegen in der Bestelltabelle.

```bash
systemctl status 3d-mir-cleanup.timer
systemctl list-timers '3d-mir-*'
journalctl -u 3d-mir-cleanup.service -n 50 --no-pager
npm run uploads:cleanup -- --dry-run
npm run uploads:cleanup -- --days 90 --inquiry-months 24 --visitor-months 12
```

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

Prüft Node-Version, Dienststatus, `nginx -t`, alle wichtigen Seiten, Sicherheits-Header, 301-/404-Regeln, SQLite-Integrität, Verzeichnisrechte und den TLS-Ablauf. Liegt ein Let's-Encrypt-Zertifikat vor, wird automatisch über HTTPS geprüft (lokal per `--resolve` gegen NGINX); sonst über HTTP mit `Host`-Header. Exit-Code 1 bei Fehlern, geeignet für Monitoring.

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
| Startfehler `EADDRINUSE` | Der Anwendungsport ist belegt, z. B. durch eine andere Web-App. Der Installer prüft das vorab und wählt bei freier Wahl automatisch einen Port im Bereich 3000–3099. Nachträglich: Setup-Menü → „Port prüfen / freien Port setzen“ oder `ss -ltnp '( sport = :3000 )'` prüfen. Der Dienst versucht es beim Start bis zu fünfmal. |
| Health-Check rot, DB-Fehler | Rechte auf `/var/lib/3d-mir` prüfen; Dienst läuft als `mir3d`. |
| Kein TLS | DNS noch nicht umgestellt oder Port 80 blockiert; `certbot` erneut ausführen. |
| E-Mails fehlen | Ohne SMTP werden `.eml`-Dateien unter `/var/log/3d-mir/mail/` abgelegt. |
| Telegram-Nachrichten fehlen | Im Admin ist der Kanal „Nur Telegram“ oder „E-Mail und Telegram“ gewählt? Bot-Token/Chat-ID korrekt, Bot wurde angeschrieben, Testnachricht senden. |
| Zahlung bleibt „offen“ | Stripe-Webhook prüfen: URL, Secret, Ereignisse; `journalctl -u 3d-mir` nach `Stripe-Webhook` durchsuchen. |
| Stripe-Methoden fehlen | `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` setzen und Dienst neu starten. |
| Login gesperrt | Rate-Limit (5 Versuche/15 Min.) abwarten oder Sitzungen in der DB löschen. |

## Offene Punkte

- Externes Backup-Ziel festlegen (F61) und Aufbewahrung bestätigen (F62).
- Stripe-Live-Schlüssel, Live-Webhook und Live-Test durchführen (F68).
- Rechtstexte anwaltlich prüfen lassen (F54–F59).
- Etsy-API-Freigabe abwarten (F79).
