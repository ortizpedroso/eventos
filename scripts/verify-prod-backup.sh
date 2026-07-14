#!/usr/bin/env bash
# Verifica se o backup de produção contém todas as variáveis obrigatórias.
#
# Uso:
#   ./scripts/verify-prod-backup.sh
#   ./scripts/verify-prod-backup.sh .env.prod-backup

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"
# shellcheck source=scripts/prod-env-keys.sh
source "$ROOT/scripts/prod-env-keys.sh"

BACKUP="${1:-${PROD_BACKUP_FILE:-.env.prod-backup}}"
errors=0
warnings=0

if [ ! -f "$BACKUP" ]; then
  echo "ERRO: backup não encontrado: $BACKUP" >&2
  echo "  Execute: ./scripts/backup-prod-env.sh" >&2
  exit 1
fi

echo "==> Verificando backup: $BACKUP"
echo ""

for key in "${PROD_ENV_REQUIRED_KEYS[@]}"; do
  val="$(env_get "$key" "$BACKUP" 2>/dev/null || true)"
  if [ -z "$val" ] || env_is_placeholder "$val"; then
    echo "  FALTA  $key"
    errors=$((errors + 1))
  else
    echo "  OK     $key"
  fi
done

echo ""
echo "==> Variáveis opcionais presentes"
for key in "${PROD_ENV_KEYS[@]}"; do
  skip=0
  for req in "${PROD_ENV_REQUIRED_KEYS[@]}"; do
    [ "$req" = "$key" ] && skip=1 && break
  done
  [ "$skip" -eq 1 ] && continue
  val="$(env_get "$key" "$BACKUP" 2>/dev/null || true)"
  if [ -n "$val" ] && ! env_is_placeholder "$val"; then
    echo "  OK     $key"
  else
    echo "  —      $key (ausente ou vazio)"
    warnings=$((warnings + 1))
  fi
done

echo ""
if [ "$errors" -gt 0 ]; then
  echo "❌ Backup incompleto: $errors variável(is) obrigatória(s) faltando." >&2
  exit 1
fi

echo "✅ Backup válido ($errors faltas, $warnings opcionais ausentes)."
if [ "$warnings" -gt 0 ]; then
  echo "   Opcionais ausentes não bloqueiam restauração."
fi
