#!/usr/bin/env bash
# Restaura variáveis Asaas de produção a partir do backup.
#
# Uso:
#   ./scripts/restore-asaas-prod-env.sh [--reload]
#
# --reload  Reinicia apenas o serviço api (docker compose prod).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP="${BACKUP_FILE:-.env.asaas-prod-backup}"
RELOAD=0

for arg in "$@"; do
  case "$arg" in
    --reload) RELOAD=1 ;;
    -h|--help)
      echo "Uso: $0 [--reload]"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$BACKUP" ]; then
  echo "ERRO: backup não encontrado: $BACKUP" >&2
  echo "Execute antes: ./scripts/backup-asaas-prod-env.sh" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

restore_key() {
  local key="$1"
  local val
  val="$(env_get "$key" "$BACKUP" || true)"
  if [ -n "$val" ]; then
    set_env_var "$key" "$val" "$ENV_FILE"
  fi
}

restore_key PAYMENT_PROVIDER
restore_key ASAAS_API_KEY
restore_key ASAAS_PLATFORM_WALLET_ID
restore_key ASAAS_WEBHOOK_TOKEN
restore_key ASAAS_ENVIRONMENT
restore_key ASAAS_DISABLED
restore_key ASAAS_ONBOARDING_MODE
restore_key ASAAS_ALLOW_MANUAL_WALLET
restore_key ASAAS_CREATE_SUBACCOUNT_ON_REGISTER

echo "==> Produção restaurada em $ENV_FILE"
echo "    ASAAS_ENVIRONMENT=$(env_get ASAAS_ENVIRONMENT "$ENV_FILE" || echo production)"

if [ "$RELOAD" -eq 1 ]; then
  COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"
  echo "==> Reiniciando API..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
  for i in $(seq 1 24); do
    if curl -fsS --max-time 10 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
      echo "  OK  /ready"
      exit 0
    fi
    sleep 5
  done
  echo "AVISO: /ready ainda não respondeu — verifique: docker compose -f $COMPOSE logs api --tail=40" >&2
fi
