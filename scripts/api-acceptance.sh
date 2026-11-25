#!/usr/bin/env bash
# Nur-Lesen-Abnahme der Shop-API aus Sicht der Faktura-App.
# Der Token wird ausschließlich aus der Umgebung gelesen und NIE ausgegeben.
# Aufruf: API_TOKEN='…' bash scripts/api-acceptance.sh
set -uo pipefail

API="${API:-https://www.3d-mir.de/api/v1}"
if [[ -z "${API_TOKEN:-}" ]]; then
  echo "API_TOKEN fehlt. Bitte in der Umgebung setzen (nicht in Dateien/Commits)." >&2
  exit 1
fi

BODY="$(mktemp)"
HEADERS="$(mktemp)"
trap 'rm -f "$BODY" "$HEADERS"' EXIT
FAIL=0

request() {
  # $1 = URL, Rest = zusätzliche curl-Optionen
  local url="$1"; shift
  curl -sS -o "$BODY" -D "$HEADERS" -w '%{http_code}' \
    -H "Authorization: Bearer ${API_TOKEN}" "$@" "$url"
}

check() {
  local name="$1" status="$2" expected="$3" pattern="${4:-}"
  if [[ "$status" != "$expected" ]]; then
    echo "✗ ${name}: HTTP ${status} (erwartet ${expected})"
    FAIL=1
    return
  fi
  if [[ -n "$pattern" ]] && ! grep -q "$pattern" "$BODY"; then
    echo "✗ ${name}: Antwort enthält nicht ${pattern}"
    FAIL=1
    return
  fi
  if ! grep -qi '^x-request-id:' "$HEADERS"; then
    echo "✗ ${name}: X-Request-Id fehlt"
    FAIL=1
    return
  fi
  echo "✓ ${name}"
}

echo "Prüfe ${API} (Token wird nicht angezeigt)"

status="$(request "${API}/health")"
check "health" "$status" 200 '"status":"ok"'
check "health Version 1.x" "$status" 200 '"version":"1.'

status="$(request "${API}/meta")"
check "meta" "$status" 200 '"api_version":"1.'
check "meta Kundennummern" "$status" 200 '"customer_numbers"'
check "meta Freigaben" "$status" 200 '"resources"'

status="$(request "${API}/orders?limit=1")"
check "Bestellungen" "$status" 200 '"data":['
check "Bestellungen Pagination" "$status" 200 '"has_more"'
check "Bestellungen server_time" "$status" 200 '"server_time"'

status="$(request "${API}/customers?limit=1")"
check "Kunden" "$status" 200 '"data":['
check "Kundennummer KD9xxxxx" "$status" 200 '"customer_number":"KD9'

status="$(request "${API}/products?limit=1")"
check "Artikel" "$status" 200 '"data":['

status="$(curl -sS -o "$BODY" -D "$HEADERS" -w '%{http_code}' "${API}/orders")"
check "ohne Token -> 401" "$status" 401 'unauthorized'

status="$(curl -sS -o "$BODY" -D "$HEADERS" -w '%{http_code}' -H 'Authorization: Bearer ungueltig' "${API}/orders")"
check "falscher Token -> 401" "$status" 401 'unauthorized'

status="$(request "${API}/gibts-nicht")"
check "unbekannter Pfad -> 404" "$status" 404 'not_found'

echo "---"
if [[ "$FAIL" -eq 0 ]]; then
  echo "Alle Shop-seitigen Abnahmepunkte bestanden. Die restlichen Punkte (Entwurf, Duplikate, Beträge, Storno) liegen in der Faktura-App."
  exit 0
fi
echo "Einige Prüfungen fehlgeschlagen – Antworten werden aus Datenschutzgründen nicht ausgegeben."
exit 1
