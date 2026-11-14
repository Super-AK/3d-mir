# Installation und Server-Setup

Diese Anleitung beschreibt die Installation der 3D-MIR-Webseite auf einem **neuen** oder **bereits genutzten** Linux-Server. Sie deckt die Erstinstallation, die Koexistenz mit anderen Websites, die Übernahme einer bestehenden Domain, TLS, Zahlungen, Backup und die Abnahme ab.

> **Kurzfassung für erfahrene Anwender:**
>
> ```bash
> sudo apt-get update
> sudo apt-get install -y git curl ca-certificates build-essential python3 openssl
> # Node.js 22 über NodeSource installieren (siehe Abschnitt 3.2)
> sudo git clone git@github.com:Super-AK/3d-mir.git /var/www/3d-mir.de
> cd /var/www/3d-mir.de
> sudo deploy/setup.sh          # interaktives Menü
> # oder direkt:
> sudo DOMAIN=3d-mir.de CERTBOT_EMAIL=admin@example.de deploy/install.sh
> sudo deploy/verify.sh
> ```
>
> Die vollständige Anleitung mit Erklärungen, Alternativen und Fehlersuche steht unten.

---

## 1. Überblick

### 1.1 Architektur

| Komponente | Funktion |
| --- | --- |
| NGINX | Reverse Proxy, TLS, Auslieferung der statischen Assets |
| Node.js 22 + Fastify | Anwendung, Shop, Rechner, Admin |
| SQLite (WAL) | Datenbank für Produkte, Bestellungen, Anfragen, Einstellungen |
| systemd | Dienst `3d-mir.service`, automatischer Neustart |
| Let's Encrypt | TLS-Zertifikat über certbot |

### 1.2 Verzeichnisse

| Pfad | Inhalt |
| --- | --- |
| `/var/www/3d-mir.de` | Anwendung und Build |
| `/var/lib/3d-mir` | SQLite-Datenbank, Uploads, Backups |
| `/var/log/3d-mir` | Anwendungslog, E-Mail-Fallback (`.eml`) |
| `/etc/3d-mir/3d-mir.env` | Geheimnisse und Laufzeitkonfiguration (chmod 600) |
| `/etc/systemd/system/3d-mir.service` | systemd-Dienst |
| `/etc/nginx/sites-available/3d-mir.de.conf` | NGINX-Vhost |

### 1.3 Ports

| Port | Zweck | Öffentlich? |
| --- | --- | --- |
| 22 | SSH | ja, nach Möglichkeit auf Schlüssel beschränken |
| 80 | HTTP, Let's Encrypt, Redirect auf HTTPS | ja |
| 443 | HTTPS | ja |
| 3000 | Node.js-Anwendung, nur lokal | **nein** |

### 1.4 Zwei Installationswege

- **Variante A – neuer Server:** empfohlen, der Installer richtet alles ein.
- **Variante B – vorhandener Server:** zuerst Bestand prüfen, dann den Installer mit angepassten Werten ausführen oder manuell installieren.
- **Variante C – alte WordPress-Seite ersetzen:** neue Seite parallel testen, dann DNS umstellen.

---

## 2. Voraussetzungen

### 2.1 Server

| Anforderung | Empfehlung |
| --- | --- |
| Betriebssystem | Ubuntu 24.04 LTS oder 26.04 LTS, Debian-nah |
| Architektur | x86_64 oder arm64 |
| CPU/RAM | mindestens 1 vCPU / 1 GB RAM, empfohlen 2 GB |
| Speicher | mindestens 10 GB frei, empfohlen 20 GB |
| Node.js | 22 LTS (systemweit als `/usr/bin/node`) |
| NGINX | 1.24 oder neuer |
| SQLite | CLI `sqlite3` für Backup/Prüfung |
| Domain | `3d-mir.de` und `www.3d-mir.de` (oder eine andere Domain) |
| E-Mail | SMTP-Zugang für Bestell- und Kontakt-E-Mails |
| Zahlungen | Stripe-Konto für Karte, PayPal, Amazon Pay, Klarna, iDEAL |

### 2.2 Zugänge und Daten

- Root- oder sudo-Zugang per SSH.
- Git-Zugang zum Repository `git@github.com:Super-AK/3d-mir.git` (SSH-Key) oder HTTPS-Zugang.
- DNS-Verwaltung für die Domain.
- E-Mail-Adresse für Let's Encrypt.
- E-Mail-Adresse und Passwort für den Admin-Zugang.
- Stripe-Schlüssel erst nach dem Stripe-Onboarding.
- Bankverbindung für Vorkasse (IBAN/BIC) – **nicht** in Git oder Chat.

### 2.3 Wichtige Grundsätze

- Keine Geheimnisse im Repository. Die `.env` liegt ausschließlich unter `/etc/3d-mir/3d-mir.env`.
- Port 3000 wird nie öffentlich freigegeben.
- Vor Änderungen an einem bestehenden Server: Backup von NGINX-Konfiguration und bestehender Website.
- Preise, Versandkosten und Rechtstexte sind vor dem Livegang fachlich und rechtlich zu prüfen.

---

## 3. Variante A – Neuer Server

