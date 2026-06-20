#!/usr/bin/env bash
# Verificação pós-deploy em produção (rodar no VPS após deploy).
set -euo pipefail
cd "$(dirname "$0")/.."

# Lê .env sem `source` (chaves Asaas contêm $ e quebram o bash).
env_get() {
  local key="$1"
  if [[ ! -f .env ]]; then
    return 1
  fi
  local line
  line="$(grep -m1 "^${key}=" .env 2>/dev/null || true)"
  [[ -n "$line" ]] || return 1
  local val="${line#*=}"
  val="${val%$'\r'}"
  # Docker Compose usa $$ para $ literal no .env
  val="${val//\$\$/\$}"
  printf '%s' "$val"
}

DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(env_get DOMAIN || true)"
fi
DOMAIN="${DOMAIN:-localhost}"
BASE="https://${DOMAIN}"
WWW_BASE="https://www.${DOMAIN}"

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
check "www → apex (redirect)" "curl -fsSI --max-time 15 '${WWW_BASE}/' | tr -d '\r' | grep -qiE '^location: https://${DOMAIN}'"
check "Webhook Asaas (405 sem POST)" "curl -fsS --max-time 15 -o /dev/null -w '%{http_code}' '${BASE}/api/webhooks/asaas' | grep -qE '405|422'"

if [[ -f .env ]]; then
  echo ""
  echo "==> Variáveis críticas (.env)"
  for var in DOMAIN PAYMENT_PROVIDER ASAAS_API_KEY ASAAS_WEBHOOK_TOKEN ASAAS_PLATFORM_WALLET_ID SECRET_KEY EMAIL_USER EMAIL_PASSWORD PLATFORM_ADMIN_API_KEY POSTGRES_PASSWORD CORS_ORIGINS; do
    if [[ -n "$(env_get "$var" || true)" ]]; then
      echo "  OK  $var definida"
    else
      echo "  AVISO  $var vazia"
      fail=1
    fi
  done

  payment_provider="$(env_get PAYMENT_PROVIDER || true)"
  if [[ "$payment_provider" != "asaas" ]]; then
    echo "  AVISO  PAYMENT_PROVIDER deve ser 'asaas' (atual: ${payment_provider:-vazio})"
    fail=1
  fi
  asaas_disabled="$(env_get ASAAS_DISABLED || true)"
  if [[ "${asaas_disabled:-false}" == "true" ]]; then
    echo "  AVISO  ASAAS_DISABLED=true — pagamentos desligados"
    fail=1
  fi
  environment="$(env_get ENVIRONMENT || true)"
  if [[ "$environment" != "production" ]]; then
    echo "  AVISO  ENVIRONMENT não é 'production' (atual: ${environment:-vazio})"
  fi
  cors_origins="$(env_get CORS_ORIGINS || true)"
  if echo "${cors_origins:-}" | grep -q '\*'; then
    echo "  AVISO  CORS_ORIGINS contém '*' — use URLs HTTPS explícitas"
    fail=1
  fi
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
