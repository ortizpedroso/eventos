#!/usr/bin/env bash
# Aplica credenciais Asaas de produção do backup no .env (sem sobrescrever secrets já válidos).
#
# Uso:
#   ./scripts/sync-asaas-prod-from-backup.sh
#   ./scripts/sync-asaas-prod-from-backup.sh --force   # sobrescreve mesmo com chave presente
#
# Cenário: .env foi recriado por bootstrap mas .env.asaas-prod-backup guarda produção.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP="${BACKUP_FILE:-.env.asaas-prod-backup}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      echo "Uso: $0 [--force]"
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
  echo "  Crie com: ./scripts/backup-asaas-prod-env.sh (quando .env tiver produção)" >&2
  echo "  Ou copie: cp .env.asaas-prod-backup.example $BACKUP && edite com credenciais reais" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  if [ -f .env.production.example ]; then
    cp .env.production.example "$ENV_FILE"
    echo "==> Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

KEYS=(
  PAYMENT_PROVIDER
  ASAAS_API_KEY
  ASAAS_PLATFORM_WALLET_ID
  ASAAS_WEBHOOK_TOKEN
  ASAAS_ENVIRONMENT
  ASAAS_DISABLED
  ASAAS_ONBOARDING_MODE
  ASAAS_ALLOW_MANUAL_WALLET
  ASAAS_CREATE_SUBACCOUNT_ON_REGISTER
)

applied=0
skipped=0

for key in "${KEYS[@]}"; do
  backup_val="$(env_get "$key" "$BACKUP" 2>/dev/null || true)"
  [ -n "$backup_val" ] || continue

  current_val="$(env_get "$key" "$ENV_FILE" 2>/dev/null || true)"
  if [ "$FORCE" -eq 0 ] && [ -n "$current_val" ] && ! env_is_placeholder "$current_val"; then
    skipped=$((skipped + 1))
    continue
  fi

  set_env_var "$key" "$backup_val" "$ENV_FILE"
  applied=$((applied + 1))
done

echo "==> Sync Asaas produção: $BACKUP → $ENV_FILE"
echo "    Aplicadas: $applied variáveis | Mantidas: $skipped"
echo "    ASAAS_ENVIRONMENT=$(env_get ASAAS_ENVIRONMENT "$ENV_FILE" || echo production)"
echo "    ASAAS_PLATFORM_WALLET_ID=$(env_get ASAAS_PLATFORM_WALLET_ID "$ENV_FILE" || true)"

if [ "$applied" -eq 0 ] && [ "$FORCE" -eq 0 ]; then
  echo "AVISO: nada aplicado — .env já tem credenciais ou backup vazio." >&2
  echo "  Use --force para sobrescrever." >&2
fi