### 3.1 System aktualisieren und Basispakete installieren

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl ca-certificates build-essential python3 openssl ufw dnsutils
```

`build-essential` und `python3` werden nur benötigt, falls `npm ci` native Module (z. B. `better-sqlite3`) aus dem Quellcode baut. Die Installation schadet nicht.

### 3.2 Node.js 22 installieren

Ubuntu 24.04 liefert standardmäßig Node.js 18. Die Anwendung benötigt **Node.js 22**.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
node -v   # muss v22.x.x zeigen
npm -v
```

Alternativ kann Node.js 22 aus einem anderen vertrauenswürdigen Paket-Repository installiert werden. Wichtig ist, dass `/usr/bin/node` auf Version 22 zeigt, weil die systemd-Unit diesen Pfad verwendet.

Der Installer prüft die Node-Version und installiert Node.js 22 über NodeSource nach, falls es fehlt oder zu alt ist. Die Vorabinstallation ist trotzdem empfehlenswert, damit ein eventueller Fehler sofort sichtbar wird.

### 3.3 Code nach `/var/www/3d-mir.de` holen

**Mit SSH-Key (empfohlen):**

```bash
sudo mkdir -p /var/www
```

Falls der Server noch keinen Root-SSH-Key für GitHub hat:

```bash
sudo ssh-keygen -t ed25519 -C "server@3d-mir.de"
sudo cat /root/.ssh/id_ed25519.pub
# Public Key bei GitHub unter Settings → SSH and GPG keys hinterlegen
sudo ssh -T git@github.com
```

Dann klonen:

```bash
sudo git clone git@github.com:Super-AK/3d-mir.git /var/www/3d-mir.de
```

Der Clone läuft bewusst als root, weil `/var/www` root gehört. Wenn stattdessen ein normaler Benutzer klont, die Dateien anschließend nach `/var/www/3d-mir.de` kopieren und dem Installer `APP_DIR` entsprechend setzen.

**Alternativ per HTTPS:**

```bash
sudo git clone https://github.com/Super-AK/3d-mir.git /var/www/3d-mir.de
```

Bei einem privaten Repository einen GitHub-Token verwenden, aber **nicht** dauerhaft in der Remote-URL speichern.

### 3.4 DNS vorbereiten

Beim DNS-Anbieter setzen:

| Typ | Name | Ziel |
| --- | --- | --- |
| A | `3d-mir.de` | IPv4 des Servers |
| A | `www.3d-mir.de` | IPv4 des Servers |
| AAAA | `3d-mir.de` | IPv6 des Servers, falls vorhanden |
| AAAA | `www.3d-mir.de` | IPv6 des Servers, falls vorhanden |

Prüfen:

```bash
dig +short A 3d-mir.de
dig +short AAAA 3d-mir.de
dig +short A www.3d-mir.de
```

Die DNS-Umstellung kann einige Minuten bis Stunden dauern. TLS lässt sich erst einrichten, wenn die Domain auf den Server zeigt.

> **Cloudflare/Proxy:** Wenn die Domain über einen Proxy (orangene Wolke) läuft, kann die HTTP-01-Prüfung von Let's Encrypt fehlschlagen. Für die Zertifikatsausstellung vorübergehend „DNS only“ verwenden oder eine DNS-01-Challenge einrichten.

### 3.5 Installer ausführen

```bash
cd /var/www/3d-mir.de
sudo DOMAIN=3d-mir.de CERTBOT_EMAIL=admin@example.de deploy/install.sh
```

Der Installer prüft vor dem Start, ob der Anwendungsport frei ist. Ist Port 3000 bereits durch eine andere Web-App belegt, wählt er automatisch einen freien Port im Bereich 3000–3099 und schreibt ihn in `.env` und NGINX-Konfiguration. Ein explizit gesetzter `PORT` wird respektiert; ist er belegt, bricht der Installer mit einem Vorschlag ab.

Der Installer fragt zusätzlich nach Admin-E-Mail und Name. Er richtet ein:

- Systempakete (NGINX, SQLite, certbot, ufw, rsync),
- Dienstbenutzer `mir3d`,
- Verzeichnisse `/var/lib/3d-mir` und `/var/log/3d-mir`,
- `/etc/3d-mir/3d-mir.env` mit zufälligem `SESSION_SECRET`,
- Node-Abhängigkeiten und Produktionsbuild,
- systemd-Dienst `3d-mir.service`,
- eigene NGINX-Konfiguration `/etc/nginx/sites-available/<domain>.conf` für Domain und `www`,
- Firewall-Regeln für 22/80/443,
- optional Admin-Zugang,
- optional TLS.

**Nicht-interaktiv** (z. B. für Automatisierung):

```bash
sudo DOMAIN=3d-mir.de \
  CERTBOT_EMAIL=admin@example.de \
  ADMIN_EMAIL=admin@3d-mir.de \
  ADMIN_NAME="Betreiber" \
  deploy/install.sh --non-interactive
```

Ohne `ADMIN_PASSWORD` wird bei nicht-interaktiver Ausführung kein Passwort gesetzt; den Admin dann später interaktiv anlegen (Abschnitt 3.8).

**TLS zunächst überspringen**, wenn DNS noch nicht umgestellt ist:

```bash
sudo DOMAIN=3d-mir.de SKIP_TLS=1 deploy/install.sh
```

**Bestehende Firewall nicht anfassen:**

```bash
sudo DOMAIN=3d-mir.de SKIP_FIREWALL=1 deploy/install.sh
```

**Anderer Port**, falls 3000 bereits belegt ist:

