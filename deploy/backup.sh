#!/usr/bin/env bash
# 3D-MIR – Backup von Datenbank, Uploads, Konfiguration und Umgebungsdatei.
#
# Aufruf:
#   sudo deploy/backup.sh [Zielverzeichnis]
#
# Standardziel: /var/lib/3d-mir/backups
# Aufbewahrung: BACKUP_KEEP_DAYS Tage (Standard 14).
# Die Archivdatei ist nur für root lesbar, weil sie die .env mit Geheimnissen enthält.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
LOG_DIR="${LOG_DIR:-/var/log/3d-mir}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/3d-mir.sqlite}"
UPLOAD_DIR="${UPLOAD_DIR:-$DATA_DIR/uploads}"
ENV_FILE="${ENV_FILE:-/etc/3d-mir/3d-mir.env}"
SERVICE_USER="${SERVICE_USER:-mir3d}"
BACKUP_ROOT="${1:-${BACKUP_ROOT:-$DATA_DIR/backups}}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen (die .env ist nur für root lesbar)."

stamp="$(date +%Y%m%d-%H%M%S)"
name="3d-mir-$stamp"
work="$(mktemp -d /tmp/3d-mir-backup.XXXXXX)"
chmod 0755 "$work"
trap 'rm -rf "$work"' EXIT
mkdir -p "$BACKUP_ROOT"
chmod 0700 "$BACKUP_ROOT"

log "Datenbank sichern (WAL-konsistent)"
if [[ -f "$DB_PATH" ]]; then
  if command -v sudo >/dev/null && id "$SERVICE_USER" >/dev/null 2>&1; then
    install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_USER" "$work/db"
    sudo -u "$SERVICE_USER" sqlite3 "$DB_PATH" ".backup '$work/db/3d-mir.sqlite'"
  else
    mkdir -p "$work/db"
    sqlite3 "$DB_PATH" ".backup '$work/db/3d-mir.sqlite'"
  fi
  sqlite3 "$work/db/3d-mir.sqlite" 'PRAGMA integrity_check;' | grep -qx ok \
    || die "Integritätsprüfung der Sicherung fehlgeschlagen."
else
  warn "Datenbank nicht gefunden: $DB_PATH (wird übersprungen)."
fi

log "Uploads sichern"
if [[ -d "$UPLOAD_DIR" ]]; then
  mkdir -p "$work/uploads"
  rsync -a "$UPLOAD_DIR"/ "$work/uploads"/
else
  warn "Upload-Verzeichnis nicht gefunden: $UPLOAD_DIR (wird übersprungen)."
fi

log "Konfiguration sichern"
mkdir -p "$work/config"
for file in "$APP_DIR"/config/*.json; do
  [[ -f "$file" ]] && cp -a "$file" "$work/config/"
done
if [[ -f "$ENV_FILE" ]]; then
  cp -a "$ENV_FILE" "$work/3d-mir.env"
fi
if git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$APP_DIR" rev-parse HEAD > "$work/git-commit.txt"
fi
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$work/created-at.txt"

archive="$BACKUP_ROOT/$name.tar.gz"
log "Archiv erzeugen: $archive"
tar -C "$work" -czf "$archive" .
chmod 0600 "$archive"
tar -tzf "$archive" >/dev/null || die "Archiv ist nicht lesbar."

log "Alte Sicherungen aufräumen (älter als $BACKUP_KEEP_DAYS Tage)"
find "$BACKUP_ROOT" -maxdepth 1 -name '3d-mir-*.tar.gz' -type f -mtime +"$BACKUP_KEEP_DAYS" -delete

bytes="$(stat -c '%s' "$archive")"
log "Backup abgeschlossen: $archive ($((bytes / 1024)) KiB)"
