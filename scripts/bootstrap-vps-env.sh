#!/usr/bin/env bash
# Preenche ou recria .env de produção no VPS (domínio eventosbr.app.br por defeito).
#
# Uso:
#   ./scripts/bootstrap-vps-env.sh                    # só chaves em falta / placeholder
#   ./scripts/bootstrap-vps-env.sh --reset-db-secret  # nova POSTGRES_PASSWORD + sync depois
#   DOMAIN=meudominio.com.br ./scripts/bootstrap-vps-env.sh
#
# Não commite o .env gerado.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
DOMAIN="${DOMAIN:-eventosbr.app.br}"
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"
RESET_DB=0

for arg in "$@"; do
  case "$arg" in
    --reset-db-secret) RESET_DB=1 ;;
    -h|--help)
      echo "Uso: $0 [--reset-db-secret]"
      exit 0
      ;;
  esac
done

_rand() {
  local nbytes="${1:-32}"
  openssl rand -base64 "$nbytes" | tr -d '\n=' | tr '+/' '-_'
}

_is_placeholder() {
  case "${1:-}" in
    ""|*GERE_*|*GERE_COM_*|*cole_aqui*|*changeme*|*sua-chave-secreta*|*sk_live_...*|*pk_live_...*|*whsec_...*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Valores preservados do .env anterior (Stripe, SMTP, OAuth…)
old_stripe_sk="" old_stripe_pk="" old_stripe_wh="" old_email_pass="" old_google=""
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE" 2>/dev/null || true
  set +a
  old_stripe_sk="${STRIPE_SECRET_KEY:-}"
  old_stripe_pk="${STRIPE_PUBLISHABLE_KEY:-}"
  old_stripe_wh="${STRIPE_WEBHOOK_SECRET:-}"
  old_email_pass="${EMAIL_PASSWORD:-}"
  old_google="${GOOGLE_OAUTH_CLIENT_ID:-}"
fi

SECRET_KEY="${SECRET_KEY:-}"
PLATFORM_ADMIN_API_KEY="${PLATFORM_ADMIN_API_KEY:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

_is_placeholder "$SECRET_KEY" && SECRET_KEY="$(_rand 48)"
_is_placeholder "$PLATFORM_ADMIN_API_KEY" && PLATFORM_ADMIN_API_KEY="$(_rand 32)"
if _is_placeholder "$POSTGRES_PASSWORD" || [ "$RESET_DB" -eq 1 ]; then
  POSTGRES_PASSWORD="$(_rand 24)"
  echo "==> Nova POSTGRES_PASSWORD gerada (rode sync-postgres-password-vps.sh em seguida)"
fi

# Stripe: preserva se já válido; senão deixa vazio e desativa gateway até configurar
STRIPE_SECRET_KEY="$old_stripe_sk"
STRIPE_PUBLISHABLE_KEY="$old_stripe_pk"
STRIPE_WEBHOOK_SECRET="$old_stripe_wh"
STRIPE_DISABLED="${STRIPE_DISABLED:-false}"
STRIPE_SKIP_CONNECT_ON_REGISTER="${STRIPE_SKIP_CONNECT_ON_REGISTER:-true}"
NEXT_PUBLIC_STRIPE_DISABLED=""
if _is_placeholder "$STRIPE_SECRET_KEY" || _is_placeholder "$STRIPE_PUBLISHABLE_KEY"; then
  STRIPE_SECRET_KEY=""
  STRIPE_PUBLISHABLE_KEY=""
  STRIPE_DISABLED="true"
  STRIPE_SKIP_CONNECT_ON_REGISTER="true"
  NEXT_PUBLIC_STRIPE_DISABLED="true"
  echo "==> AVISO: Stripe não configurado — STRIPE_DISABLED=true até colar chaves live no .env"
fi

EMAIL_PASSWORD="${EMAIL_PASSWORD:-$old_email_pass}"
GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID:-$old_google}"

stripe_public_extra=""
if [ "$NEXT_PUBLIC_STRIPE_DISABLED" = "true" ]; then
  stripe_public_extra="NEXT_PUBLIC_STRIPE_DISABLED=true"
fi

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
fi

cat >"$ENV_FILE" <<EOF
# Gerado/atualizado por scripts/bootstrap-vps-env.sh em $(date -Iseconds)
# Domínio: ${DOMAIN}

DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
NEXT_PUBLIC_API_URL=https://${DOMAIN}
FRONTEND_PUBLIC_URL=https://${DOMAIN}

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

SECRET_KEY=${SECRET_KEY}
PLATFORM_ADMIN_API_KEY=${PLATFORM_ADMIN_API_KEY}

STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_DISABLED=${STRIPE_DISABLED}
STRIPE_SKIP_CONNECT_ON_REGISTER=${STRIPE_SKIP_CONNECT_ON_REGISTER}

GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}

EMAIL_SERVER=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_USER=noreply@${DOMAIN}
EMAIL_PASSWORD=${EMAIL_PASSWORD}
EMAIL_FROM_NAME=EventosBR

REDIS_URL=redis://redis:6379
RATE_LIMIT_USE_REDIS=true
TICKET_EMAIL_USE_REDIS=true
TICKET_EMAIL_MAX_ATTEMPTS=3

CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

TRUST_FORWARDED_HEADERS=true
ENVIRONMENT=production
DEBUG=False
${stripe_public_extra}
EOF

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo ""
echo "==> $ENV_FILE escrito."
echo "    Guarde num gestor de senhas:"
echo "    POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "    SECRET_KEY=${SECRET_KEY}"
echo "    PLATFORM_ADMIN_API_KEY=${PLATFORM_ADMIN_API_KEY}"
echo ""
echo "    Próximo passo: ./scripts/recover-vps.sh"