```bash
sudo DOMAIN=3d-mir.de PORT=3001 deploy/install.sh
```

Der NGINX-Vhost wird dann auf Port 3001 zeigen.

### 3.6 TLS einrichten (falls übersprungen)

Nach der DNS-Umstellung:

```bash
sudo certbot --nginx \
  -d 3d-mir.de \
  -d www.3d-mir.de \
  --redirect \
  --agree-tos \
  -m admin@example.de
```

Prüfen:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
curl -I https://3d-mir.de/
```

Der Dienst setzt HSTS automatisch, sobald die Anfrage über HTTPS läuft.

### 3.7 Installation prüfen

```bash
sudo deploy/verify.sh
```

Erwartet: **0 fehlgeschlagene Prüfungen**. Die TLS-Zeile darf vor der DNS-/TLS-Umstellung leer bleiben.

Weitere Prüfungen:

```bash
systemctl status 3d-mir.service --no-pager
journalctl -u 3d-mir.service -n 50 --no-pager
curl -fsS http://127.0.0.1/api/health
ss -ltnp '( sport = :3000 )'
```

### 3.8 Admin-Zugang anlegen

Falls der Installer keinen Admin angelegt hat:

```bash
cd /var/www/3d-mir.de
sudo -u mir3d npm run admin:create -- --email admin@3d-mir.de --name "Betreiber"
```

Das Passwort wird interaktiv abgefragt (mindestens 12 Zeichen) und nicht im Repository gespeichert.

Danach anmelden unter:

```
https://3d-mir.de/admin/
```

### 3.9 Nach der Installation konfigurieren

1. **Admin → Zahlungen**: Bankverbindung für Vorkasse eintragen.
2. **Stripe**: Konto anlegen, Zahlungsarten aktivieren, Schlüssel und Webhook hinterlegen (siehe `docs/ADMIN.md` und `docs/DEPLOYMENT.md`).
3. **SMTP**: Zugangsdaten in `/etc/3d-mir/3d-mir.env` eintragen und Dienst neu starten.
4. **GeoIP-Datenbank**: `sudo deploy/update-geoip.sh` ausführen (siehe unten). Ohne Datenbank kann die Länderprüfung im Kontaktformular nur über einen Proxy-Header arbeiten.
5. **Preise und Versand**: unter **Admin → Preise** prüfen und bestätigen.
6. **Produkte und Bilder**: unter **Admin → Produkte** pflegen.
7. **Rechtstexte**: Impressum, Datenschutz, AGB und Widerruf rechtlich prüfen lassen.
8. **Backup**: Cron einrichten (Abschnitt 8).

#### GeoIP-Datenbank für die Länderprüfung

Das Kontaktformular ermittelt das Land des Besuchers serverseitig aus der IP-Adresse. Dafür wird eine lokale Datenbank im MaxMind-Format benötigt. Der Befehl lädt die freie **DB-IP Lite**-Datenbank (Lizenz CC BY 4.0) und legt sie unter `/var/lib/3d-mir/geoip/dbip-country-lite.mmdb` ab:

```bash
sudo deploy/update-geoip.sh
```

Die Datenbank sollte monatlich aktualisiert werden, z. B. per Cron:

```cron
17 4 3 * * root /var/www/3d-mir.de/deploy/update-geoip.sh >/var/log/3d-mir/geoip-update.log 2>&1
```

Es werden keine IP-Adressen an Dritte übermittelt; die Auswertung erfolgt ausschließlich lokal. Ein anderer Pfad lässt sich über `GEOIP_DB_PATH` in `/etc/3d-mir/3d-mir.env` setzen.

### 3.10 Interaktives Setup-Menü

Für wiederkehrende Aufgaben gibt es ein geführtes Menü:

```bash
cd /var/www/3d-mir.de
sudo deploy/setup.sh
```

Alternativ:

```bash
sudo deploy/install.sh --menu
```

Das Menü bietet:

- Installation / Reparatur starten
- Voraussetzungen prüfen
- Systemcheck ausführen
- Mail-Setup (SMTP)
- Benachrichtigungen (Mail/Telegram) – Verweis auf den Admin-Bereich
- SSL/TLS einrichten oder erneuern
- Backup erstellen
- Backup wiederherstellen
- Update von GitHub installieren
- Admin-Zugang einrichten
- Dienste neu starten
- Logs anzeigen
- Konfiguration anzeigen
- Menü neu laden
- Port prüfen / freien Port setzen
- GeoIP-Datenbank aktualisieren
- Beenden

Nach jeder Aktion erscheint das Menü erneut. Mit „Menü neu laden“ wird die Ansicht frisch aufgebaut.

Wenn `whiptail` fehlt oder die Sitzung kein interaktives Terminal ist, erscheint automatisch ein numerisches Textmenü. Für die grafische Variante:

```bash
sudo apt-get install -y whiptail
```

---

## 4. Variante B – Vorhandener Server

Auf einem Server, auf dem bereits Websites, NGINX, Apache, Node.js oder Docker laufen, zuerst den Bestand erfassen. Nichts überschreiben, ohne vorher ein Backup zu haben.

### 4.1 Bestandsaufnahme

```bash
# Wer hört auf welchen Ports?
sudo ss -ltnp

# NGINX-Konfiguration und aktive Sites
sudo nginx -T
ls -la /etc/nginx/sites-enabled/

