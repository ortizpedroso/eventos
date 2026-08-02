#!/usr/bin/env bash
# Cria widget Turnstile via API Cloudflare (Spin skill).
# Uso: CLOUDFLARE_API_TOKEN=... ./scripts/turnstile-spin/widget-create.sh \
#   --account-id <id> --name "EventosBR" --domains eventosbr.app.br,www.eventosbr.app.br
#
# Domínios: separados por vírgula SEM espaços, ou um hostname por linha.
# No painel Cloudflare: um hostname por campo — NÃO cole "a, b, c" num único campo.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ACCOUNT_ID=""
NAME=""
DOMAINS=""
MODE="managed"

need_arg() {
  if [ -z "${2-}" ] || [[ "$2" == --* ]]; then
    echo "widget-create: missing value for $1" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --account-id) need_arg "$1" "${2-}"; ACCOUNT_ID="$2"; shift 2 ;;
    --name)       need_arg "$1" "${2-}"; NAME="$2"; shift 2 ;;
    --domains)    need_arg "$1" "${2-}"; DOMAINS="$2"; shift 2 ;;
    --mode)       need_arg "$1" "${2-}"; MODE="$2"; shift 2 ;;
    *) echo "unknown arg $1" >&2; exit 2 ;;
  esac
done

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN must be set}"
[ -n "$ACCOUNT_ID" ] && [ -n "$NAME" ] && [ -n "$DOMAINS" ] || {
  echo "usage: --account-id ID --name NAME --domains a,b,c" >&2
  exit 2
}

domains_json=$(python3 "$SCRIPT_DIR/normalize-domains.py" "$DOMAINS") || {
  echo "widget-create: domínios inválidos — $DOMAINS" >&2
  exit 1
}

body_json=$(python3 -c '
import json, sys
name, domains_json, mode = sys.argv[1], sys.argv[2], sys.argv[3]
domains = json.loads(domains_json)
print(json.dumps({"name": name, "domains": domains, "mode": mode}))
' "$NAME" "$domains_json" "$MODE")

echo "widget-create: domínios normalizados: $domains_json" >&2

account_enc=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$ACCOUNT_ID")

tmp=$(mktemp)
auth_headers=$(mktemp)
chmod 600 "$auth_headers"
trap 'rm -f "$tmp" "$auth_headers"' EXIT
printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN" > "$auth_headers"

http_code=$(curl -sS -w "%{http_code}" -o "$tmp" -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$account_enc/challenges/widgets" \
  -H "@$auth_headers" \
  -H "Content-Type: application/json" \
  --data "$body_json" || echo "000")

python3 -c '
import json, sys
http_code, path = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
if not data.get("success"):
    err = (data.get("errors") or [{}])[0]
    msg = err.get("message", "failed")
    print(json.dumps({"status":"error","message":msg}))
    sys.exit(1)
r = data.get("result") or {}
print(json.dumps({"status":"ok","sitekey":r["sitekey"],"secret":r["secret"]}))
' "$http_code" "$tmp"
