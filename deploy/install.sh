#!/usr/bin/env bash
# 3D-MIR – geführte Installation auf Ubuntu 24.04/26.04 (idempotent).
#
# Aufruf:
#   sudo deploy/install.sh
#   sudo deploy/install.sh --menu
#   sudo DOMAIN=3d-mir.de CERTBOT_EMAIL=admin@example.de deploy/install.sh --non-interactive
#
# Das Skript richtet ein: Systempakete, Dienstbenutzer, Verzeichnisse, .env,
# Node-Abhängigkeiten, Build, systemd-Dienst, NGINX-Vhost, UFW und optional TLS.
# Vorhandene Konfigurationen werden gesichert und nicht ohne Backup überschrieben.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

DOMAIN="${DOMAIN:-3d-mir.de}"
APP_DIR="${APP_DIR:-/var/www/3d-mir.de}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
LOG_DIR="${LOG_DIR:-/var/log/3d-mir}"
REQUESTED_PORT="${PORT:-}"
PORT="${PORT:-3000}"
SERVICE="3d-mir.service"
SERVICE_USER="${SERVICE_USER:-mir3d}"
ENV_DIR="/etc/3d-mir"
ENV_FILE="$ENV_DIR/3d-mir.env"
BACKUP_DIR="/root/backups"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_NAME="${ADMIN_NAME:-Betreiber}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
NON_INTERACTIVE=0
SKIP_TLS="${SKIP_TLS:-0}"
SKIP_FIREWALL="${SKIP_FIREWALL:-0}"

for arg in "$@"; do
  case "$arg" in
    --non-interactive) NON_INTERACTIVE=1 ;;
    --menu) exec "$SCRIPT_DIR/setup.sh" ;;
    --skip-tls) SKIP_TLS=1 ;;
    --skip-firewall) SKIP_FIREWALL=1 ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

set_env_value() {
  local key="$1" value="$2" tmp
  [[ "$value" != *$'\n'* ]] || die "Der Wert für $key darf keinen Zeilenumbruch enthalten."
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE fehlt."
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$tmp"
  install -m 600 -o root -g root "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}

port_in_use() {
  ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .
}

port_owned_by_service() {
  local pid
  pid="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ && "$pid" -gt 0 ]] || return 1
  ss -ltnpH "( sport = :$1 )" 2>/dev/null | grep -q "pid=$pid,"
}

find_free_port() {
  local start="${1:-3000}" end="${2:-3099}" p
  for p in $(seq "$start" "$end"); do
    if ! port_in_use "$p"; then
      printf '%s' "$p"
      return 0
    fi
  done
  return 1
}

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen."
command -v apt-get >/dev/null || die "Dieses Skript unterstützt nur Debian/Ubuntu."

has_tty() { [[ -t 0 && -t 1 ]] && command -v whiptail >/dev/null; }

ask() {
  # ask <variable> <frage> <default>
  local __var="$1" __question="$2" __default="${3:-}" __answer=""
  if [[ $NON_INTERACTIVE -eq 1 ]]; then
    printf -v "$__var" '%s' "$__default"
    return
  fi
  if has_tty; then
    __answer=$(whiptail --inputbox "$__question" 10 70 "$__default" 3>&1 1>&2 2>&3) || die "Abgebrochen."
  else
    read -r -p "$__question [$__default]: " __answer || true
    __answer="${__answer:-$__default}"
  fi
  printf -v "$__var" '%s' "$__answer"
}

confirm() {
  # confirm <frage>
  [[ $NON_INTERACTIVE -eq 1 ]] && return 0
  if has_tty; then
    whiptail --yesno "$1" 10 70
  else
    local answer
    read -r -p "$1 [j/N]: " answer || true
    [[ "$answer" =~ ^[jJyY]$ ]]
  fi
}

log "Systempakete installieren"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx sqlite3 curl ca-certificates openssl ufw rsync certbot python3-certbot-nginx whiptail iproute2

NODE_BIN=/usr/bin/node
NODE_MAJOR=0
if [[ -x "$NODE_BIN" ]]; then
  NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
fi
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  log "Node.js 22 wird über NodeSource installiert (gefunden: ${NODE_MAJOR:-keins})"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]')"
fi
[[ "$NODE_MAJOR" -ge 22 ]] || die "Node.js 22 konnte nicht installiert werden. Bitte manuell unter /usr/bin/node installieren und erneut ausführen."