# Node-Version(en)
node -v
which node

# systemd-Dienste
systemctl list-units --type=service --state=running

# Speicherplatz
df -h
free -h
```

Wichtige Fragen:

- Ist Port **3000** frei? Wenn nicht: anderen Port wählen (`PORT=3001`).
- Läuft bereits **NGINX**? Dann kann der Vhost ergänzt werden.
- Läuft **Apache** auf 80/443? Dann ist eine Koexistenz mit dem NGINX-Installer nicht ohne Weiteres möglich (siehe 4.4).
- Läuft bereits eine **andere Node-Version**? Ein systemweites Upgrade auf Node 22 kann andere Anwendungen beeinflussen. Testen oder die Anwendung getrennt betreiben.
- Gibt es bereits eine Website mit derselben Domain? Dann ist ein Wartungsfenster und ein Backup nötig.
- Ist die Firewall manuell konfiguriert (z. B. `iptables`, Cloud-Firewall)? Dann `SKIP_FIREWALL=1` verwenden.

### 4.2 Eigene Pfade und Ports festlegen

Für die Koexistenz mit anderen Anwendungen können die Standardpfade überschrieben werden:

```bash
sudo APP_DIR=/var/www/3d-mir.de \
  DATA_DIR=/var/lib/3d-mir \
  LOG_DIR=/var/log/3d-mir \
  PORT=3001 \
  DOMAIN=3d-mir.de \
  deploy/install.sh
```

Der Dienstname bleibt `3d-mir.service`. Falls dieser Name bereits vergeben ist, muss die systemd-Unit manuell angepasst werden (siehe Abschnitt 6).

### 4.3 NGINX-Koexistenz

Der Installer legt an:

```
/etc/nginx/sites-available/3d-mir.de.conf
/etc/nginx/sites-enabled/3d-mir.de.conf
```

Andere Vhosts bleiben unverändert. Der Installer legt ausschließlich eine **eigene** Konfiguration an:

```text
/etc/nginx/sites-available/3d-mir.de.conf
/etc/nginx/sites-enabled/3d-mir.de.conf
```

Die NGINX-Default-Site wird **nicht** entfernt. Sie bleibt für andere Hostnamen/IP-Aufrufe zuständig; die 3D-MIR-Domain wird über den spezifischen `server_name` dieser eigenen Datei bedient. Vor Änderungen wird die bestehende NGINX-Konfiguration gesichert.

Vor dem Installer-Backup:

```bash
sudo cp -a /etc/nginx /root/backups/nginx-$(date +%F-%H%M%S)
```

Nach der Installation prüfen, ob alle bestehenden Sites weiterhin funktionieren:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://bestehende-domain.example/
```

### 4.4 Apache oder anderer Webserver

Der Installer geht von **NGINX** aus. Wenn auf dem Server bereits Apache läuft:

- **Option 1:** Apache stoppen/deaktivieren und NGINX als einzigen Webserver verwenden. Nur nach ausdrücklicher Prüfung der anderen Sites.
- **Option 2:** Manuelle Installation ohne NGINX (Abschnitt 6) und Apache als Reverse Proxy auf `127.0.0.1:3000` konfigurieren. Dafür muss der Apache-Vhost Proxy-Module (`mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_ssl`) laden. Die NGINX-Vorlage wird dann nicht verwendet.
- **Option 3:** Die Anwendung auf einem separaten Server betreiben.

### 4.5 Installation auf dem vorhandenen Server

```bash
cd /var/www/3d-mir.de
sudo DOMAIN=3d-mir.de \
  PORT=3001 \
  SKIP_FIREWALL=1 \
  SKIP_TLS=1 \
  deploy/install.sh
```

- `SKIP_FIREWALL=1`, wenn die Firewall bereits zentral verwaltet wird.
- `SKIP_TLS=1`, wenn DNS noch nicht auf den Server zeigt oder bestehende Zertifikate manuell verwaltet werden.
- `PORT=3001`, wenn 3000 belegt ist.

Prüfung bei abweichendem Port:

```bash
BASE_URL=http://127.0.0.1:3001 sudo deploy/verify.sh
```

Bei abweichenden Datenverzeichnissen die CLI-Befehle mit den passenden Pfaden ausführen, z. B.:

```bash
sudo -u mir3d env DATA_DIR=/pfad/zu/daten DB_PATH=/pfad/zu/daten/db/3d-mir.sqlite \
  npm run admin:create -- --email admin@3d-mir.de --name "Betreiber"
```

### 4.6 TLS auf einem vorhandenen Server

Wenn bereits Zertifikate für andere Domains existieren, ergänzt certbot das neue Zertifikat:

```bash
sudo certbot --nginx -d 3d-mir.de -d www.3d-mir.de --redirect -m admin@example.de --agree-tos
```

Nicht unnötig `--force-renewal` verwenden; Let's Encrypt hat Rate-Limits.

Prüfen, dass bestehende Zertifikate und Sites weiterhin funktionieren:

```bash
sudo certbot certificates
sudo nginx -t
sudo systemctl reload nginx
```

### 4.7 Rollback auf einem vorhandenen Server

Falls die neue Site Probleme verursacht:

```bash
# NGINX-Konfiguration zurückspielen
sudo cp -a /root/backups/nginx-YYYYMMDD-HHMMSS/sites-available/... /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx

# Dienst stoppen/deaktivieren
sudo systemctl disable --now 3d-mir.service
```

