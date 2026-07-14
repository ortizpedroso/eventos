#!/usr/bin/env bash
# Restaura .env de produção a partir do backup completo.
#
# Uso:
#   ./scripts/restore-prod-env.sh [--reload] [--force]
#
# Ordem de leitura: .env.prod-backup → .env.asaas-prod-backup (só chaves Asaas)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"
# shellcheck source=scripts/prod-env-keys.sh
source "$ROOT/scripts/prod-env-keys.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP="${PROD_BACKUP_FILE:-.env.prod-backup}"
ASAAS_BACKUP="${BACKUP_FILE:-.env.asaas-prod-backup}"
RELOAD=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --reload) RELOAD=1 ;;
    --force) FORCE=1 ;;
    -h|--help)
      echo "Uso: $0 [--reload] [--force]"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  if [ -f .env.production.example ]; then
    cp .env.production.example "$ENV_FILE"
    echo "==> Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não encontrado" >&2
    exit 1
  fi
fi

SOURCE="$BACKUP"
if [ ! -f "$SOURCE" ]; then
  if [ -f "$ASAAS_BACKUP" ]; then
    SOURCE="$ASAAS_BACKUP"
    echo "AVISO: $BACKUP ausente — usando subset Asaas $ASAAS_BACKUP" >&2
  else
    echo "ERRO: nenhum backup encontrado ($BACKUP ou $ASAAS_BACKUP)" >&2
    echo "  Execute: ./scripts/backup-prod-env.sh" >&2
    exit 1
  fi
fi

restore_key() {
  local key="$1"
  local val
  val="$(env_get "$key" "$SOURCE" 2>/dev/null || true)"
  [ -n "$val" ] || return 0

  current="$(env_get "$key" "$ENV_FILE" 2>/dev/null || true)"
  if [ "$FORCE" -eq 0 ] && [ -n "$current" ] && ! env_is_placeholder "$current"; then
    return 0
  fi
  set_env_var "$key" "$val" "$ENV_FILE"
}

if [ "$SOURCE" = "$BACKUP" ]; then
  for key in "${PROD_ENV_KEYS[@]}"; do
    restore_key "$key"
  done
else
  for key in PAYMENT_PROVIDER ASAAS_API_KEY ASAAS_PLATFORM_WALLET_ID ASAAS_WEBHOOK_TOKEN \
    ASAAS_ENVIRONMENT ASAAS_DISABLED ASAAS_ONBOARDING_MODE ASAAS_ALLOW_MANUAL_WALLET \
    ASAAS_CREATE_SUBACCOUNT_ON_REGISTER; do
    restore_key "$key"
  done
fi

echo "==> Produção restaurada em $ENV_FILE (fonte: $SOURCE)"
echo "    DOMAIN=$(env_get DOMAIN "$ENV_FILE" || true)"
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
  echo "AVISO: /ready ainda não respondeu" >&2
fi
