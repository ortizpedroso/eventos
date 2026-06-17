#!/usr/bin/env bash
# Preenche variáveis Asaas no .env (interativo ou via argumentos).
# Execute no VPS quando tiver as credenciais do painel Asaas.
#
# Uso interativo:
#   ./scripts/configure-asaas-env.sh
#
# Uso não interativo (CI / quando o utilizador passar os valores):
#   ./scripts/configure-asaas-env.sh \
#     --api-key '$aact_prod_...' \
#     --platform-wallet 'uuid-wallet-plataforma' \
#     --webhook-token 'token-forte'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE="$ROOT/.env.production.example"

API_KEY=""
PLATFORM_WALLET=""
WEBHOOK_TOKEN=""
ENVIRONMENT="production"

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
  read -r -p "ASAAS_API_KEY (ex.: \$aact_prod_...): " API_KEY
fi
if [ -z "$PLATFORM_WALLET" ]; then
  read -r -p "ASAAS_PLATFORM_WALLET_ID (walletId da conta EventosBR): " PLATFORM_WALLET
fi
if [ -z "$WEBHOOK_TOKEN" ]; then
  read -r -p "ASAAS_WEBHOOK_TOKEN (token forte para webhook): " WEBHOOK_TOKEN
  if [ -z "$WEBHOOK_TOKEN" ]; then
    WEBHOOK_TOKEN="$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    echo "Token de webhook gerado e gravado em $ENV_FILE (não exibido por segurança)."
  fi
fi

set_env_var() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # shellcheck disable=SC2016
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

set_env_var "PAYMENT_PROVIDER" "asaas"
set_env_var "ASAAS_API_KEY" "$API_KEY"
set_env_var "ASAAS_PLATFORM_WALLET_ID" "$PLATFORM_WALLET"
set_env_var "ASAAS_WEBHOOK_TOKEN" "$WEBHOOK_TOKEN"
set_env_var "ASAAS_ENVIRONMENT" "$ENVIRONMENT"
set_env_var "ASAAS_DISABLED" "false"
set_env_var "STRIPE_DISABLED" "true"

echo ""
echo "==> Asaas configurado em $ENV_FILE"
echo "    PAYMENT_PROVIDER=asaas"
echo "    ASAAS_ENVIRONMENT=$ENVIRONMENT"
echo "    ASAAS_PLATFORM_WALLET_ID=$PLATFORM_WALLET"
echo ""
DOMAIN="$(grep '^DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo 'SEU_DOMINIO')"
echo "Próximos passos:"
echo "  1. ./scripts/deploy-vps.sh"
echo "  2. Webhook Asaas → https://${DOMAIN}/api/webhooks/asaas"
echo "     Use o valor de ASAAS_WEBHOOK_TOKEN definido em $ENV_FILE"
echo "  3. ./scripts/verify-production.sh"
echo "  4. Organizadores: Financeiro → walletId"
echo ""
echo "Referência: ./scripts/asaas-webhook-setup.sh ${DOMAIN}"