Die alten Daten und Konfigurationen bleiben erhalten, solange sie nicht gelöscht wurden.

---

## 5. Variante C – Alte WordPress-Seite ersetzen

Wenn die Domain bisher auf eine WordPress-Installation zeigt:

1. **TTL der DNS-Einträge reduzieren** (z. B. auf 300 Sekunden), mindestens 24 Stunden vor der Umstellung.
2. **Alte Website sichern:** Dateien, Datenbank, `wp-config.php`, Uploads.
3. **Neue Anwendung parallel installieren**, z. B. auf einer Subdomain `neu.3d-mir.de` oder auf einem anderen Port. Dort alle Funktionen testen.
4. **DNS erst umstellen**, wenn die neue Seite vollständig geprüft ist.
5. **TLS für die Hauptdomain** nach der DNS-Umstellung einrichten.
6. **Alte Seite nicht sofort löschen.** Nach der Umstellung einige Tage als Backup behalten.
7. **Weiterleitungen prüfen:** Die Anwendung leitet alte WordPress-Pfade (z. B. `/wp-admin/`, `/versandarten/`, `/produkt/*`) per 301 um.
8. **Stripe und E-Mail** auf die endgültige Domain umstellen:
   - `PAYMENT_BASE_URL=https://www.3d-mir.de`
   - Stripe-Webhook auf die endgültige URL
   - SMTP-Absender und `MAIL_FROM`
9. **Suchmaschinen:** Sitemap unter `/sitemap.xml`, `robots.txt` prüfen; alte Sitemap in der Search Console ersetzen.

---

## 6. Manuelle Installation (ohne Installer)

Diese Variante ist für Server gedacht, auf denen der Installer nicht passt, z. B. wegen Apache, einer anderen Verzeichnisstruktur oder einer eigenen Prozessverwaltung.

### 6.1 Benutzer und Verzeichnisse

```bash
sudo useradd --system --home-dir /var/lib/3d-mir --shell /usr/sbin/nologin mir3d
sudo install -d -m 0750 -o mir3d -g mir3d /var/lib/3d-mir /var/log/3d-mir
sudo install -d -m 0755 /var/www/3d-mir.de
```

### 6.2 Code und Abhängigkeiten

```bash
sudo git clone git@github.com:Super-AK/3d-mir.git /var/www/3d-mir.de
cd /var/www/3d-mir.de
sudo npm ci --no-audit --no-fund
sudo npm run build
sudo chown -R root:root public dist
```

### 6.3 Umgebungsvariablen

```bash
sudo install -d -m 0750 /etc/3d-mir
SECRET="$(openssl rand -base64 48 | tr -d '\n')"
sudo tee /etc/3d-mir/3d-mir.env >/dev/null <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/var/lib/3d-mir
LOG_DIR=/var/log/3d-mir
TRUST_PROXY=127.0.0.1
SESSION_SECRET=$SECRET
MAIL_FROM=3D-MIR <info@3d-mir.de>
MAIL_TO=info@3d-mir.de
MAX_UPLOAD_MB=50

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

STRIPE_MODE=test
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYMENT_BASE_URL=https://www.3d-mir.de

NOTIFICATION_CHANNEL=mail
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
sudo chmod 600 /etc/3d-mir/3d-mir.env
sudo chown root:root /etc/3d-mir/3d-mir.env
```

### 6.4 systemd-Dienst

```bash
sudo sed \
  -e "s|__APP_DIR__|/var/www/3d-mir.de|g" \
  -e "s|__SERVICE_USER__|mir3d|g" \
  -e "s|__DATA_DIR__|/var/lib/3d-mir|g" \
  -e "s|__LOG_DIR__|/var/log/3d-mir|g" \
  /var/www/3d-mir.de/deploy/3d-mir.service.tpl \
  | sudo tee /etc/systemd/system/3d-mir.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now 3d-mir.service
sudo systemctl status 3d-mir.service --no-pager
```

### 6.5 NGINX-Vhost

