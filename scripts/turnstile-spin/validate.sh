#!/usr/bin/env bash
# Valida secret Turnstile com token dummy (Spin skill).
# TURNSTILE_SECRET ou TURNSTILE_SECRET_KEY no ambiente.

set -euo pipefail

SECRET="${TURNSTILE_SECRET:-${TURNSTILE_SECRET_KEY:-}}"
[ -n "$SECRET" ] || { echo '{"status":"error","detail":"no secret"}'; exit 1; }

secret_file=$(mktemp)
chmod 600 "$secret_file"
trap 'rm -f "$secret_file"' EXIT
printf '%s' "$SECRET" > "$secret_file"

dummy=$(curl -sS -X POST "https://challenges.cloudflare.com/turnstile/v0/siteverify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "secret@$secret_file" \
  --data-urlencode "response=XXXX.DUMMY.TOKEN.XXXX" || echo "")

python3 -c '
import json, sys
raw = sys.stdin.read()
if not raw:
    print(json.dumps({"status":"error","detail":"network"})); sys.exit(1)
d = json.loads(raw)
codes = d.get("error-codes") or []
if "invalid-input-secret" in codes:
    print(json.dumps({"status":"error","detail":"invalid-input-secret"})); sys.exit(1)
if "invalid-input-response" in codes:
    print(json.dumps({"status":"ok","check":"dummy_siteverify"})); sys.exit(0)
print(json.dumps({"status":"error","detail":codes})); sys.exit(1)
' <<< "$dummy"
