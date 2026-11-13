#!/usr/bin/env bash
# 3D-MIR – interaktives Setup- und Verwaltungsmenü.
#
# Aufruf:
#   sudo deploy/setup.sh
#   sudo deploy/install.sh --menu
#
# Das Menü bündelt Installation, Voraussetzungsprüfung, Systemcheck, Mail-Setup,
# TLS, Backup/Restore, Update, Admin-Zugang und Dienst-Neustart.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
LOG_DIR="${LOG_DIR:-/var/log/3d-mir}"
ENV_FILE="${ENV_FILE:-/etc/3d-mir/3d-mir.env}"
SERVICE="${SERVICE:-3d-mir.service}"
SERVICE_USER="${SERVICE_USER:-mir3d}"
DOMAIN="${DOMAIN:-3d-mir.de}"
PORT="${PORT:-3000}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/3d-mir.sqlite}"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen: sudo deploy/setup.sh"

has_whiptail() { [[ -t 0 && -t 1 ]] && command -v whiptail >/dev/null 2>&1; }

pause() {
  if has_whiptail; then
    whiptail --backtitle "3D-MIR Serververwaltung" --title "Weiter" --msgbox "Weiter mit OK." 8 50 || true
  else
    read -r -p "Weiter mit Enter …" _ || true
  fi
}

show_text() {
  local title="$1" file="$2"
  if has_whiptail; then
    whiptail --backtitle "3D-MIR Serververwaltung" --title "$title" --textbox "$file" 30 100 || true
  else
    printf '\n===== %s =====\n' "$title"
    cat "$file"
    pause
  fi
}

get_env() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

