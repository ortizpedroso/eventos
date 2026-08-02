#!/usr/bin/env bash
# Grava site key do widget Turnstile existente (sem API Cloudflare).
# O secret você define como TURNSTILE_SECRET no .env / ambiente da API.
#
# Uso:
#   ./scripts/wire-existing-turnstile.sh
#   ./scripts/wire-existing-turnstile.sh --site-key 0x4AAAA...

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
SITE_KEY="${TURNSTILE_SITE_KEY:-0x4AAAAAAEEo9-dlOUxCWAz5}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --site-key) SITE_KEY="$2"; shift 2 ;;
    *) echo "unknown $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$ENV_FILE" ] && [ -f .env.production.example ]; then
  cp .env.production.example "$ENV_FILE"
fi

set_env_var "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "$SITE_KEY" "$ENV_FILE"

echo "==> Site key gravada em $ENV_FILE (NEXT_PUBLIC_TURNSTILE_SITE_KEY)"
echo "    Defina o secret na API (não commitar):"
echo "      TURNSTILE_SECRET=<secret do painel Turnstile>"
echo "    Legado aceito: TURNSTILE_SECRET_KEY (mesmo valor)"
echo ""
echo "    Rebuild frontend (site key no bundle):"
echo "      docker compose -f docker-compose.prod.yml up -d --build web"
echo "      docker compose -f docker-compose.prod.yml up -d api"
echo ""
if [ -n "${TURNSTILE_SECRET:-}" ]; then
  echo "==> Validando TURNSTILE_SECRET do ambiente..."
  export TURNSTILE_SECRET_KEY="" # força uso do canônico
  ./scripts/turnstile-spin/validate.sh
else
  echo "    Validação: export TURNSTILE_SECRET=... && ./scripts/turnstile-spin/validate.sh"
fi
