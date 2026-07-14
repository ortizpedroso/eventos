#!/usr/bin/env bash
# Alterna o .env para credenciais Asaas sandbox (com backup automático da produção).
#
# Uso:
#   ./scripts/switch-asaas-sandbox.sh
#   ./scripts/switch-asaas-sandbox.sh --api-key '$aact_hmlg_...' --wallet-id 'uuid' [--reload]
#
# Também lê .env.asaas-sandbox-pending (gitignored) se existir e os argumentos estiverem vazios.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
PENDING="${PENDING_FILE:-.env.asaas-sandbox-pending}"
COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"

API_KEY=""
WALLET_ID=""
WEBHOOK_TOKEN=""
ONBOARDING_MODE=""
ALLOW_MANUAL=""
RELOAD=0

usage() {
  echo "Uso: $0 [--api-key KEY] [--wallet-id UUID] [--webhook-token TOKEN] [--reload]"
  echo ""
  echo "Sem argumentos: usa valores de $PENDING (se existir) ou pede interativamente."
  echo "Sempre faz backup da produção em .env.asaas-prod-backup antes de alterar."
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --api-key) API_KEY="$2"; shift 2 ;;
    --wallet-id) WALLET_ID="$2"; shift 2 ;;
    --webhook-token) WEBHOOK_TOKEN="$2"; shift 2 ;;
    --reload) RELOAD=1; shift ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

if [ -z "$API_KEY" ] && [ -f "$PENDING" ]; then
  API_KEY="$(env_get ASAAS_API_KEY "$PENDING" 2>/dev/null || true)"
  WALLET_ID="$(env_get ASAAS_PLATFORM_WALLET_ID "$PENDING" 2>/dev/null || true)"
  WEBHOOK_TOKEN="$(env_get ASAAS_WEBHOOK_TOKEN "$PENDING" 2>/dev/null || true)"
  ONBOARDING_MODE="$(env_get ASAAS_ONBOARDING_MODE "$PENDING" 2>/dev/null || true)"
  ALLOW_MANUAL="$(env_get ASAAS_ALLOW_MANUAL_WALLET "$PENDING" 2>/dev/null || true)"
  echo "==> Credenciais lidas de $PENDING"
fi

if [ -z "$API_KEY" ]; then
  read -r -p "ASAAS_API_KEY sandbox (ex.: \$aact_hmlg_...): " API_KEY
fi
if [ -z "$WALLET_ID" ]; then
  read -r -p "ASAAS_PLATFORM_WALLET_ID sandbox: " WALLET_ID
fi
if [ -z "$WEBHOOK_TOKEN" ]; then
  WEBHOOK_TOKEN="$(env_get ASAAS_WEBHOOK_TOKEN "$ENV_FILE" 2>/dev/null || true)"
  if [ -z "$WEBHOOK_TOKEN" ]; then
    WEBHOOK_TOKEN="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    echo "Token de webhook mantido/gerado (mesmo valor para sandbox e produção no VPS)."
  fi
fi

if env_is_placeholder "$API_KEY"; then
  echo "ERRO: ASAAS_API_KEY inválida ou placeholder" >&2
  exit 1
fi
if [ -z "$WALLET_ID" ]; then
  echo "ERRO: ASAAS_PLATFORM_WALLET_ID obrigatório" >&2
  exit 1
fi

echo "==> Backup da produção (completo)..."
./scripts/backup-prod-env.sh

set_env_var "PAYMENT_PROVIDER" "asaas" "$ENV_FILE"
set_env_var "ASAAS_API_KEY" "$API_KEY" "$ENV_FILE"
set_env_var "ASAAS_PLATFORM_WALLET_ID" "$WALLET_ID" "$ENV_FILE"
set_env_var "ASAAS_WEBHOOK_TOKEN" "$WEBHOOK_TOKEN" "$ENV_FILE"
set_env_var "ASAAS_ENVIRONMENT" "sandbox" "$ENV_FILE"
set_env_var "ASAAS_DISABLED" "false" "$ENV_FILE"
set_env_var "ASAAS_ONBOARDING_MODE" "${ONBOARDING_MODE:-linked}" "$ENV_FILE"
set_env_var "ASAAS_ALLOW_MANUAL_WALLET" "${ALLOW_MANUAL:-true}" "$ENV_FILE"
set_env_var "ASAAS_CREATE_SUBACCOUNT_ON_REGISTER" "false" "$ENV_FILE"

echo ""
echo "==> Sandbox ativo em $ENV_FILE"
echo "    ASAAS_ENVIRONMENT=sandbox"
echo "    ASAAS_PLATFORM_WALLET_ID=$WALLET_ID"
echo ""
DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
echo "Próximos passos:"
echo "  1. Reinicie a API: docker compose -f $COMPOSE up -d --force-recreate api"
echo "     (ou use --reload neste script)"
echo "  2. No painel Asaas SANDBOX → Webhooks:"
echo "     URL: https://${DOMAIN}/api/webhooks/asaas"
echo "     Token = ASAAS_WEBHOOK_TOKEN do .env"
echo "  3. Após os testes: ./scripts/restore-asaas-prod-env.sh --reload"
echo "  4. Validar API: ./scripts/test-asaas-sandbox.sh"
echo ""
echo "Referência: ./scripts/asaas-webhook-setup.sh ${DOMAIN}"

if [ "$RELOAD" -eq 1 ]; then
  echo ""
  echo "==> Reiniciando API..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  for i in $(seq 1 24); do
    if curl -fsS --max-time 10 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
      echo "  OK  /ready (sandbox)"
      exit 0
    fi
    sleep 5
  done
  echo "AVISO: /ready ainda não respondeu" >&2
fi
