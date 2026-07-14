#!/usr/bin/env bash
# Testa se o webhook Asaas responde (token + URL).
#
# Uso:
#   ./scripts/test-asaas-webhook.sh
#   ./scripts/test-asaas-webhook.sh --expect-ok

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
EXPECT_OK=0

for arg in "$@"; do
  case "$arg" in
    --expect-ok) EXPECT_OK=1 ;;
    -h|--help)
      echo "Uso: $0 [--expect-ok]"
      exit 0
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
TOKEN="$(env_get ASAAS_WEBHOOK_TOKEN "$ENV_FILE" || true)"
URL="https://${DOMAIN}/api/webhooks/asaas"

if [ -z "$TOKEN" ]; then
  echo "ERRO: ASAAS_WEBHOOK_TOKEN ausente no $ENV_FILE" >&2
  exit 1
fi

echo "==> Teste webhook POST $URL"

HTTP_CODE="$(
  curl -sS -o /tmp/eventosbr-webhook-test-body.txt -w '%{http_code}' \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "asaas-access-token: $TOKEN" \
    -d '{"event":"SANDBOX_PING","id":"evt_sandbox_ping_token_only"}' \
    || echo "000"
)"

echo "    HTTP $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "✅ Webhook aceito (token e URL corretos)."
  exit 0
fi

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "❌ Token rejeitado — confira ASAAS_WEBHOOK_TOKEN no .env e no painel Asaas SANDBOX." >&2
elif [ "$HTTP_CODE" = "405" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "❌ URL incorreta ou API fora do ar." >&2
else
  echo "❌ Resposta inesperada. Corpo:" >&2
  head -c 500 /tmp/eventosbr-webhook-test-body.txt 2>/dev/null || true
  echo "" >&2
fi

[ "$EXPECT_OK" -eq 1 ] && exit 1
exit 1
