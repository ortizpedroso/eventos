#!/usr/bin/env bash
# Salva variáveis Asaas de produção do .env para restauração após testes sandbox.
#
# Uso:
#   ./scripts/backup-asaas-prod-env.sh
#
# Gera .env.asaas-prod-backup (gitignored). Não commitar.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP="${BACKUP_FILE:-.env.asaas-prod-backup}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

read_var() {
  env_get "$1" "$ENV_FILE" 2>/dev/null || true
}

PAYMENT_PROVIDER="$(read_var PAYMENT_PROVIDER)"
ASAAS_API_KEY="$(read_var ASAAS_API_KEY)"
ASAAS_PLATFORM_WALLET_ID="$(read_var ASAAS_PLATFORM_WALLET_ID)"
ASAAS_WEBHOOK_TOKEN="$(read_var ASAAS_WEBHOOK_TOKEN)"
ASAAS_ENVIRONMENT="$(read_var ASAAS_ENVIRONMENT)"
ASAAS_DISABLED="$(read_var ASAAS_DISABLED)"
ASAAS_ONBOARDING_MODE="$(read_var ASAAS_ONBOARDING_MODE)"
ASAAS_ALLOW_MANUAL_WALLET="$(read_var ASAAS_ALLOW_MANUAL_WALLET)"
ASAAS_CREATE_SUBACCOUNT_ON_REGISTER="$(read_var ASAAS_CREATE_SUBACCOUNT_ON_REGISTER)"

if env_is_placeholder "$ASAAS_API_KEY"; then
  echo "AVISO: ASAAS_API_KEY parece placeholder ou vazia — backup pode estar incompleto." >&2
fi

cat >"$BACKUP" <<EOF
# Backup Asaas produção — NÃO COMMITAR (gitignore)
# Gerado em $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Restaurar: ./scripts/restore-asaas-prod-env.sh [--reload]
PAYMENT_PROVIDER=${PAYMENT_PROVIDER:-asaas}
ASAAS_API_KEY=$(docker_env_escape "${ASAAS_API_KEY:-}")
ASAAS_PLATFORM_WALLET_ID=${ASAAS_PLATFORM_WALLET_ID:-}
ASAAS_WEBHOOK_TOKEN=$(docker_env_escape "${ASAAS_WEBHOOK_TOKEN:-}")
ASAAS_ENVIRONMENT=${ASAAS_ENVIRONMENT:-production}
ASAAS_DISABLED=${ASAAS_DISABLED:-false}
ASAAS_ONBOARDING_MODE=${ASAAS_ONBOARDING_MODE:-linked}
ASAAS_ALLOW_MANUAL_WALLET=${ASAAS_ALLOW_MANUAL_WALLET:-false}
ASAAS_CREATE_SUBACCOUNT_ON_REGISTER=${ASAAS_CREATE_SUBACCOUNT_ON_REGISTER:-false}
EOF

chmod 600 "$BACKUP" 2>/dev/null || true
echo "==> Backup gravado em $BACKUP"
echo "    ASAAS_ENVIRONMENT=${ASAAS_ENVIRONMENT:-production}"
echo "    ASAAS_PLATFORM_WALLET_ID=${ASAAS_PLATFORM_WALLET_ID:-}"
