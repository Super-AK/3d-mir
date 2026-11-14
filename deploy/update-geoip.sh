#!/usr/bin/env bash
# 3D-MIR – lokale GeoIP-Datenbank für die Länderprüfung aktualisieren.
#
# Aufruf:
#   sudo deploy/update-geoip.sh            # herunterladen, installieren, Dienst neu starten
#   sudo deploy/update-geoip.sh --no-restart
#
# Quelle: DB-IP Lite (https://db-ip.com), Lizenz CC BY 4.0.
# Die Datenbank wird ausschließlich lokal ausgewertet; es werden keine
# IP-Adressen an Dritte übermittelt.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
GEOIP_DIR="${GEOIP_DIR:-$DATA_DIR/geoip}"
TARGET="${GEOIP_DB_PATH:-$GEOIP_DIR/dbip-country-lite.mmdb}"
SERVICE="${SERVICE:-3d-mir.service}"
SERVICE_USER="${SERVICE_USER:-mir3d}"
BASE_URL="${GEOIP_DOWNLOAD_BASE:-https://download.db-ip.com/free}"
RESTART=1
[[ "${1:-}" == "--no-restart" ]] && RESTART=0

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarnung:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Bitte mit sudo ausführen: sudo deploy/update-geoip.sh"
command -v curl >/dev/null 2>&1 || die "curl fehlt."
command -v gzip >/dev/null 2>&1 || die "gzip fehlt."

work="$(mktemp -d /tmp/3d-mir-geoip.XXXXXX)"
trap 'rm -rf "$work"' EXIT

# Aktuellen Monat versuchen; kurz nach Monatswechsel ist ggf. noch der
# Vormonat verfügbar.
month=""
for offset in 0 1; do
  candidate="$(date -u -d "-${offset} month" +%Y-%m 2>/dev/null || true)"
  [[ -n "$candidate" ]] || continue
  log "GeoIP-Datenbank laden: dbip-country-lite-$candidate.mmdb.gz"
  if curl -fsSL --retry 2 --max-time 600 -o "$work/db.mmdb.gz" "$BASE_URL/dbip-country-lite-$candidate.mmdb.gz"; then
    month="$candidate"
    break
  fi
  warn "Monat $candidate nicht verfügbar, versuche Vormonat"
done
[[ -n "$month" ]] || die "Download fehlgeschlagen. Bitte Internetverbindung und URL prüfen."

gzip -t "$work/db.mmdb.gz" || die "Die heruntergeladene Datei ist kein gültiges gzip-Archiv."
gzip -dc "$work/db.mmdb.gz" > "$work/db.mmdb"
[[ -s "$work/db.mmdb" ]] || die "Die entpackte Datenbank ist leer."

# MaxMind-MMDB-Dateien enthalten diesen Marker in den Metadaten.
if ! tail -c 300000 "$work/db.mmdb" | grep -aq "MaxMind.com"; then
  die "Die Datei sieht nicht wie eine MMDB-Datenbank aus."
fi

if command -v node >/dev/null 2>&1 && [[ -d "$APP_DIR/node_modules/maxmind" ]]; then
  log "Datenbank probehalber öffnen"
  if ! (cd "$APP_DIR" && node -e "
    import('maxmind').then(async ({ open }) => {
      const reader = await open(process.argv[1]);
      const record = reader.get('1.1.1.1');
      if (!record) process.exit(2);
      console.log('Testabfrage 1.1.1.1:', record.country && record.country.iso_code ? record.country.iso_code : 'unbekannt');
    }).catch((error) => { console.error(error.message); process.exit(1); });
  " "$work/db.mmdb"); then
    die "Die Datenbank konnte nicht gelesen werden."
  fi
fi

install -d -m 0755 -o "$SERVICE_USER" -g "$SERVICE_USER" "$(dirname "$TARGET")"
if [[ -f "$TARGET" ]]; then
  cp -a "$TARGET" "$TARGET.bak"
fi
install -m 0644 -o "$SERVICE_USER" -g "$SERVICE_USER" "$work/db.mmdb" "$TARGET"

log "Installiert: $TARGET (Stand $month)"
log "Quelle: DB-IP Lite, https://db-ip.com – Lizenz CC BY 4.0"

if [[ "$RESTART" -eq 1 ]] && systemctl is-active --quiet "$SERVICE"; then
  log "Dienst $SERVICE neu starten, damit die neue Datenbank geladen wird"
  systemctl restart "$SERVICE"
  sleep 2
  systemctl is-active --quiet "$SERVICE" || die "Dienst $SERVICE läuft nach dem Neustart nicht."
fi
