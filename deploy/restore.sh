#!/usr/bin/env bash
# 3D-MIR – Sicherung zurückspielen.
#
# Aufruf:
#   sudo deploy/restore.sh /var/lib/3d-mir/backups/3d-mir-YYYYmmdd-HHMMSS.tar.gz
#
# Achtung: Datenbank, Uploads, config/*.json und /etc/3d-mir/3d-mir.env werden
# durch den Stand aus der Sicherung ersetzt. Vorher wird automatisch ein Backup
# des aktuellen Zustands erstellt.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/3d-mir.sqlite}"
UPLOAD_DIR="${UPLOAD_DIR:-$DATA_DIR/uploads}"
ENV_FILE="${ENV_FILE:-/etc/3d-mir/3d-mir.env}"
SERVICE_USER="${SERVICE_USER:-mir3d}"
SERVICE="3d-mir.service"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen."
archive="${1:-}"
[[ -n "$archive" && -f "$archive" ]] || die "Aufruf: sudo deploy/restore.sh <backup.tar.gz>"

if [[ -t 0 ]]; then
  read -r -p "Sicherung $archive wirklich einspielen? Aktueller Stand wird vorher gesichert. [j/N] " answer
  [[ "$answer" =~ ^[jJyY]$ ]] || die "Abgebrochen."
fi

work="$(mktemp -d /tmp/3d-mir-restore.XXXXXX)"
trap 'rm -rf "$work"' EXIT
tar -xzf "$archive" -C "$work"
[[ -f "$work/db/3d-mir.sqlite" ]] || die "Sicherung enthält keine Datenbank."

sqlite3 "$work/db/3d-mir.sqlite" 'PRAGMA integrity_check;' | grep -qx ok \
  || die "Die Datenbank in der Sicherung ist beschädigt."

log "Aktuellen Stand sichern"
"$APP_DIR/deploy/backup.sh" || die "Sicherung des aktuellen Stands fehlgeschlagen – Abbruch."

log "Dienst stoppen"
systemctl stop "$SERVICE"

log "Datenbank wiederherstellen"
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$(dirname "$DB_PATH")"
rm -f "$DB_PATH-wal" "$DB_PATH-shm"
install -m 0640 -o "$SERVICE_USER" -g "$SERVICE_USER" "$work/db/3d-mir.sqlite" "$DB_PATH"

if [[ -d "$work/uploads" ]]; then
  log "Uploads wiederherstellen"
  install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$UPLOAD_DIR"
  rsync -a --delete "$work/uploads"/ "$UPLOAD_DIR"/
  chown -R "$SERVICE_USER:$SERVICE_USER" "$UPLOAD_DIR"
fi

if [[ -d "$work/config" ]]; then
  log "Konfiguration wiederherstellen"
  cp -a "$work/config"/*.json "$APP_DIR/config"/
  chown -R root:root "$APP_DIR/config"
fi

if [[ -f "$work/3d-mir.env" ]]; then
  log "Umgebungsdatei wiederherstellen"
  install -m 0600 -o root -g root "$work/3d-mir.env" "$ENV_FILE"
fi

log "Dienst starten und Health-Check"
systemctl start "$SERVICE"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    log "Wiederherstellung abgeschlossen."
    exit 0
  fi
  sleep 1
done
journalctl -u "$SERVICE" -n 40 --no-pager || true
die "Health-Check fehlgeschlagen. Bitte Logs prüfen."
