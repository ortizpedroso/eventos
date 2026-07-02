#!/usr/bin/env bash
# Salva variáveis Asaas de produção do .env atual para restauração após testes sandbox.
# O arquivo de backup fica fora do git (chmod 600). Nunca commite o backup.
#
# Uso no VPS:
#   cd /opt/eventosbr
#   ./scripts/backup-asaas-prod-env.sh
#
# Backup customizado:
#   BACKUP_FILE=/root/eventosbr-asaas-prod.env ./scripts/backup-asaas-prod-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_FILE="${BACKUP_FILE:-$ROOT/.env.asaas-prod-backup}"
COMPOSE="${COMPOSE:-docker-compose.prod.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

env_name="$(env_get ASAAS_ENVIRONMENT "$ENV_FILE" 2>/dev/null || echo "")"
if [ "$env_name" = "sandbox" ]; then
  echo "AVISO: .env atual já está em sandbox — backup pode não ser produção." >&2
fi

api_key="$(env_get ASAAS_API_KEY "$ENV_FILE" || true)"
wallet="$(env_get ASAAS_PLATFORM_WALLET_ID "$ENV_FILE" || true)"
webhook="$(env_get ASAAS_WEBHOOK_TOKEN "$ENV_FILE" || true)"
provider="$(env_get PAYMENT_PROVIDER "$ENV_FILE" 2>/dev/null || echo asaas)"
disabled="$(env_get ASAAS_DISABLED "$ENV_FILE" 2>/dev/null || echo false)"

if env_is_placeholder "$api_key" || [ -z "$api_key" ]; then
  echo "ERRO: ASAAS_API_KEY vazio ou placeholder em $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_FILE")"
umask 077

{
  echo "# Backup Asaas produção — gerado em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Restaurar: ./scripts/restore-asaas-prod-env.sh"
  echo "PAYMENT_PROVIDER=${provider}"
  echo "ASAAS_API_KEY=$(docker_env_escape "$api_key")"
  echo "ASAAS_PLATFORM_WALLET_ID=${wallet}"
  echo "ASAAS_WEBHOOK_TOKEN=${webhook}"
  echo "ASAAS_ENVIRONMENT=${env_name:-production}"
  echo "ASAAS_DISABLED=${disabled}"
} >"$BACKUP_FILE"

chmod 600 "$BACKUP_FILE"

echo "==> Backup Asaas gravado em: $BACKUP_FILE"
echo "    ASAAS_ENVIRONMENT=${env_name:-production}"
echo "    ASAAS_PLATFORM_WALLET_ID=${wallet}"
echo ""
echo "Próximo passo (sandbox):"
echo "  ./scripts/switch-asaas-sandbox.sh --api-key '\$aact_hmlg_...' --platform-wallet '...' --webhook-token '...'"
