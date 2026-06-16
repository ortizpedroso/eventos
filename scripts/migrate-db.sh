#!/usr/bin/env bash
# Aplica migrações Alembic (produção / Docker / VPS).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DATABASE_URL:?Defina DATABASE_URL no .env}"

echo "==> alembic upgrade head (${DATABASE_URL%%@*}@...)"
alembic upgrade head
alembic current