```bash
sudo sed \
  -e "s|__DOMAIN__|3d-mir.de|g" \
  -e "s|__APP_DIR__|/var/www/3d-mir.de|g" \
  -e "s|__PORT__|3000|g" \
  /var/www/3d-mir.de/deploy/nginx.conf.tpl \
  | sudo tee /etc/nginx/sites-available/3d-mir.de.conf >/dev/null

sudo ln -sfn /etc/nginx/sites-available/3d-mir.de.conf /etc/nginx/sites-enabled/3d-mir.de.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 6.6 TLS und Admin

```bash
sudo certbot --nginx -d 3d-mir.de -d www.3d-mir.de --redirect -m admin@example.de --agree-tos
cd /var/www/3d-mir.de
sudo -u mir3d npm run admin:create -- --email admin@3d-mir.de --name "Betreiber"
sudo deploy/verify.sh
```

---

## 7. Konfiguration

### 7.1 Umgebungsvariablen

Datei: `/etc/3d-mir/3d-mir.env`, Rechte `600`, Eigentümer `root`.

| Variable | Pflicht | Bedeutung |
| --- | --- | --- |
| `NODE_ENV` | ja | `production` |
| `HOST` | ja | `127.0.0.1` (nicht öffentlich) |
| `PORT` | ja | Standard `3000`, bei Konflikt z. B. `3001` |
| `DATA_DIR` | ja | `/var/lib/3d-mir` |
| `LOG_DIR` | ja | `/var/log/3d-mir` |
| `DB_PATH` | nein | Standard `$DATA_DIR/db/3d-mir.sqlite` |
| `UPLOAD_DIR` | nein | Standard `$DATA_DIR/uploads` |
| `SESSION_SECRET` | ja | mindestens 32 zufällige Zeichen, z. B. `openssl rand -base64 48` |
| `TRUST_PROXY` | ja | `127.0.0.1` bei lokalem NGINX; nur von hier werden `X-Forwarded-For` und Länder-Header akzeptiert |
| `GEOIP_DB_PATH` | nein | Standard `$DATA_DIR/geoip/dbip-country-lite.mmdb` |
| `COUNTRY_HEADER` | nein | optionaler CDN-Länderheader, z. B. `cf-ipcountry`; leer = Header werden ignoriert |
| `MAIL_FROM` | ja | Absender, z. B. `3D-MIR <info@3d-mir.de>` |
| `MAIL_TO` | ja | Betreiber-Postfach |
| `SMTP_HOST` | nein | leer = `.eml`-Fallback unter `$LOG_DIR/mail/` |
| `SMTP_PORT` | nein | Standard `587` |
| `SMTP_SECURE` | nein | `true` für Port 465, sonst `false` |
| `SMTP_USER` / `SMTP_PASS` | nein | SMTP-Zugang |
| `MAX_UPLOAD_MB` | nein | Standard `50` |
| `STRIPE_MODE` | nein | `test` oder `live` (Anzeige im Admin) |
| `STRIPE_SECRET_KEY` | für Stripe | `sk_test_…` bzw. `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | für Stripe | `whsec_…` |
| `PAYMENT_BASE_URL` | nein | öffentliche Basis-URL, Standard `site.baseUrl` |
| `NOTIFICATION_CHANNEL` | nein | `mail`, `telegram` oder `both` (Admin hat Vorrang) |
| `TELEGRAM_BOT_TOKEN` | nein | Telegram-Bot-Token (Admin hat Vorrang) |
| `TELEGRAM_CHAT_ID` | nein | Telegram-Chat-ID (Admin hat Vorrang) |

Nach Änderungen:

```bash
sudo systemctl restart 3d-mir.service
sudo deploy/verify.sh
```

### 7.2 Anwendungskonfiguration

| Datei | Inhalt |
| --- | --- |
| `config/site.json` | Domain, Geschäftsdaten, SEO, Rechtstext-Hinweise |
| `config/pricing.json` | Materialien, Drucker, Nachbearbeitung, Versand, Preise |
| `config/shop.json` | Zahlungsarten, Lieferländer, Checkout-Hinweise |

Die Dateien enthalten **keine Geheimnisse**. Änderungen im Admin werden in der SQLite-Datenbank (`settings`) gespeichert und überlagern die JSON-Standardwerte.

### 7.3 Admin-Einstellungen

Nach dem Login unter `/admin/`:

- **Zahlungen**: Bankverbindung, Zahlungsarten, Stripe-Status und Hilfe.
- **Preise**: Katalog, Versandkosten, Versandoptionen.
- **Produkte**: Produkte, Varianten, Bilder, Import/Export.
- **Bestellungen**: Zahlungs- und Bestellstatus, Zahlungseingang bestätigen.
- **Anfragen/Nachrichten**: Rechner- und Kontaktanfragen.

### 7.4 SMTP

Der E-Mail-Versand kann im Admin unter **Benachrichtigungen** eingerichtet werden. Alternativ über die Umgebungsvariablen:

```bash
sudo nano /etc/3d-mir/3d-mir.env
```

Beispiel:

```bash
SMTP_HOST=mail.example.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@3d-mir.de
SMTP_PASS=…
MAIL_FROM=3D-MIR <info@3d-mir.de>
MAIL_TO=info@3d-mir.de
```

Danach:

```bash
sudo systemctl restart 3d-mir.service
```

Ohne SMTP werden E-Mails als `.eml` unter `/var/log/3d-mir/mail/` abgelegt. Das ist für Tests brauchbar, aber kein Ersatz für den Livebetrieb.

### 7.5 Benachrichtigungen (E-Mail und Telegram)

Unter **Admin → Benachrichtigungen** wird der Kanal gewählt:

- **Nur E-Mail**
- **Nur Telegram**
- **E-Mail und Telegram**

Die Auswahl gilt nur für Benachrichtigungen an den Betreiber. Kunden-E-Mails gehen immer per E-Mail heraus.

**Telegram einrichten:**

1. Bei **@BotFather** einen Bot anlegen (`/newbot`).
2. Bot-Token kopieren.
3. Den Bot in Telegram anschreiben.
4. Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates` ermitteln (`chat.id`).
5. Bot-Token und Chat-ID im Admin eintragen.
6. **„Test-Telegram senden“** ausführen.

Bot-Token und SMTP-Passwort werden in der SQLite-Datenbank gespeichert und sind in Backups enthalten. Backups entsprechend schützen.

### 7.6 Stripe

1. Stripe-Konto anlegen und verifizieren.
2. Im Dashboard **Karte, PayPal, Amazon Pay, Klarna und iDEAL** aktivieren.
3. Webhook `https://www.3d-mir.de/zahlung/webhook/stripe/` anlegen.
4. Ereignisse abonnieren:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
5. Schlüssel in `/etc/3d-mir/3d-mir.env` eintragen.
6. Bankverbindung unter **Admin → Zahlungen** pflegen.
7. Im Testmodus mit Testkarte `4242 4242 4242 4242` prüfen.
8. Erst nach DNS/TLS auf Live-Schlüssel wechseln.

