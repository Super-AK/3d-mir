#!/usr/bin/env bash
# 3D-MIR – Update mit Backup und Rollback.
#
# Aufruf:
#   sudo deploy/update.sh
#   sudo deploy/update.sh --no-pull     # nur neu bauen, kein Git-Pull
#
# Ablauf: Backup → optional Git-Pull → npm ci → Build → Neustart → Health-Check.
# Schlägt Build oder Neustart fehl, werden Code (Git-Commit) und Build-Artefakte
# auf den vorherigen Stand zurückgesetzt.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
SERVICE="3d-mir.service"
ENV_FILE="${ENV_FILE:-/etc/3d-mir/3d-mir.env}"
# Direkt gegen den Anwendungsport prüfen: Auf Shared Servern zeigt der
# NGINX-Default-Vhost sonst auf eine andere Anwendung.
APP_PORT="${PORT:-}"
if [[ -z "$APP_PORT" && -f "$ENV_FILE" ]]; then
  APP_PORT="$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
fi
APP_PORT="${APP_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
DO_PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen."
cd "$APP_DIR"
[[ -f package.json ]] || die "package.json nicht gefunden in $APP_DIR."

health() {
  local i
  for i in $(seq 1 20); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

log "Backup vor dem Update"
"$APP_DIR/deploy/backup.sh"

PREV_COMMIT=""
if git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  PREV_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
fi
PREV_BUILD="$(mktemp -d /tmp/3d-mir-build.XXXXXX)"
trap 'rm -rf "$PREV_BUILD"' EXIT
cp -a "$APP_DIR/public" "$PREV_BUILD/public" 2>/dev/null || true
cp -a "$APP_DIR/dist" "$PREV_BUILD/dist" 2>/dev/null || true

rollback() {
  warn "Update fehlgeschlagen – Rollback wird versucht."
  if [[ -n "$PREV_COMMIT" ]]; then
    git -C "$APP_DIR" reset --hard "$PREV_COMMIT"
  fi
  if [[ -d "$PREV_BUILD/public" ]]; then
    rm -rf "$APP_DIR/public" "$APP_DIR/dist"
    cp -a "$PREV_BUILD/public" "$APP_DIR/public"
    [[ -d "$PREV_BUILD/dist" ]] && cp -a "$PREV_BUILD/dist" "$APP_DIR/dist"
  fi
  npm ci --no-audit --no-fund >/dev/null 2>&1 || true
  systemctl restart "$SERVICE" || true
  if health; then
    warn "Rollback erfolgreich; der vorherige Stand läuft wieder."
  else
    warn "Rollback unvollständig. Bitte Logs prüfen: journalctl -u $SERVICE -n 100"
  fi
  exit 1
}

if [[ "$DO_PULL" -eq 1 ]] && git -C "$APP_DIR" remote 2>/dev/null | grep -q .; then
  log "Git-Update"
  git -C "$APP_DIR" fetch --prune
  git -C "$APP_DIR" merge --ff-only '@{u}' || rollback
else
  log "Kein Git-Pull (kein Remote oder --no-pull)."
fi

log "Abhängigkeiten und Build"
npm ci --no-audit --no-fund || rollback
npm run build || rollback

log "Dienst neu starten"
systemctl restart "$SERVICE" || rollback
# Timer-Einheiten bei Bedarf anlegen bzw. aktualisieren.
env_value() {
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}
TIMER_USER="${SERVICE_USER:-mir3d}"
TIMER_DATA="${DATA_DIR:-$(env_value DATA_DIR)}"
TIMER_DATA="${TIMER_DATA:-/var/lib/3d-mir}"
TIMER_LOG="${LOG_DIR:-$(env_value LOG_DIR)}"
TIMER_LOG="${TIMER_LOG:-/var/log/3d-mir}"
for timer in 3d-mir-monitor 3d-mir-cleanup; do
  service_tpl="$APP_DIR/deploy/${timer}.service.tpl"
  timer_tpl="$APP_DIR/deploy/${timer}.timer.tpl"
  [[ -f "$service_tpl" && -f "$timer_tpl" ]] || continue
  sed -e "s|__APP_DIR__|$APP_DIR|g" \
      -e "s|__SERVICE_USER__|$TIMER_USER|g" \
      -e "s|__DATA_DIR__|$TIMER_DATA|g" \
      -e "s|__LOG_DIR__|$TIMER_LOG|g" \
      "$service_tpl" > "/etc/systemd/system/${timer}.service"
  cp "$timer_tpl" "/etc/systemd/system/${timer}.timer"
  systemctl daemon-reload
  systemctl enable --now "${timer}.timer" >/dev/null
  systemctl restart "${timer}.timer" || true
done

if health; then
  log "Update erfolgreich. Aktueller Stand:"
  if [[ -n "$PREV_COMMIT" ]]; then
    git -C "$APP_DIR" log --oneline -1
  fi
else
  journalctl -u "$SERVICE" -n 40 --no-pager || true
  rollback
fi
