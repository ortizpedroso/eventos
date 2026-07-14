#!/usr/bin/env bash
# Aplica credenciais de produção do backup no .env (sem sobrescrever secrets já válidos).
#
# Uso:
#   ./scripts/sync-asaas-prod-from-backup.sh
#   ./scripts/sync-asaas-prod-from-backup.sh --force
#
# Lê .env.prod-backup (completo) ou .env.asaas-prod-backup (subset Asaas).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

if [ -f .env.prod-backup ]; then
  args=()
  [ "$FORCE" -eq 1 ] && args+=(--force)
  exec "$ROOT/scripts/restore-prod-env.sh" "${args[@]}"
fi

if [ -f .env.asaas-prod-backup ]; then
  PROD_BACKUP_FILE=.env.asaas-prod-backup
  args=()
  [ "$FORCE" -eq 1 ] && args+=(--force)
  exec "$ROOT/scripts/restore-prod-env.sh" "${args[@]}"
fi

echo "ERRO: nenhum backup encontrado (.env.prod-backup ou .env.asaas-prod-backup)" >&2
echo "  Execute: ./scripts/backup-prod-env.sh" >&2
echo "  Ou: cp .env.prod-backup.example .env.prod-backup && edite" >&2
exit 1
