#!/usr/bin/env bash
# Verificação pós-deploy em produção (rodar no VPS após deploy).
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" && -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi
DOMAIN="${DOMAIN:-localhost}"
BASE="https://${DOMAIN}"

echo "==> EventosBR — verificação de produção"
echo "    Domínio: $DOMAIN"
echo ""

fail=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  OK  $name"
  else
    echo "  FALHA  $name"
    fail=1
  fi
}

check "GET /health" "curl -fsS --max-time 15 '${BASE}/health' | grep -q '\"status\"'"
check "GET /ready (DB)" "curl -fsS --max-time 15 '${BASE}/ready' | grep -q '\"database\"'"
check "Front página inicial" "curl -fsS --max-time 15 -o /dev/null -w '%{http_code}' '${BASE}/' | grep -qE '200|307'"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
  echo ""
  echo "==> Variáveis críticas (.env)"
  for var in PAYMENT_PROVIDER ASAAS_API_KEY ASAAS_WEBHOOK_TOKEN ASAAS_PLATFORM_WALLET_ID SECRET_KEY EMAIL_USER EMAIL_PASSWORD PLATFORM_ADMIN_API_KEY; do
    if [[ -n "${!var:-}" ]]; then
      echo "  OK  $var definida"
    else
      echo "  AVISO  $var vazia"
      fail=1
    fi
  done
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Verificação concluída sem falhas críticas."
  echo "Próximo: configurar webhook Asaas → ${BASE}/api/webhooks/asaas"
  echo "Painel admin → /admin/dashboard → aba Produção"
else
  echo "Há falhas — corrija antes de anunciar go-live."
  exit 1
fi
