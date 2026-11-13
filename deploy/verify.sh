#!/usr/bin/env bash
# 3D-MIR – Betriebsprüfung nach Installation/Update.
#
# Aufruf:
#   sudo deploy/verify.sh
#
# Prüft ausschließlich lesend: Dienststatus, NGINX-Konfiguration, Health-Endpunkt,
# Sicherheits-Header, SEO-Dateien, Datenbank, Verzeichnisse und TLS-Ablauf.
set -uo pipefail

APP_DIR="${APP_DIR:-$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")}"
DOMAIN="${DOMAIN:-3d-mir.de}"
DATA_DIR="${DATA_DIR:-/var/lib/3d-mir}"
LOG_DIR="${LOG_DIR:-/var/log/3d-mir}"
DB_PATH="${DB_PATH:-$DATA_DIR/db/3d-mir.sqlite}"
ENV_FILE="${ENV_FILE:-/etc/3d-mir/3d-mir.env}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"

pass=0
fail=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; pass=$((pass + 1)); }
bad()  { printf '  \033[1;31m✗\033[0m %s\n' "$*"; fail=$((fail + 1)); }
head() { printf '\n\033[1;34m%s\033[0m\n' "$*"; }

head "System"
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[[ "$node_major" -ge 22 ]] && ok "Node.js $(node -v)" || bad "Node.js 22 fehlt (gefunden: $(node -v 2>/dev/null || echo keins))"
systemctl is-active --quiet 3d-mir.service && ok "Dienst 3d-mir.service aktiv" || bad "Dienst 3d-mir.service nicht aktiv"
systemctl is-enabled --quiet 3d-mir.service && ok "Dienst beim Boot aktiviert" || bad "Dienst nicht beim Boot aktiviert"

head "NGINX"
if nginx -t >/dev/null 2>&1; then ok "NGINX-Konfiguration gültig"; else bad "NGINX-Konfiguration fehlerhaft (nginx -t)"; fi
systemctl is-active --quiet nginx && ok "NGINX aktiv" || bad "NGINX nicht aktiv"

head "HTTP"
for path in / /leistungen/ /3d-druck-rechner/ /shop/ /zahlung/ /kontakt/ /impressum/ /datenschutz/ /robots.txt /sitemap.xml; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "$BASE_URL$path" 2>/dev/null || echo 000)"
  [[ "$code" == "200" ]] && ok "$path → 200" || bad "$path → $code"
done
health="$(curl -fsS -H "Host: $DOMAIN" "$BASE_URL/api/health" 2>/dev/null || true)"
[[ "$health" == *'"status":"ok"'* ]] && ok "Health-Endpunkt meldet ok" || bad "Health-Endpunkt fehlerhaft: $health"
webhook_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Host: $DOMAIN" -H 'Content-Type: application/json' --data '{}' "$BASE_URL/zahlung/webhook/stripe/" 2>/dev/null || echo 000)"
[[ "$webhook_code" == "400" ]] && ok "Stripe-Webhook lehnt unsignierte Anfrage ab (400)" || bad "Stripe-Webhook antwortet unerwartet: $webhook_code"

headers="$(curl -sS -D- -o /dev/null -H "Host: $DOMAIN" "$BASE_URL/" 2>/dev/null || true)"
for header in 'content-security-policy' 'x-content-type-options' 'referrer-policy' 'permissions-policy'; do
  echo "$headers" | grep -qi "^$header:" && ok "Header $header gesetzt" || bad "Header $header fehlt"
done

head "Weiterleitungen"
for pair in '/versandarten/:301' '/wp-admin/:301' '/wp-content/uploads/test.jpg:404'; do
  path="${pair%:*}"
  expected="${pair##*:}"
  code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "$BASE_URL$path" 2>/dev/null || echo 000)"
  [[ "$code" == "$expected" ]] && ok "$path → $code" || bad "$path → $code (erwartet $expected)"
done

head "Daten und Rechte"
if [[ -f "$DB_PATH" ]]; then
  sqlite3 "$DB_PATH" 'PRAGMA integrity_check;' 2>/dev/null | grep -qx ok && ok "SQLite-Integrität ok" || bad "SQLite-Integritätsprüfung fehlgeschlagen"
else
  bad "Datenbank fehlt: $DB_PATH"
fi
[[ -r "$DATA_DIR" && -w "$DATA_DIR" ]] && ok "$DATA_DIR beschreibbar" || bad "$DATA_DIR nicht beschreibbar"
[[ -d "$LOG_DIR" ]] && ok "$LOG_DIR vorhanden" || bad "$LOG_DIR fehlt"
if [[ -f "$ENV_FILE" ]]; then
  mode="$(stat -c '%a' "$ENV_FILE")"
  [[ "$mode" == "600" ]] && ok "$ENV_FILE Rechte 600" || bad "$ENV_FILE Rechte $mode (erwartet 600)"
else
  bad "$ENV_FILE fehlt"
fi

head "TLS"
cert="/etc/letsencrypt/live/$DOMAIN/cert.pem"
if [[ -f "$cert" ]]; then
  end="$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)"
  days="$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))"
  if [[ "$days" -ge 14 ]]; then ok "Zertifikat gültig noch $days Tage"; else bad "Zertifikat läuft in $days Tagen ab"; fi
else
  printf '  \033[1;33m–\033[0m Noch kein Let'\''s-Encrypt-Zertifikat für %s\n' "$DOMAIN"
fi

printf '\nErgebnis: %d bestanden, %d fehlgeschlagen\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