if [[ $NON_INTERACTIVE -eq 0 ]]; then
  ask DOMAIN "Domain ohne www (z. B. 3d-mir.de):" "$DOMAIN"
  ask CERTBOT_EMAIL "E-Mail für Let's-Encrypt (leer = TLS später):" "$CERTBOT_EMAIL"
  if [[ -z "$ADMIN_EMAIL" ]]; then
    ask ADMIN_EMAIL "E-Mail für den Admin-Zugang (leer = später per CLI):" ""
  fi
  ask ADMIN_NAME "Name des Betreibers:" "$ADMIN_NAME"
fi

log "Dienstbenutzer und Verzeichnisse"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$DATA_DIR" "$LOG_DIR"
install -d -m 0755 "$APP_DIR"
install -d -m 0750 -o root -g root "$ENV_DIR"
install -d -m 0700 "$BACKUP_DIR"

log "Anwendung nach $APP_DIR kopieren"
if [[ "$SOURCE_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete \
    --exclude '.git/' --exclude 'node_modules/' --exclude 'public/' --exclude 'dist/' \
    --exclude '.env' --exclude '.env.*' --exclude 'test-results/' --exclude 'playwright-report/' \
    "$SOURCE_DIR"/ "$APP_DIR"/
fi

log "Port prüfen"
if [[ -f "$ENV_FILE" ]]; then
  existing_port="$(env_value PORT)"
  if [[ -z "$REQUESTED_PORT" && -n "$existing_port" ]]; then
    PORT="$existing_port"
  fi
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  die "Ungültiger Port: $PORT. Bitte einen Wert zwischen 1024 und 65535 angeben."
fi

if port_in_use "$PORT"; then
  if port_owned_by_service "$PORT"; then
    log "Port $PORT wird bereits von $SERVICE genutzt und beibehalten."
  elif [[ -n "$REQUESTED_PORT" ]]; then
    suggestion="$(find_free_port 3000 3099 || true)"
    die "Port $PORT ist belegt.${suggestion:+ Freier Vorschlag: $suggestion.} Bitte mit PORT=${suggestion:-<frei>} erneut ausführen."
  else
    suggestion="$(find_free_port 3000 3099 || true)"
    [[ -n "$suggestion" ]] || die "Kein freier Port im Bereich 3000–3099 gefunden. Bitte PORT=<frei> setzen."
    warn "Port $PORT ist belegt; verwende den freien Port $suggestion."
    PORT="$suggestion"
  fi
fi
log "Anwendungsport: $PORT"

log "Umgebungsvariablen"
if [[ -f "$ENV_FILE" ]]; then
  warn "$ENV_FILE existiert bereits und bleibt erhalten; nur PORT wird bei Bedarf angepasst."
else
  secret="$(openssl rand -base64 48 | tr -d '\n')"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
DATA_DIR=$DATA_DIR
LOG_DIR=$LOG_DIR
TRUST_PROXY=127.0.0.1
SESSION_SECRET=$secret
MAIL_FROM=3D-MIR <info@3d-mir.de>
MAIL_TO=info@3d-mir.de
MAX_UPLOAD_MB=50

# SMTP (leer = E-Mails werden als .eml unter $LOG_DIR/mail/ abgelegt)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# Stripe (leer = Karte, PayPal, Amazon Pay, Klarna und iDEAL werden nicht angeboten)
STRIPE_MODE=test
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYMENT_BASE_URL=

# Admin-Benachrichtigungen (können auch im Admin gepflegt werden)
NOTIFICATION_CHANNEL=mail
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
  chmod 0600 "$ENV_FILE"
  chown root:root "$ENV_FILE"
  log "Neue $ENV_FILE angelegt (SESSION_SECRET zufällig erzeugt)."
fi
set_env_value PORT "$PORT"

log "Abhängigkeiten installieren und bauen"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
chown -R root:root "$APP_DIR/public" "$APP_DIR/dist" 2>/dev/null || true
find "$APP_DIR/public" "$APP_DIR/dist" -type d -exec chmod 0755 {} +

log "systemd-Dienst"
sed -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__SERVICE_USER__|$SERVICE_USER|g" \
    -e "s|__DATA_DIR__|$DATA_DIR|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    "$APP_DIR/deploy/3d-mir.service.tpl" > /etc/systemd/system/3d-mir.service
systemctl daemon-reload
systemctl enable 3d-mir.service >/dev/null
systemctl restart 3d-mir.service

log "NGINX-Vhost"
NGINX_SITE_NAME="${NGINX_SITE_NAME:-${DOMAIN}.conf}"
NGINX_SITE="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
log "Eigene NGINX-Konfiguration: $NGINX_SITE"
if [[ -f "$NGINX_SITE" ]]; then
  backup="$BACKUP_DIR/nginx-${DOMAIN}-$(date +%Y%m%d-%H%M%S).conf"
  cp -a "$NGINX_SITE" "$backup"
  log "Bestehende NGINX-Konfiguration gesichert: $backup"
fi
sed -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__PORT__|$PORT|g" \
    "$APP_DIR/deploy/nginx.conf.tpl" > "$NGINX_SITE"
ln -sfn "$NGINX_SITE" "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  warn "Die NGINX-Default-Site bleibt aktiv. 3D-MIR nutzt eine eigene Konfiguration: $NGINX_SITE"
fi
nginx -t
systemctl reload nginx

log "Firewall"
if [[ "$SKIP_FIREWALL" != "1" ]]; then
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ufw status | sed -n '1,12p'
else
  warn "Firewall-Konfiguration übersprungen (SKIP_FIREWALL=1)."
fi

log "Admin-Zugang"
if [[ -n "$ADMIN_EMAIL" ]]; then
  if [[ -n "$ADMIN_PASSWORD" ]]; then
    sudo -u "$SERVICE_USER" -H env DATA_DIR="$DATA_DIR" DB_PATH="$DATA_DIR/db/3d-mir.sqlite" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
      npm run admin:create -- --email "$ADMIN_EMAIL" --name "$ADMIN_NAME"
  elif [[ -t 0 ]]; then
    sudo -u "$SERVICE_USER" -H env DATA_DIR="$DATA_DIR" DB_PATH="$DATA_DIR/db/3d-mir.sqlite" \
      npm run admin:create -- --email "$ADMIN_EMAIL" --name "$ADMIN_NAME"
  else
    warn "Kein Terminal für die Passworteingabe. Bitte später ausführen:"
    echo "  sudo -u $SERVICE_USER env DATA_DIR=$DATA_DIR DB_PATH=$DATA_DIR/db/3d-mir.sqlite npm run admin:create -- --email $ADMIN_EMAIL --name \"$ADMIN_NAME\""
  fi
else
  warn "Kein Admin angelegt. Später: sudo -u $SERVICE_USER env DATA_DIR=$DATA_DIR DB_PATH=$DATA_DIR/db/3d-mir.sqlite npm run admin:create -- --email … --name …"
fi

log "TLS (Let's Encrypt)"
if [[ "$SKIP_TLS" == "1" || -z "$CERTBOT_EMAIL" ]]; then
  warn "TLS übersprungen. Nach DNS-Umstellung: certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect -m $CERTBOT_EMAIL"
else
  if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --agree-tos --non-interactive -m "$CERTBOT_EMAIL"; then
    log "TLS-Zertifikat eingerichtet (Erneuerung über systemd-Timer)."
  else
    warn "certbot fehlgeschlagen. Zeigt DNS bereits auf diesen Server? Später erneut ausführen."
  fi
fi

log "Health-Check"
ok=0
for _ in $(seq 1 20); do
  if curl -fsS -H "Host: $DOMAIN" "http://127.0.0.1/api/health" >/tmp/3d-mir-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" == "1" ]]; then
  cat /tmp/3d-mir-health.json
  rm -f /tmp/3d-mir-health.json
  log "Installation abgeschlossen: http://$DOMAIN/"
else
  journalctl -u 3d-mir.service -n 30 --no-pager || true
  die "Health-Check fehlgeschlagen. Bitte Logs prüfen: journalctl -u 3d-mir.service"
fi
