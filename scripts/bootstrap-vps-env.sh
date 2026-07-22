#!/usr/bin/env bash
# Preenche .env de produção no VPS (Asaas — sem Stripe).
#
# Uso:
#   ./scripts/bootstrap-vps-env.sh
#   ./scripts/bootstrap-vps-env.sh --reset-db-secret
#   DOMAIN=eventosbr.app.br ./scripts/bootstrap-vps-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

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

old_asaas_key="" old_asaas_wh="" old_asaas_wallet="" old_email_pass="" old_google=""
if [ -f "$ENV_FILE" ]; then
  old_asaas_key="$(env_get ASAAS_API_KEY "$ENV_FILE" || true)"
  old_asaas_wh="$(env_get ASAAS_WEBHOOK_TOKEN "$ENV_FILE" || true)"
  old_asaas_wallet="$(env_get ASAAS_PLATFORM_WALLET_ID "$ENV_FILE" || true)"
  old_email_pass="$(env_get EMAIL_PASSWORD "$ENV_FILE" || true)"
  old_google="$(env_get GOOGLE_OAUTH_CLIENT_ID "$ENV_FILE" || true)"
fi

SECRET_KEY="$(env_get SECRET_KEY "$ENV_FILE" || true)"
PLATFORM_ADMIN_API_KEY="$(env_get PLATFORM_ADMIN_API_KEY "$ENV_FILE" || true)"
POSTGRES_PASSWORD="$(env_get POSTGRES_PASSWORD "$ENV_FILE" || true)"
ASAAS_WEBHOOK_TOKEN="${old_asaas_wh:-}"

env_is_placeholder "$SECRET_KEY" && SECRET_KEY="$(_rand 48)"
env_is_placeholder "$PLATFORM_ADMIN_API_KEY" && PLATFORM_ADMIN_API_KEY="$(_rand 32)"
if env_is_placeholder "$POSTGRES_PASSWORD" || [ "$RESET_DB" -eq 1 ]; then
  POSTGRES_PASSWORD="$(_rand 24)"
  echo "==> Nova POSTGRES_PASSWORD gerada (sync-postgres-password-vps.sh em seguida)"
fi
env_is_placeholder "$ASAAS_WEBHOOK_TOKEN" && ASAAS_WEBHOOK_TOKEN="$(_rand 32)"

ASAAS_API_KEY="$old_asaas_key"
ASAAS_PLATFORM_WALLET_ID="$old_asaas_wallet"
ASAAS_DISABLED="false"
ASAAS_ENVIRONMENT="production"
if env_is_placeholder "$ASAAS_API_KEY" || [ -z "$ASAAS_API_KEY" ]; then
  ASAAS_API_KEY=""
  ASAAS_DISABLED="true"
  echo "==> AVISO: Asaas sem chave — ASAAS_DISABLED=true (site sobe; pagamentos depois)"
fi

EMAIL_PASSWORD="${old_email_pass:-}"
GOOGLE_OAUTH_CLIENT_ID="${old_google:-}"

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
fi

cat >"$ENV_FILE" <<EOF
# Gerado por scripts/bootstrap-vps-env.sh em $(date -Iseconds)
# Domínio: ${DOMAIN}

DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
NEXT_PUBLIC_API_URL=https://${DOMAIN}
FRONTEND_PUBLIC_URL=https://${DOMAIN}
NEXT_PUBLIC_PAYMENT_PROVIDER=asaas

GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=$(docker_env_escape "${ASAAS_API_KEY}")
ASAAS_WEBHOOK_TOKEN=${ASAAS_WEBHOOK_TOKEN}
ASAAS_ENVIRONMENT=${ASAAS_ENVIRONMENT}
ASAAS_DISABLED=${ASAAS_DISABLED}
ASAAS_PLATFORM_WALLET_ID=${ASAAS_PLATFORM_WALLET_ID}
ASAAS_CREATE_SUBACCOUNT_ON_REGISTER=false
ASAAS_ALLOW_MANUAL_WALLET=false
ASAAS_ONBOARDING_MODE=baas

SECRET_KEY=${SECRET_KEY}
PLATFORM_ADMIN_API_KEY=${PLATFORM_ADMIN_API_KEY}

EMAIL_SERVER=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_USER=noreply@${DOMAIN}
EMAIL_PASSWORD=${EMAIL_PASSWORD}
EMAIL_FROM_NAME=EventosBR
EMAIL_USE_TLS=true

REDIS_URL=redis://redis:6379
RATE_LIMIT_USE_REDIS=true
TICKET_EMAIL_USE_REDIS=true

CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

TRUST_FORWARDED_HEADERS=true
ENVIRONMENT=production
DEBUG=False
EOF

chmod 600 "$ENV_FILE" 2>/dev/null || true

if [ -f .env.prod-backup ] || [ -f .env.asaas-prod-backup ]; then
  asaas_key="$(env_get ASAAS_API_KEY .env 2>/dev/null || true)"
  if env_is_placeholder "$asaas_key" || [ -z "$asaas_key" ]; then
    echo "==> Backup produção encontrado — aplicando credenciais..."
    ./scripts/sync-asaas-prod-from-backup.sh || true
  fi
fi

echo ""
echo "==> $ENV_FILE escrito (Asaas — sem Stripe)."
echo "    (secrets gravados em $ENV_FILE — não precisa copiar manualmente)"
