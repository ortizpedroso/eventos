#!/usr/bin/env bash
# Valida .env de produção (Asaas) antes do deploy.
#
# Uso: ./scripts/validate-env-production.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
errors=0

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  exit 1
fi

warn() { echo "AVISO: $*" >&2; }
fail() { echo "ERRO: $*" >&2; errors=$((errors + 1)); }

domain="$(env_get DOMAIN "$ENV_FILE" || true)"
[ -z "$domain" ] && fail "DOMAIN não definido"

pg="$(env_get POSTGRES_PASSWORD "$ENV_FILE" || true)"
[ -z "$pg" ] && fail "POSTGRES_PASSWORD não definido"
env_is_placeholder "$pg" && fail "POSTGRES_PASSWORD ainda é placeholder"

sk="$(env_get SECRET_KEY "$ENV_FILE" || true)"
if [ -z "$sk" ]; then
  fail "SECRET_KEY não definido"
elif [ "${#sk}" -lt 32 ]; then
  fail "SECRET_KEY curta (mínimo 32 caracteres)"
fi

provider="$(env_get PAYMENT_PROVIDER "$ENV_FILE" || true)"
if [ "$provider" != "asaas" ]; then
  fail "PAYMENT_PROVIDER deve ser 'asaas' (atual: ${provider:-vazio})"
fi

asaas_key="$(env_get ASAAS_API_KEY "$ENV_FILE" || true)"
asaas_disabled="$(env_get ASAAS_DISABLED "$ENV_FILE" || true)"
if env_is_placeholder "$asaas_key" || [ -z "$asaas_key" ]; then
  if [ "${asaas_disabled:-false}" != "true" ]; then
    warn "ASAAS_API_KEY ausente — defina chave ou ASAAS_DISABLED=true temporariamente"
  fi
fi

admin_key="$(env_get PLATFORM_ADMIN_API_KEY "$ENV_FILE" || true)"
env_is_placeholder "$admin_key" && warn "PLATFORM_ADMIN_API_KEY parece placeholder"

if [ "$errors" -gt 0 ]; then
  echo "" >&2
  echo "Corrija $ENV_FILE (./scripts/bootstrap-vps-env.sh ou ./scripts/generate-secrets.sh)." >&2
  exit 1
fi

echo "==> $ENV_FILE OK para deploy (DOMAIN=${domain}, PAYMENT_PROVIDER=asaas)"
