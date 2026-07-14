#!/usr/bin/env bash
# Valida configuração sandbox Asaas e conectividade com a API.
#
# Uso (no VPS, após switch-asaas-sandbox.sh):
#   ./scripts/test-asaas-sandbox.sh
#   ./scripts/test-asaas-sandbox.sh --reload-api   # reinicia API antes do teste
#
# Local (com .env apontando para sandbox):
#   ASAAS_ENVIRONMENT=sandbox ./scripts/test-asaas-sandbox.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RELOAD=0

for arg in "$@"; do
  case "$arg" in
    --reload-api) RELOAD=1 ;;
    -h|--help)
      echo "Uso: $0 [--reload-api]"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

asaas_env="$(env_get ASAAS_ENVIRONMENT "$ENV_FILE" || true)"
asaas_key="$(env_get ASAAS_API_KEY "$ENV_FILE" || true)"
asaas_disabled="$(env_get ASAAS_DISABLED "$ENV_FILE" || true)"

echo "==> Teste Asaas sandbox"
echo "    ASAAS_ENVIRONMENT=${asaas_env:-sandbox (inferido)}"

if [ "${asaas_disabled:-false}" = "true" ]; then
  echo "ERRO: ASAAS_DISABLED=true — ative pagamentos para testar sandbox" >&2
  exit 1
fi

if env_is_placeholder "$asaas_key" || [ -z "$asaas_key" ]; then
  echo "ERRO: ASAAS_API_KEY ausente no $ENV_FILE" >&2
  echo "  1. cp .env.asaas-sandbox-pending.example .env.asaas-sandbox-pending" >&2
  echo "  2. Preencha credenciais sandbox" >&2
  echo "  3. ./scripts/switch-asaas-sandbox.sh --reload" >&2
  exit 1
fi

if [ "$asaas_env" != "sandbox" ]; then
  case "$asaas_key" in
    *aact_hmlg_*|*hmlg*) ;;
    *)
      echo "AVISO: ASAAS_ENVIRONMENT não é 'sandbox' — confirme que deseja testar em homologação." >&2
      ;;
  esac
fi

if [ "$RELOAD" -eq 1 ]; then
  echo "==> Reiniciando API..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
  for i in $(seq 1 24); do
    if curl -fsS --max-time 10 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
      echo "  OK  /ready"
      break
    fi
    sleep 5
  done
fi

echo ""
echo "==> Conectividade API Asaas (GET /v3/myAccount)"
if docker compose -f "$COMPOSE" ps api --format '{{.State}}' 2>/dev/null | grep -qi running; then
  docker compose -f "$COMPOSE" exec -T api python3 scripts/test-asaas-connection.py
else
  PYTHONPATH="$ROOT" python3 scripts/test-asaas-connection.py
fi
conn_rc=$?

echo ""
echo "==> Checklist sandbox manual"
DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
echo "  [ ] Webhook no painel SANDBOX: https://${DOMAIN}/api/webhooks/asaas"
echo "  [ ] Token = ASAAS_WEBHOOK_TOKEN do .env"
echo "  [ ] Organizador: Financeiro → Vincular walletId (conta sandbox secundária)"
echo "  [ ] Compra teste PIX ou cartão sandbox"
echo "  [ ] Após testes: ./scripts/restore-asaas-prod-env.sh --reload"
echo ""

if [ "$conn_rc" -eq 0 ]; then
  echo "✅ Sandbox: API respondeu OK."
elif [ "$conn_rc" -eq 3 ]; then
  echo "⚠️  API OK, mas ASAAS_PLATFORM_WALLET_ID não confere — ajuste o .env."
  exit 3
else
  echo "❌ Falha na conexão com Asaas sandbox."
  exit "$conn_rc"
fi