set_env() {
  local key="$1" value="$2"
  [[ "$value" != *$'\n'* ]] || die "Der Wert für $key darf keinen Zeilenumbruch enthalten."
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE fehlt."
  local tmp
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

require_app() {
  if [[ ! -f "$APP_DIR/package.json" ]]; then
    whiptail --title "Nicht installiert" --msgbox "Die Anwendung wurde unter $APP_DIR nicht gefunden.\n\nBitte zuerst „Installation / Reparatur starten“ ausführen." 12 70 2>/dev/null || true
    return 1
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    whiptail --title "Umgebung fehlt" --msgbox "$ENV_FILE fehlt.\n\nBitte zuerst die Installation ausführen." 10 70 2>/dev/null || true
    return 1
  fi
  return 0
}

ask() {
  # ask <variable> <frage> <default>
  local __var="$1" __question="$2" __default="${3:-}" __answer=""
  if has_whiptail; then
    __answer="$(whiptail --backtitle "3D-MIR Serververwaltung" --inputbox "$__question" 10 78 "$__default" 3>&1 1>&2 2>&3)" || return 1
  else
    read -r -p "$__question [$__default]: " __answer || return 1
    __answer="${__answer:-$__default}"
  fi
  printf -v "$__var" '%s' "$__answer"
}

ask_password() {
  # ask_password <variable> <frage>
  local __var="$1" __question="$2" __answer=""
  if has_whiptail; then
    __answer="$(whiptail --backtitle "3D-MIR Serververwaltung" --passwordbox "$__question" 10 78 3>&1 1>&2 2>&3)" || return 1
  else
    read -r -s -p "$__question: " __answer || return 1
    printf '\n'
  fi
  printf -v "$__var" '%s' "$__answer"
}

confirm() {
  if has_whiptail; then
    whiptail --backtitle "3D-MIR Serververwaltung" --title "Bestätigung" --yesno "$1" 10 78
  else
    local answer
    read -r -p "$1 [j/N]: " answer || true
    [[ "$answer" =~ ^[jJyY]$ ]]
  fi
}

# ---------------------------------------------------------------------------
# Aktionen
# ---------------------------------------------------------------------------

action_install() {
  log "Installation / Reparatur starten"
  if ! confirm "Jetzt die geführte Installation starten?\n\nBestehende Konfigurationen werden gesichert. Bei einer vorhandenen Installation werden NGINX-Vhost und Dienst aktualisiert."; then
    return 0
  fi
  "$SCRIPT_DIR/install.sh" || warn "Installation mit Fehler beendet. Bitte Ausgabe prüfen."
}

action_prerequisites() {
  local out
  out="$(mktemp)"
  local fail=0
  {
    echo "3D-MIR – Voraussetzungen"
    echo "========================"
    echo
    printf '%-34s' "Betriebssystem:"
    if [[ -f /etc/os-release ]]; then . /etc/os-release; echo "${PRETTY_NAME:-unbekannt}"; else echo "unbekannt"; fi
    printf '%-34s' "Root-Rechte:"
    [[ ${EUID} -eq 0 ]] && echo "ok" || { echo "FEHLT"; fail=1; }
    printf '%-34s' "systemd:"
    command -v systemctl >/dev/null && echo "ok" || { echo "FEHLT"; fail=1; }
    printf '%-34s' "NGINX:"
    command -v nginx >/dev/null && nginx -v 2>&1 || { echo "FEHLT"; fail=1; }
    printf '%-34s' "SQLite:"
    command -v sqlite3 >/dev/null && sqlite3 --version || { echo "FEHLT"; fail=1; }
    printf '%-34s' "Node.js (/usr/bin/node):"
    if [[ -x /usr/bin/node ]]; then /usr/bin/node -v; else echo "FEHLT"; fail=1; fi
    printf '%-34s' "npm:"
    command -v npm >/dev/null && npm -v || { echo "FEHLT"; fail=1; }
    printf '%-34s' "Git:"
    command -v git >/dev/null && git --version || { echo "FEHLT"; fail=1; }
    printf '%-34s' "certbot:"
    command -v certbot >/dev/null && certbot --version 2>&1 || echo "fehlt (TLS später möglich)"
    printf '%-34s' "Freier Speicher ($DATA_DIR):"
    df -h "$DATA_DIR" 2>/dev/null | tail -1 || echo "Verzeichnis fehlt"
    printf '%-34s' "Port 80/443:"
    if ss -ltn 2>/dev/null | grep -Eq ':(80|443)[[:space:]]'; then
      echo "belegt (NGINX oder anderer Webserver)"
    else
      echo "frei"
    fi
    printf '%-34s' "Port $PORT:"
    if ss -ltn 2>/dev/null | grep -Eq ":${PORT}[[:space:]]"; then
      echo "belegt"
    else
      echo "frei"
    fi
    echo
    if [[ "$fail" -eq 0 ]]; then
      echo "Ergebnis: Die wichtigsten Voraussetzungen sind erfüllt."
    else
      echo "Ergebnis: Es fehlen Voraussetzungen. Bitte die markierten Punkte installieren."
    fi
  } > "$out" 2>&1
  show_text "Voraussetzungen prüfen" "$out"
  rm -f "$out"
}

action_systemcheck() {
  require_app || return 0
  local out
  out="$(mktemp)"
  {
    echo "3D-MIR – Systemcheck"
    echo "===================="
    echo
    echo "--- Dienst ---"
    systemctl status "$SERVICE" --no-pager 2>&1 | sed -n '1,14p' || true
    echo
    echo "--- Health ---"
    curl -fsS "http://127.0.0.1/api/health" 2>&1 || echo "Health-Endpunkt nicht erreichbar."
    echo
    echo "--- Ports ---"
    ss -ltnp 2>/dev/null | sed -n '1,20p' || true
    echo
    echo "--- Speicher ---"
    df -h "$DATA_DIR" "$LOG_DIR" 2>/dev/null || true
    free -h 2>/dev/null || true
    echo
    echo "--- Datenbank ---"
    if [[ -f "$DB_PATH" ]]; then
      sqlite3 "$DB_PATH" 'PRAGMA integrity_check;' 2>&1 || true
    else
      echo "Datenbank fehlt: $DB_PATH"
    fi
    echo
    echo "--- TLS ---"
    certbot certificates 2>&1 | sed -n '1,40p' || true
    echo
    echo "--- Letzte Fehler im Journal ---"
    journalctl -u "$SERVICE" -p err -n 20 --no-pager 2>&1 || true
  } > "$out" 2>&1
  show_text "Systemcheck" "$out"
  rm -f "$out"
}

action_mail_setup() {
  require_app || return 0
  if sqlite3 "$DB_PATH" "SELECT 1 FROM settings WHERE key='notifications';" 2>/dev/null | grep -q 1; then
    warn "Im Admin sind bereits Benachrichtigungseinstellungen gespeichert. Diese haben Vorrang vor den Umgebungsvariablen."
    if ! confirm "Trotzdem die SMTP-Werte in $ENV_FILE ändern?"; then
      return 0
    fi
  fi

  local host port secure user pass from to
  host="$(get_env SMTP_HOST)"; host="${host:-}"
  port="$(get_env SMTP_PORT)"; port="${port:-587}"
  user="$(get_env SMTP_USER)"; user="${user:-}"
  from="$(get_env MAIL_FROM)"; from="${from:-3D-MIR <info@3d-mir.de>}"
  to="$(get_env MAIL_TO)"; to="${to:-info@3d-mir.de}"

  ask host "SMTP-Server (leer = .eml-Fallback):" "$host" || return 0
  ask port "SMTP-Port:" "$port" || return 0
  ask user "SMTP-Benutzername:" "$user" || return 0
  ask_password pass "SMTP-Passwort (leer = unverändert):" || return 0
  if [[ -z "$pass" ]]; then pass="$(get_env SMTP_PASS)"; fi
  ask from "Absender:" "$from" || return 0
  ask to "Betreiber-Postfach:" "$to" || return 0

  local secure_value="false"
  if confirm "SSL/TLS direkt ab Verbindungsaufbau verwenden (meist Port 465)?"; then
    secure_value="true"
  fi

  set_env SMTP_HOST "$host"
  set_env SMTP_PORT "$port"
  set_env SMTP_SECURE "$secure_value"
  set_env SMTP_USER "$user"
  set_env SMTP_PASS "$pass"
  set_env MAIL_FROM "$from"
  set_env MAIL_TO "$to"

  log "SMTP-Konfiguration gespeichert; Dienst wird neu gestartet"
  systemctl restart "$SERVICE" || warn "Dienst konnte nicht neu gestartet werden."
  sleep 1

  local out
  out="$(mktemp)"
  if (cd "$APP_DIR" && ENV_FILE="$ENV_FILE" DATA_DIR="$DATA_DIR" DB_PATH="$DB_PATH" npx tsx scripts/test-mail.ts) >"$out" 2>&1; then
    log "Test-E-Mail ausgelöst"
  else
    warn "Test-E-Mail fehlgeschlagen"
  fi
  show_text "Test-E-Mail" "$out"
  rm -f "$out"
}

action_ssl_setup() {
  local email domain
  email="$(get_env CERTBOT_EMAIL)"; email="${email:-}"
  domain="$DOMAIN"
  ask domain "Domain ohne www:" "$domain" || return 0
  ask email "E-Mail für Let's Encrypt:" "$email" || return 0
  [[ -n "$email" ]] || { warn "E-Mail fehlt."; return 0; }

  if ! confirm "Jetzt TLS für $domain und www.$domain einrichten/erneuern?"; then return 0; fi
  local out
  out="$(mktemp)"
  if certbot --nginx -d "$domain" -d "www.$domain" --redirect --agree-tos -m "$email" >"$out" 2>&1; then
    log "TLS eingerichtet"
    certbot renew --dry-run >>"$out" 2>&1 || true
  else
    warn "certbot ist fehlgeschlagen"
  fi
  show_text "TLS-Einrichtung" "$out"
  rm -f "$out"
}

action_backup() {
  require_app || return 0
  local out
  out="$(mktemp)"
  if "$APP_DIR/deploy/backup.sh" >"$out" 2>&1; then
    log "Backup erstellt"
  else
    warn "Backup fehlgeschlagen"
  fi
  show_text "Backup" "$out"
  rm -f "$out"
}

action_restore() {
  require_app || return 0
  local archive listing
  listing="$(mktemp)"
  {
    echo "Vorhandene Backups unter $DATA_DIR/backups:"
    echo
    ls -1t "$DATA_DIR/backups"/*.tar.gz 2>/dev/null | head -20 || true
  } > "$listing"
  show_text "Backups" "$listing"
  rm -f "$listing"
  ask archive "Pfad zum Backup-Archiv:" "" || return 0
  [[ -f "$archive" ]] || { warn "Archiv nicht gefunden: $archive"; return 0; }
  if ! confirm "Backup wirklich zurückspielen?\n\n$archive\n\nDer aktuelle Zustand wird vorher gesichert."; then return 0; fi
  local out
  out="$(mktemp)"
  if "$APP_DIR/deploy/restore.sh" "$archive" >"$out" 2>&1; then
    log "Wiederherstellung abgeschlossen"
  else
    warn "Wiederherstellung fehlgeschlagen"
  fi
  show_text "Wiederherstellung" "$out"
  rm -f "$out"
}

action_update() {
  require_app || return 0
  local pull=1
  if ! confirm "Update starten?\n\nEs wird zuerst ein Backup erstellt, dann werden die GitHub-Daten geholt, gebaut und der Dienst neu gestartet."; then
    return 0
  fi
  if ! confirm "Aktuelle Änderungen von GitHub holen?"; then
    pull=0
  fi

  local args=()
  [[ "$pull" -eq 0 ]] && args+=(--no-pull)
  local out
  out="$(mktemp)"
  if "$APP_DIR/deploy/update.sh" "${args[@]}" >"$out" 2>&1; then
    log "Update erfolgreich"
  else
    warn "Update fehlgeschlagen – bitte Ausgabe und Logs prüfen"
  fi
  show_text "Update" "$out"
  rm -f "$out"
}

action_admin_setup() {
  require_app || return 0
  local email name
  ask email "E-Mail-Adresse des Admin-Zugangs:" "" || return 0
  ask name "Name des Betreibers:" "Betreiber" || return 0
  [[ -n "$email" ]] || { warn "E-Mail fehlt."; return 0; }

  log "Admin-Zugang einrichten (Passwort wird interaktiv abgefragt)"
  if (cd "$APP_DIR" && sudo -u "$SERVICE_USER" -H env DATA_DIR="$DATA_DIR" DB_PATH="$DB_PATH" \
      npm run admin:create -- --email "$email" --name "$name"); then
    log "Admin-Zugang eingerichtet"
  else
    warn "Admin-Zugang konnte nicht eingerichtet werden"
  fi
}

action_restart_services() {
  log "Dienste neu starten"
  local out
  out="$(mktemp)"
  {
    systemctl restart "$SERVICE" 2>&1 || true
    nginx -t 2>&1 || true
    systemctl reload nginx 2>&1 || true
    sleep 1
    systemctl status "$SERVICE" --no-pager 2>&1 | sed -n '1,12p' || true
    echo
    curl -fsS http://127.0.0.1/api/health 2>&1 || echo "Health-Endpunkt nicht erreichbar."
  } > "$out"
  show_text "Dienste" "$out"
  rm -f "$out"
}

action_logs() {
  require_app || return 0
  local out
  out="$(mktemp)"
  journalctl -u "$SERVICE" -n 200 --no-pager > "$out" 2>&1 || true
  show_text "Logs: $SERVICE" "$out"
  rm -f "$out"
}

action_config() {
  local out
  out="$(mktemp)"
  {
    echo "3D-MIR – Konfiguration"
    echo "======================"
    echo "APP_DIR:    $APP_DIR"
    echo "DATA_DIR:   $DATA_DIR"
    echo "LOG_DIR:    $LOG_DIR"
    echo "ENV_FILE:   $ENV_FILE"
    echo "DB_PATH:    $DB_PATH"
    echo "DOMAIN:     $DOMAIN"
    echo "PORT:       $PORT"
    echo
    echo "Umgebungsvariablen (Geheimnisse maskiert):"
    if [[ -f "$ENV_FILE" ]]; then
      sed -E 's/^(SESSION_SECRET|SMTP_PASS|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|TELEGRAM_BOT_TOKEN)=(.+)$/\1=<gesetzt>/' "$ENV_FILE"
    else
      echo "$ENV_FILE fehlt."
    fi
  } > "$out"
  show_text "Konfiguration" "$out"
  rm -f "$out"
}

action_notification_help() {
  local out
  out="$(mktemp)"
  {
    echo "Benachrichtigungen"
    echo "=================="
    echo
    echo "Mail- und Telegram-Einstellungen werden im Admin-Bereich gepflegt:"
    echo
    echo "  https://$DOMAIN/admin/benachrichtigungen/"
    echo
    echo "Dort können Sie wählen:"
    echo "  - Nur E-Mail"
    echo "  - Nur Telegram"
    echo "  - E-Mail und Telegram"
    echo
    echo "Für Telegram:"
    echo "  1. Bot bei @BotFather anlegen"
    echo "  2. Bot anschreiben"
    echo "  3. Chat-ID über die Bot-API ermitteln"
    echo "  4. Bot-Token und Chat-ID im Admin eintragen"
    echo
    echo "Die SMTP-Einrichtung kann alternativ über „Mail-Setup (SMTP)“"
    echo "in diesem Menü erfolgen. Admin-Einstellungen haben Vorrang."
  } > "$out"
  show_text "Benachrichtigungen" "$out"
  rm -f "$out"
}

# ---------------------------------------------------------------------------
# Menü
# ---------------------------------------------------------------------------

main_menu() {
  if has_whiptail; then
    whiptail --backtitle "3D-MIR Serververwaltung" \
      --title "3D-MIR Setup" \
      --menu "Bitte eine Aktion wählen:" 26 96 15 \
      1 "Installation / Reparatur starten" \
      2 "Voraussetzungen prüfen" \
      3 "Systemcheck ausführen" \
      4 "Mail-Setup (SMTP)" \
      5 "Benachrichtigungen (Mail/Telegram)" \
      6 "SSL/TLS einrichten oder erneuern" \
      7 "Backup erstellen" \
      8 "Backup wiederherstellen" \
      9 "Update von GitHub installieren" \
      10 "Admin-Zugang einrichten" \
      11 "Dienste neu starten" \
      12 "Logs anzeigen" \
      13 "Konfiguration anzeigen" \
      14 "Menü neu laden" \
      15 "Beenden" \
      3>&1 1>&2 2>&3
    return
  fi

  cat >&2 <<'EOF'
3D-MIR Setup
============
 1) Installation / Reparatur starten
 2) Voraussetzungen prüfen
 3) Systemcheck ausführen
 4) Mail-Setup (SMTP)
 5) Benachrichtigungen (Mail/Telegram)
 6) SSL/TLS einrichten oder erneuern
 7) Backup erstellen
 8) Backup wiederherstellen
 9) Update von GitHub installieren
10) Admin-Zugang einrichten
11) Dienste neu starten
12) Logs anzeigen
13) Konfiguration anzeigen
14) Menü neu laden
15) Beenden
EOF
  local choice
  read -r -p "Auswahl: " choice || return 1
  # Nur die Auswahl auf stdout; der Menütext geht nach stderr, damit er bei
  # `choice="$(main_menu)"` nicht in der Variablen landet.
  echo "$choice"
}

# Nicht-interaktive Einzelaktion (für Tests/Automatisierung):
#   SETUP_ACTION=prerequisites sudo -E deploy/setup.sh
if [[ -n "${SETUP_ACTION:-}" ]]; then
  case "$SETUP_ACTION" in
    prerequisites) action_prerequisites ;;
    systemcheck) action_systemcheck ;;
    mail) action_mail_setup ;;
    ssl) action_ssl_setup ;;
    backup) action_backup ;;
    restore) action_restore ;;
    update) action_update ;;
    admin) action_admin_setup ;;
    restart) action_restart_services ;;
    logs) action_logs ;;
    config) action_config ;;
    notifications) action_notification_help ;;
    *) die "Unbekannte SETUP_ACTION: $SETUP_ACTION" ;;
  esac
  exit 0
fi

while true; do
  if ! choice="$(main_menu)"; then
    exit 0
  fi

  case "$choice" in
    1) action_install ;;
    2) action_prerequisites ;;
    3) action_systemcheck ;;
    4) action_mail_setup ;;
    5) action_notification_help ;;
    6) action_ssl_setup ;;
    7) action_backup ;;
    8) action_restore ;;
    9) action_update ;;
    10) action_admin_setup ;;
    11) action_restart_services ;;
    12) action_logs ;;
    13) action_config ;;
    14) clear ;;
    15) exit 0 ;;
    *) warn "Unbekannte Auswahl: $choice" ;;
  esac

  pause
done
