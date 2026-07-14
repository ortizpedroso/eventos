#!/usr/bin/env bash
# Salva variáveis Asaas de produção do .env (subset — use backup-prod-env.sh para backup completo).
#
# Uso:
#   ./scripts/backup-asaas-prod-env.sh
#
# Gera .env.asaas-prod-backup (gitignored). Para backup completo: ./scripts/backup-prod-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/.env" ]; then
  exec "$ROOT/scripts/backup-prod-env.sh"
fi

echo "ERRO: .env não encontrado" >&2
exit 1
