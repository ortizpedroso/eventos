#!/usr/bin/env bash
# Primeiro deploy no VPS — EventosBR (eventosbr.app.br).
# Execute no servidor após clonar o repositório e configurar DNS.
#
# Uso:
#   cd /opt/eventosbr
#   ./scripts/first-deploy-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN_DEFAULT="eventosbr.app.br"
VPS_IP_DEFAULT="187.77.240.125"

echo "==> EventosBR — primeiro deploy"
echo ""

if ! command -v docker >/dev/null 2>&1; then
  echo "ERRO: Docker não instalado. Instale Docker + Compose v2 no VPS." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.production.example .env
  echo "Criado .env a partir de .env.production.example"
fi

# Garante domínio correto no .env
set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >>.env
  fi
}

set_env "DOMAIN" "$DOMAIN_DEFAULT"
set_env "ACME_EMAIL" "admin@${DOMAIN_DEFAULT}"
set_env "NEXT_PUBLIC_API_URL" "https://${DOMAIN_DEFAULT}"
set_env "FRONTEND_PUBLIC_URL" "https://${DOMAIN_DEFAULT}"
set_env "CORS_ORIGINS" "https://${DOMAIN_DEFAULT},https://www.${DOMAIN_DEFAULT}"
set_env "PAYMENT_PROVIDER" "asaas"
set_env "NEXT_PUBLIC_PAYMENT_PROVIDER" "asaas"
set_env "ENVIRONMENT" "production"
set_env "DEBUG" "False"
set_env "TRUST_FORWARDED_HEADERS" "true"

echo ""
echo "==> Verificando DNS (opcional)"
if ./scripts/check-dns-production.sh "$DOMAIN_DEFAULT" "$VPS_IP_DEFAULT"; then
  :
else
  echo ""
  echo "AVISO: DNS ainda não aponta para o VPS. O deploy pode subir, mas HTTPS só funciona após o DNS."
  read -r -p "Continuar mesmo assim? [s/N] " ans || true
  case "${ans:-N}" in
    s|S|y|Y) ;;
    *) exit 1 ;;
  esac
fi

echo ""
echo "==> Secrets vazios?"
if grep -qE '^(SECRET_KEY|POSTGRES_PASSWORD|PLATFORM_ADMIN_API_KEY)=GERE_' .env 2>/dev/null; then
  echo "Execute: ./scripts/generate-secrets.sh"
  echo "Copie os valores gerados para o .env (SECRET_KEY, POSTGRES_PASSWORD, PLATFORM_ADMIN_API_KEY, ASAAS_WEBHOOK_TOKEN)."
fi

echo ""
echo "==> Asaas configurado?"
if grep -qE '^ASAAS_API_KEY=\$aact_prod_\.\.\.' .env 2>/dev/null || grep -qE '^ASAAS_API_KEY=$' .env 2>/dev/null; then
  echo "Execute: ./scripts/configure-asaas-env.sh"
  echo "Ou preencha manualmente ASAAS_API_KEY e ASAAS_PLATFORM_WALLET_ID no .env"
fi

echo ""
echo "==> Subindo stack de produção"
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "==> Aguardando containers"
sleep 15
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Próximos passos:"
echo "  1. Webhook Asaas: https://${DOMAIN_DEFAULT}/api/webhooks/asaas"
echo "  2. ./scripts/verify-production.sh"
echo "  3. https://${DOMAIN_DEFAULT}/admin/dashboard → aba Produção"
echo "  4. Organizador → Financeiro → walletId Asaas"