Details: `docs/ADMIN.md` und `docs/DEPLOYMENT.md`.

---

## 8. Backup, Update und Aufräumen

### 8.1 Backup

```bash
sudo deploy/backup.sh
```

Standardziel: `/var/lib/3d-mir/backups`, Aufbewahrung 14 Tage. Gesichert werden:

- SQLite-Datenbank (konsistent),
- Uploads,
- `config/*.json`,
- `/etc/3d-mir/3d-mir.env`,
- aktueller Git-Commit.

Täglicher Cron (root-Crontab):

```cron
15 3 * * * /var/www/3d-mir.de/deploy/backup.sh >/var/log/3d-mir/backup.log 2>&1
```

Externe Kopie (empfohlen): Backup zusätzlich per `rsync`/`rclone` auf einen anderen Server oder Storage Box ausleiten.

### 8.2 Update

```bash
sudo deploy/update.sh
```

Ablauf: Backup → optional Git-Pull → `npm ci` → Build → Neustart → Health-Check. Bei Fehlern wird automatisch auf den vorherigen Commit und Build zurückgerollt.

Nur neu bauen, ohne Git-Pull:

```bash
sudo deploy/update.sh --no-pull
```

### 8.3 Unbezahlte Bestellungen aufräumen

```bash
sudo -u mir3d npm run orders:cleanup -- --days 7
```

Storniert unbezahlte Bestellungen nach Ablauf der Frist und gibt reservierten Bestand frei.

Cron (root-Crontab):

```cron
45 3 * * * cd /var/www/3d-mir.de && sudo -u mir3d npm run orders:cleanup -- --days 7 >>/var/log/3d-mir/cleanup.log 2>&1
```

Bei abweichenden Datenverzeichnissen die Pfade explizit übergeben:

```bash
sudo -u mir3d env DATA_DIR=/pfad/zu/daten DB_PATH=/pfad/zu/daten/db/3d-mir.sqlite \
  npm run orders:cleanup -- --days 7
```

### 8.4 Wiederherstellung

```bash
sudo deploy/restore.sh /var/lib/3d-mir/backups/3d-mir-YYYYmmdd-HHMMSS.tar.gz
```

Das Skript sichert den aktuellen Zustand, stoppt den Dienst, prüft die Datenbank, spielt Datenbank, Uploads, Konfiguration und `.env` ein und startet den Dienst mit Health-Check.

---

## 9. Abnahme-Checkliste

### Server und Dienst

- [ ] `node -v` zeigt v22.x.x.
- [ ] `systemctl status 3d-mir.service` ist aktiv und ohne Fehler.
- [ ] `ss -ltnp '( sport = :3000 )'` zeigt nur den erwarteten Node-Prozess.
- [ ] Port 3000 ist von außen nicht erreichbar.
- [ ] `curl -fsS http://127.0.0.1/api/health` liefert `{"status":"ok"}`.

### Website

- [ ] `https://3d-mir.de/` lädt.
- [ ] `https://www.3d-mir.de/` lädt bzw. leitet korrekt weiter.
- [ ] `/shop/`, `/3d-druck-rechner/`, `/kontakt/`, `/zahlung/`, `/versand/` sind erreichbar.
- [ ] `/robots.txt` und `/sitemap.xml` liefern gültige Inhalte.
- [ ] Alte WordPress-URLs leiten per 301 um.
- [ ] TLS-Zertifikat ist gültig; `certbot renew --dry-run` erfolgreich.
- [ ] Sicherheits-Header sind gesetzt (`deploy/verify.sh`).

### Admin

- [ ] Admin-Login unter `/admin/` funktioniert.
- [ ] Passwort wurde geändert; keine Test-Admins vorhanden.
- [ ] Bankverbindung unter **Zahlungen** hinterlegt.
- [ ] Stripe-Status und Webhook geprüft.
- [ ] Preise, Versandkosten und Produkte stimmen.
- [ ] Produktbilder werden angezeigt.

### Bestellungen und Zahlungen

- [ ] Testbestellung per Vorkasse: Bankdaten auf Danke-Seite und in der E-Mail.
- [ ] „Zahlungseingang bestätigen“ setzt den Status korrekt.
- [ ] Stripe-Testzahlung mit Karte, PayPal, Amazon Pay, Klarna und iDEAL.
- [ ] Webhook bestätigt die Zahlung; doppelte Webhooks erzeugen keine Doppelbuchung.
- [ ] Fehlgeschlagene Zahlung lässt sich erneut starten.
- [ ] Bestellbestätigung und Zahlungsbestätigung kommen per E-Mail an.

### Betrieb

- [ ] `sudo deploy/verify.sh` meldet 0 Fehler.
- [ ] Backup erzeugt ein Archiv.
- [ ] Restore in einer Testumgebung erfolgreich getestet.
- [ ] Backup-Cron und Cleanup-Cron eingerichtet.
- [ ] Externe Backup-Kopie eingerichtet.
- [ ] Monitoring/Alerting für Dienst und HTTPS eingerichtet.
- [ ] Rechtstexte sind rechtlich geprüft.

