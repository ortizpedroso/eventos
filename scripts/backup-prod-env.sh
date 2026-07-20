#!/usr/bin/env bash
# Backup completo do .env de produção (todas as variáveis críticas).
#
# Uso:
#   ./scripts/backup-prod-env.sh
#
# Gera .env.prod-backup (gitignored). Também atualiza .env.asaas-prod-backup (subset Asaas).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"
# shellcheck source=scripts/prod-env-keys.sh
source "$ROOT/scripts/prod-env-keys.sh"

ENV_FILE="${ENV_FILE:-.env}"
BACKUP="${PROD_BACKUP_FILE:-.env.prod-backup}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado" >&2
  exit 1
fi

{
  echo "# Backup produção EventosBR — NÃO COMMITAR (gitignore)"
  echo "# Gerado em $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "# Restaurar: ./scripts/restore-prod-env.sh [--reload]"
  echo "# Verificar: ./scripts/verify-prod-backup.sh"
  for key in "${PROD_ENV_KEYS[@]}"; do
    val="$(env_get "$key" "$ENV_FILE" 2>/dev/null || true)"
    [ -n "$val" ] || continue
    case "$key" in
      ASAAS_API_KEY|ASAAS_WEBHOOK_TOKEN|SECRET_KEY|POSTGRES_PASSWORD|EMAIL_PASSWORD|PLATFORM_ADMIN_API_KEY)
        printf '%s=%s\n' "$key" "$(docker_env_escape "$val")"
        ;;
      *)
        printf '%s=%s\n' "$key" "$val"
        ;;
    esac
  done
} >"$BACKUP"

chmod 600 "$BACKUP" 2>/dev/null || true

# Subset Asaas (compatibilidade com scripts antigos)
ASAAS_BACKUP="${BACKUP_FILE:-.env.asaas-prod-backup}"
{
  echo "# Backup Asaas produção — NÃO COMMITAR (gitignore)"
  echo "# Gerado em $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "# Restaurar: ./scripts/restore-asaas-prod-env.sh [--reload]"
  for key in PAYMENT_PROVIDER ASAAS_API_KEY ASAAS_PLATFORM_WALLET_ID ASAAS_WEBHOOK_TOKEN \
    ASAAS_ENVIRONMENT ASAAS_DISABLED ASAAS_ONBOARDING_MODE ASAAS_ALLOW_MANUAL_WALLET \
    ASAAS_CREATE_SUBACCOUNT_ON_REGISTER; do
    val="$(env_get "$key" "$BACKUP" 2>/dev/null || true)"
    [ -n "$val" ] || continue
    case "$key" in
      ASAAS_API_KEY|ASAAS_WEBHOOK_TOKEN)
        printf '%s=%s\n' "$key" "$(docker_env_escape "$val")"
        ;;
      *)
        printf '%s=%s\n' "$key" "$val"
        ;;
    esac
  done
} >"$ASAAS_BACKUP"
chmod 600 "$ASAAS_BACKUP" 2>/dev/null || true

written=0
for key in "${PROD_ENV_KEYS[@]}"; do
  if env_get "$key" "$BACKUP" >/dev/null 2>&1; then
    written=$((written + 1))
  fi
done

echo "==> Backup completo gravado em $BACKUP ($written variáveis)"
echo "    DOMAIN=$(env_get DOMAIN "$BACKUP" 2>/dev/null || true)"
echo "    ASAAS_ENVIRONMENT=$(env_get ASAAS_ENVIRONMENT "$BACKUP" 2>/dev/null || echo production)"
echo "    ASAAS_PLATFORM_WALLET_ID=$(env_get ASAAS_PLATFORM_WALLET_ID "$BACKUP" 2>/dev/null || true)"
