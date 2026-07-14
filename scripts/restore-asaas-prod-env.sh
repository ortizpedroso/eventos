#!/usr/bin/env bash
# Restaura variáveis Asaas de produção a partir do backup.
# Delega para restore-prod-env.sh (backup completo ou subset Asaas).
#
# Uso:
#   ./scripts/restore-asaas-prod-env.sh [--reload] [--force]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/restore-prod-env.sh" "$@"
