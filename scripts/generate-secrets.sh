#!/usr/bin/env sh
# Gera SECRET_KEY, PLATFORM_ADMIN_API_KEY e POSTGRES_PASSWORD.
# Uso: ./scripts/generate-secrets.sh

set -euo pipefail

secret_key="$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')"
admin_key="$(openssl rand -base64 32 | tr -d '\n=' | tr '+/' '-_')"
pg_pass="$(openssl rand -base64 24 | tr -d '\n=' | tr '+/' '_')"

echo "Cole no .env de producao (nao commite):"
echo ""
echo "SECRET_KEY=$secret_key"
echo "PLATFORM_ADMIN_API_KEY=$admin_key"
echo "POSTGRES_PASSWORD=$pg_pass"
echo ""
echo "Guarde num gestor de senhas."
