#!/usr/bin/env bash
# Preenche Cloudflare Turnstile no .env de produção (API + build do frontend).
#
# Uso interativo:
#   ./scripts/configure-turnstile-env.sh
#
# Uso não interativo:
#   ./scripts/configure-turnstile-env.sh \
#     --secret-key '0x...' \
#     --site-key '0x...'
#
# Após gravar: rebuild do frontend (site key no bundle) + recriar API:
#   docker compose -f docker-compose.prod.yml up -d --build web
#   docker compose -f docker-compose.prod.yml up -d api

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
EXAMPLE="$ROOT/.env.production.example"

SECRET_KEY=""
SITE_KEY=""

usage() {
  echo "Uso: $0 [--secret-key KEY] [--site-key KEY]"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --secret-key) SECRET_KEY="$2"; shift 2 ;;
    --site-key) SITE_KEY="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Criado $ENV_FILE a partir de .env.production.example"
  else
    echo "ERRO: $ENV_FILE não existe" >&2
    exit 1
  fi
fi

if [ -z "$SECRET_KEY" ]; then
  read -r -p "TURNSTILE_SECRET_KEY (Cloudflare Turnstile — Secret): " SECRET_KEY
fi
if [ -z "$SITE_KEY" ]; then
  read -r -p "NEXT_PUBLIC_TURNSTILE_SITE_KEY (Site Key — mesma widget): " SITE_KEY
fi

if [ -z "$SECRET_KEY" ] || [ -z "$SITE_KEY" ]; then
  echo "ERRO: ambas as chaves são obrigatórias." >&2
  exit 1
fi

set_env_var "TURNSTILE_SECRET_KEY" "$SECRET_KEY" "$ENV_FILE"
set_env_var "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "$SITE_KEY" "$ENV_FILE"

echo ""
echo "==> Turnstile gravado em $ENV_FILE"
echo "    Próximo passo no VPS:"
echo "      docker compose -f docker-compose.prod.yml up -d --build web"
echo "      docker compose -f docker-compose.prod.yml up -d api"
echo ""
echo "    Validar: bash scripts/validar-go-live-vps.sh"
