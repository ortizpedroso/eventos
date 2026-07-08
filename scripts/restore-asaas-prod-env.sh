#!/usr/bin/env bash
# Restaura variáveis Asaas de produção a partir do backup criado por backup-asaas-prod-env.sh.
#
# Uso no VPS:
#   cd /opt/eventosbr
#   ./scripts/restore-asaas-prod-env.sh
#   ./scripts/restore-asaas-prod-env.sh --reload
#
# Backup alternativo:
#   BACKUP_FILE=/root/eventosbr-asaas-prod.env ./scripts/restore-asaas-prod-env.sh --reload

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_FILE="${BACKUP_FILE:-$ROOT/.env.asaas-prod-backup}"
COMPOSE="${COMPOSE:-docker-compose.prod.yml}"
RELOAD=0

usage() {
  echo "Uso: $0 [--reload]"
  echo "  --reload  Recria o container api após restaurar o .env"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --reload) RELOAD=1; shift ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERRO: backup não encontrado: $BACKUP_FILE" >&2
  echo "Execute antes: ./scripts/backup-asaas-prod-env.sh" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

restore_key() {
  local key="$1"
  local line val
  line="$(grep -m1 "^${key}=" "$BACKUP_FILE" 2>/dev/null || true)"
  [ -n "$line" ] || return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  val="${val//\$\$/\$}"
  set_env_var "$key" "$val" "$ENV_FILE"
}

for key in PAYMENT_PROVIDER ASAAS_API_KEY ASAAS_PLATFORM_WALLET_ID ASAAS_WEBHOOK_TOKEN ASAAS_ENVIRONMENT ASAAS_DISABLED; do
  restore_key "$key"
done

echo "==> Asaas produção restaurado em $ENV_FILE"
echo "    ASAAS_ENVIRONMENT=$(env_get ASAAS_ENVIRONMENT "$ENV_FILE" || echo '?')"
echo "    ASAAS_PLATFORM_WALLET_ID=$(env_get ASAAS_PLATFORM_WALLET_ID "$ENV_FILE" || echo '?')"
echo ""
echo "Lembrete: confirme webhooks no painel Asaas PRODUÇÃO:"
DOMAIN="$(env_get DOMAIN "$ENV_FILE" 2>/dev/null || echo 'eventosbr.app.br')"
echo "  https://${DOMAIN}/api/webhooks/asaas"
echo "  https://${DOMAIN}/api/webhooks/asaas/transfer-auth"

if [ "$RELOAD" -eq 1 ]; then
  echo ""
  echo "==> Recriando api..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  echo "OK — api recriada. Teste: curl -s https://${DOMAIN}/ready"
else
  echo ""
  echo "Para aplicar no container:"
  echo "  docker compose -f $COMPOSE up -d --force-recreate api"
fi
