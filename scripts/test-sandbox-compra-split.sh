#!/usr/bin/env bash
# Wrapper: teste compra + split no sandbox Asaas (API local no VPS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -f .env.asaas-sandbox-pending ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.asaas-sandbox-pending
  set +a
fi
export EVENTOSBR_API_URL="${EVENTOSBR_API_URL:-http://127.0.0.1:8000}"
exec python3 "$ROOT/scripts/test-sandbox-compra-split.py" "$@"
