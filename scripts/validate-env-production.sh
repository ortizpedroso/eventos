#!/usr/bin/env bash
# Valida .env de produção antes do deploy (evita API em loop por SECRET_KEY ou senha placeholder).
#
# Uso: ./scripts/validate-env-production.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
errors=0

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

warn() { echo "AVISO: $*" >&2; }
fail() { echo "ERRO: $*" >&2; errors=$((errors + 1)); }

_placeholder() {
  case "${1:-}" in
    ""|*GERE_*|*GERE_COM_*|*cole_aqui*|*changeme*|*sua-chave-secreta*|*whsec_...*|*sk_live_...*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

[ -z "${DOMAIN:-}" ] && fail "DOMAIN não definido"
[ -z "${POSTGRES_PASSWORD:-}" ] && fail "POSTGRES_PASSWORD não definido"
_placeholder "${POSTGRES_PASSWORD:-}" && fail "POSTGRES_PASSWORD ainda é placeholder"

sk="${SECRET_KEY:-}"
if [ -z "$sk" ]; then
  fail "SECRET_KEY não definido (obrigatório em produção)"
elif [ "${#sk}" -lt 32 ]; then
  fail "SECRET_KEY curta (mínimo 32 caracteres)"
fi

_placeholder "${PLATFORM_ADMIN_API_KEY:-}" && warn "PLATFORM_ADMIN_API_KEY parece placeholder"

if [ "$errors" -gt 0 ]; then
  echo "" >&2
  echo "Corrija $ENV_FILE antes do deploy (./scripts/generate-secrets.sh na 1ª vez)." >&2
  exit 1
fi

echo "==> $ENV_FILE OK para deploy (DOMAIN=${DOMAIN})"
