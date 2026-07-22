#!/usr/bin/env bash
# Preenche variáveis Asaas no .env (interativo ou via argumentos).
# Execute no VPS quando tiver as credenciais do painel Asaas.
#
# Uso interativo:
#   ./scripts/configure-asaas-env.sh
#
# Uso não interativo:
#   ./scripts/configure-asaas-env.sh \
#     --api-key '$aact_prod_...' \
#     --platform-wallet 'uuid-wallet-plataforma' \
#     --webhook-token 'token-forte' \
#     --env production

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE="$ROOT/.env.production.example"

API_KEY=""
PLATFORM_WALLET=""
WEBHOOK_TOKEN=""
ENVIRONMENT="production"
ONBOARDING_MODE="baas"
ALLOW_MANUAL="false"

usage() {
  echo "Uso: $0 [--api-key KEY] [--platform-wallet ID] [--webhook-token TOKEN] [--env sandbox|production]"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --api-key) API_KEY="$2"; shift 2 ;;
    --platform-wallet) PLATFORM_WALLET="$2"; shift 2 ;;
    --webhook-token) WEBHOOK_TOKEN="$2"; shift 2 ;;
    --env) ENVIRONMENT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

if [ -z "$API_KEY" ]; then
  read -r -p "ASAAS_API_KEY (ex.: \$aact_prod_... ou \$aact_hmlg_...): " API_KEY
fi
if [ -z "$PLATFORM_WALLET" ]; then
  read -r -p "ASAAS_PLATFORM_WALLET_ID (walletId da conta EventosBR): " PLATFORM_WALLET
fi
if [ -z "$WEBHOOK_TOKEN" ]; then
  WEBHOOK_TOKEN="$(env_get ASAAS_WEBHOOK_TOKEN "$ENV_FILE" 2>/dev/null || true)"
  if [ -z "$WEBHOOK_TOKEN" ]; then
    read -r -p "ASAAS_WEBHOOK_TOKEN (token forte para webhook): " WEBHOOK_TOKEN
  fi
  if [ -z "$WEBHOOK_TOKEN" ]; then
    WEBHOOK_TOKEN="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    echo "Token de webhook gerado e gravado em $ENV_FILE (não exibido por segurança)."
  fi
fi

if [ "$ENVIRONMENT" = "sandbox" ]; then
  ONBOARDING_MODE="linked"
  ALLOW_MANUAL="true"
fi

set_env_var "PAYMENT_PROVIDER" "asaas" "$ENV_FILE"
set_env_var "ASAAS_API_KEY" "$API_KEY" "$ENV_FILE"
set_env_var "ASAAS_PLATFORM_WALLET_ID" "$PLATFORM_WALLET" "$ENV_FILE"
set_env_var "ASAAS_WEBHOOK_TOKEN" "$WEBHOOK_TOKEN" "$ENV_FILE"
set_env_var "ASAAS_ENVIRONMENT" "$ENVIRONMENT" "$ENV_FILE"
set_env_var "ASAAS_DISABLED" "false" "$ENV_FILE"
set_env_var "ASAAS_ONBOARDING_MODE" "$ONBOARDING_MODE" "$ENV_FILE"
set_env_var "ASAAS_ALLOW_MANUAL_WALLET" "$ALLOW_MANUAL" "$ENV_FILE"
set_env_var "ASAAS_CREATE_SUBACCOUNT_ON_REGISTER" "false" "$ENV_FILE"

if [ "$ENVIRONMENT" = "production" ]; then
  echo "==> Gravando backup de produção (completo)..."
  ./scripts/backup-prod-env.sh
  ./scripts/verify-prod-backup.sh || true
fi

echo ""
echo "==> Asaas configurado em $ENV_FILE"
echo "    PAYMENT_PROVIDER=asaas"
echo "    ASAAS_ENVIRONMENT=$ENVIRONMENT"
echo "    ASAAS_PLATFORM_WALLET_ID=$PLATFORM_WALLET"
echo "    ASAAS_ONBOARDING_MODE=$ONBOARDING_MODE"
echo ""
DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo 'SEU_DOMINIO')"
echo "Próximos passos:"
echo "  1. ./scripts/deploy-vps.sh"
echo "  2. Webhook Asaas → https://${DOMAIN}/api/webhooks/asaas"
echo "     Use o valor de ASAAS_WEBHOOK_TOKEN definido em $ENV_FILE"
if [ "$ENVIRONMENT" = "sandbox" ]; then
  echo "  3. python3 scripts/test-asaas-connection.py"
else
  echo "  3. ./scripts/verify-production.sh"
fi
echo "  4. Organizadores: Financeiro → walletId"
echo ""
echo "Referência: ./scripts/asaas-webhook-setup.sh ${DOMAIN}"