---

## 10. Fehlersuche

| Problem | Ursache / Lösung |
| --- | --- |
| `EADDRINUSE` beim Start | Port 3000 belegt. `ss -ltnp '( sport = :3000 )'` prüfen, alten Prozess beenden. Der Dienst versucht es beim Start bis zu fünfmal. |
| `502 Bad Gateway` | Dienst nicht aktiv oder falscher Port im NGINX-Vhost. `systemctl status 3d-mir`, `journalctl -u 3d-mir`, Port in `/etc/nginx/sites-available/...` prüfen. |
| `npm ci` scheitert bei nativen Modulen | `sudo apt-get install -y build-essential python3` und erneut `npm ci`. |
| SQLite `SQLITE_CANTOPEN` / Rechtefehler | `/var/lib/3d-mir` muss `mir3d:mir3d` gehören und beschreibbar sein. |
| Bilder 404 | `public/` wurde nicht gebaut oder hat falsche Rechte. `npm run build`, Rechte prüfen. |
| TLS schlägt fehl | DNS zeigt noch nicht auf den Server, Port 80 blockiert oder Cloudflare-Proxy aktiv. `dig`, `curl -I http://3d-mir.de/.well-known/acme-challenge/...` prüfen. |
| Stripe-Methoden fehlen | `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` gesetzt? Dienst neu gestartet? Im Stripe-Dashboard aktiviert? |
| Stripe-Webhook 400 | Falsches `STRIPE_WEBHOOK_SECRET` oder Anfrage nicht von Stripe. Signatur und URL prüfen. |
| Zahlung bleibt „offen“ | Webhook nicht angekommen. Stripe-Dashboard → Webhook-Logs, `journalctl -u 3d-mir`, Betrag/Referenz prüfen. |
| E-Mails fehlen | SMTP nicht konfiguriert; `.eml` unter `/var/log/3d-mir/mail/` prüfen. |
| Admin-Login gesperrt | Rate-Limit abwarten oder Sitzungen in der Datenbank löschen. |
| `Permission denied` beim Dienststart | Rechte auf `/var/lib/3d-mir`, `/var/log/3d-mir` und `/etc/3d-mir/3d-mir.env` prüfen. |
| `nginx -t` fehlerhaft | Vhost prüfen, `certbot`-Änderungen prüfen, Backup aus `/root/backups` zurückspielen. |

---

## 11. Sicherheit

- SSH nur mit Schlüsseln, Passwort-Login deaktivieren.
- Root-Login nach Möglichkeit deaktivieren.
- Firewall: nur 22/80/443 öffentlich; 3000 bleibt lokal.
- `fail2ban` und `unattended-upgrades` einrichten.
- Secrets ausschließlich in `/etc/3d-mir/3d-mir.env` (chmod 600).
- Keine `.env`, keine Stripe-Schlüssel, keine IBAN im Repository.
- TLS erzwingen; HSTS wird von der Anwendung gesetzt.
- Admin-Passwörter mindestens 12 Zeichen; TOTP-2FA ist vorbereitet, aber noch nicht aktiviert.
- Backups verschlüsselt und extern aufbewahren.
- Stripe-Live-Schlüssel erst nach DNS/TLS und erfolgreichem Testmodus einsetzen.
- Regelmäßig `deploy/verify.sh` und die Logs prüfen.

---

## 12. Weiterführende Dokumentation

- `docs/DEPLOYMENT.md` – Betrieb, Update, Backup, TLS, Stripe
- `docs/ADMIN.md` – Admin-Bedienung, Preise, Produkte, Zahlungen
- `docs/OFFENE-FRAGEN.md` – fachliche und rechtliche Entscheidungen
- `docs/ABNAHME.md` – Abnahmeprotokoll
- `docs/REDIRECTS.md` – alte WordPress-URLs

---

## Anhang A – Nützliche Befehle

```bash
# Dienst
systemctl status 3d-mir.service --no-pager
journalctl -u 3d-mir.service -n 100 --no-pager
systemctl restart 3d-mir.service

# Ports
ss -ltnp
ss -ltnp '( sport = :3000 )'

# Health
curl -fsS http://127.0.0.1/api/health

# NGINX
nginx -t
systemctl reload nginx
nginx -T | less

# Datenbank
sqlite3 /var/lib/3d-mir/db/3d-mir.sqlite 'PRAGMA integrity_check;'
sqlite3 /var/lib/3d-mir/db/3d-mir.sqlite '.tables'

# Backups
ls -lh /var/lib/3d-mir/backups/
```

## Anhang B – Verzeichnisbaum nach der Installation

```
/var/www/3d-mir.de/
├── dist/                 Backend-Build
├── public/               Frontend-Build und Assets
├── src/                  Quellcode
├── web/                  Frontend-Quellen
├── config/               site.json, pricing.json, shop.json
├── deploy/               Installer, Update, Backup, Vorlagen
└── docs/                 Dokumentation

/var/lib/3d-mir/
├── db/3d-mir.sqlite
├── uploads/
└── backups/

/var/log/3d-mir/
├── app.log
└── mail/

/etc/3d-mir/3d-mir.env
/etc/systemd/system/3d-mir.service
/etc/nginx/sites-available/3d-mir.de.conf
```
