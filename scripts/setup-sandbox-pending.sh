#!/usr/bin/env bash
# Prepara .env.asaas-sandbox-pending (interativo — não commitar).
#
# Uso:
#   ./scripts/setup-sandbox-pending.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

PENDING="${PENDING_FILE:-.env.asaas-sandbox-pending}"
EXAMPLE="$ROOT/.env.asaas-sandbox-pending.example"

if [ -f "$PENDING" ]; then
  read -r -p "$PENDING já existe. Sobrescrever? [s/N] " ans
  case "${ans:-N}" in
    s|S|y|Y) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

echo "==> Credenciais Asaas SANDBOX (https://sandbox.asaas.com)"
echo "    Integrações → API Key | Minha conta → walletId"
echo ""

read -r -p "ASAAS_API_KEY (\$aact_hmlg_...): " API_KEY
read -r -p "ASAAS_PLATFORM_WALLET_ID (uuid): " WALLET_ID
read -r -p "ASAAS_WEBHOOK_TOKEN (painel Webhooks): " WEBHOOK_TOKEN

if env_is_placeholder "$API_KEY" || [ -z "$API_KEY" ]; then
  echo "ERRO: API key inválida" >&2
  exit 1
fi
if [ -z "$WALLET_ID" ]; then
  echo "ERRO: walletId obrigatório" >&2
  exit 1
fi
if [ -z "$WEBHOOK_TOKEN" ]; then
  if [ -f .env ]; then
    WEBHOOK_TOKEN="$(env_get ASAAS_WEBHOOK_TOKEN .env 2>/dev/null || true)"
  fi
fi
if [ -z "$WEBHOOK_TOKEN" ]; then
  echo "ERRO: token de webhook obrigatório" >&2
  exit 1
fi

cat >"$PENDING" <<EOF
# Gerado por setup-sandbox-pending.sh em $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# NÃO COMMITAR — gitignore

PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=$(docker_env_escape "$API_KEY")
ASAAS_PLATFORM_WALLET_ID=$WALLET_ID
ASAAS_WEBHOOK_TOKEN=$(docker_env_escape "$WEBHOOK_TOKEN")
ASAAS_ENVIRONMENT=sandbox
ASAAS_DISABLED=false
ASAAS_ONBOARDING_MODE=linked
ASAAS_ALLOW_MANUAL_WALLET=true
ASAAS_CREATE_SUBACCOUNT_ON_REGISTER=false
EOF

chmod 600 "$PENDING"
echo ""
echo "==> Gravado em $PENDING"
echo "    Próximo: ./scripts/ir-sandbox-asaas.sh --reload"
