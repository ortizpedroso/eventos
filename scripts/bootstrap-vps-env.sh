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

# Usa <<'EOF' (sem expansão) e escreve cada variável com printf para evitar que valores com
# $, backticks ou aspas sejam expandidos pelo bash durante a escrita do arquivo.
_write_env() {
  local key="$1"
  local val="$2"
  printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
}

: > "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

printf '# Gerado por scripts/bootstrap-vps-env.sh em %s\n' "$(date -Iseconds)" >> "$ENV_FILE"
printf '# Domínio: %s\n\n' "$DOMAIN" >> "$ENV_FILE"

_write_env "DOMAIN"                     "$DOMAIN"
_write_env "ACME_EMAIL"                 "$ACME_EMAIL"
_write_env "NEXT_PUBLIC_API_URL"        "https://${DOMAIN}"
_write_env "FRONTEND_PUBLIC_URL"        "https://${DOMAIN}"
_write_env "NEXT_PUBLIC_PAYMENT_PROVIDER" "asaas"
printf '\n' >> "$ENV_FILE"

_write_env "GOOGLE_OAUTH_CLIENT_ID"            "$GOOGLE_OAUTH_CLIENT_ID"
_write_env "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID" "$GOOGLE_OAUTH_CLIENT_ID"
printf '\n' >> "$ENV_FILE"

_write_env "POSTGRES_PASSWORD"          "$POSTGRES_PASSWORD"
printf '\n' >> "$ENV_FILE"

_write_env "PAYMENT_PROVIDER"           "asaas"
# ASAAS_API_KEY pode conter $ — Docker Compose exige $$ para $ literal no .env.
_write_env "ASAAS_API_KEY"              "$(docker_env_escape "${ASAAS_API_KEY}")"
_write_env "ASAAS_WEBHOOK_TOKEN"        "$ASAAS_WEBHOOK_TOKEN"
_write_env "ASAAS_ENVIRONMENT"          "$ASAAS_ENVIRONMENT"
_write_env "ASAAS_DISABLED"             "$ASAAS_DISABLED"
_write_env "ASAAS_PLATFORM_WALLET_ID"   "$ASAAS_PLATFORM_WALLET_ID"
_write_env "ASAAS_CREATE_SUBACCOUNT_ON_REGISTER" "false"
_write_env "ASAAS_ALLOW_MANUAL_WALLET"  "false"
printf '\n' >> "$ENV_FILE"

_write_env "SECRET_KEY"                 "$SECRET_KEY"
_write_env "PLATFORM_ADMIN_API_KEY"     "$PLATFORM_ADMIN_API_KEY"
printf '\n' >> "$ENV_FILE"

_write_env "EMAIL_SERVER"               "smtp.hostinger.com"
_write_env "EMAIL_PORT"                 "587"
_write_env "EMAIL_USER"                 "noreply@${DOMAIN}"
_write_env "EMAIL_PASSWORD"             "$EMAIL_PASSWORD"
_write_env "EMAIL_FROM_NAME"            "EventosBR"
_write_env "EMAIL_USE_TLS"              "true"
printf '\n' >> "$ENV_FILE"

_write_env "REDIS_URL"                  "redis://redis:6379"
_write_env "RATE_LIMIT_USE_REDIS"       "true"
_write_env "TICKET_EMAIL_USE_REDIS"     "true"
printf '\n' >> "$ENV_FILE"

_write_env "CORS_ORIGINS"               "https://${DOMAIN},https://www.${DOMAIN}"
printf '\n' >> "$ENV_FILE"

_write_env "TRUST_FORWARDED_HEADERS"    "true"
_write_env "ENVIRONMENT"                "production"
_write_env "DEBUG"                      "False"

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo ""
echo "==> $ENV_FILE escrito (Asaas — sem Stripe)."
echo "    (secrets gravados em $ENV_FILE — não precisa copiar manualmente)"
