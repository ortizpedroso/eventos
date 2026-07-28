#!/usr/bin/env bash
# Atualiza SMTP no .env do VPS e reinicia a API (sem commitar senha no git).
#
# Uso no VPS:
#   cd /opt/eventosbr
#   EMAIL_PASSWORD='sua-senha' bash scripts/configure-smtp-vps.sh
#
# Opcional:
#   EMAIL_USER=contato@eventosbr.app.br
#   EMAIL_SERVER=smtp.hostinger.com EMAIL_PORT=465

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="${COMPOSE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

DOMAIN="$(env_get DOMAIN "$ENV_FILE" 2>/dev/null || echo eventosbr.app.br)"
EMAIL_USER="${EMAIL_USER:-contato@${DOMAIN}}"
EMAIL_PASSWORD="${EMAIL_PASSWORD:-}"
EMAIL_SERVER="${EMAIL_SERVER:-smtp.hostinger.com}"
EMAIL_PORT="${EMAIL_PORT:-465}"
EMAIL_FROM_NAME="${EMAIL_FROM_NAME:-EventosBR}"
EMAIL_USE_TLS="${EMAIL_USE_TLS:-false}"
EMAIL_USE_SSL="${EMAIL_USE_SSL:-true}"

if [ -z "$EMAIL_PASSWORD" ]; then
  echo "ERRO: defina EMAIL_PASSWORD (senha da caixa ${EMAIL_USER})." >&2
  echo "Ex.: EMAIL_PASSWORD='...' bash scripts/configure-smtp-vps.sh" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado. Rode bootstrap ou copie .env.production.example." >&2
  exit 1
fi

echo "==> Configurando SMTP em $ENV_FILE"
echo "    USER=$EMAIL_USER SERVER=$EMAIL_SERVER:$EMAIL_PORT SSL=$EMAIL_USE_SSL"

set_env_var EMAIL_SERVER "$EMAIL_SERVER" "$ENV_FILE"
set_env_var EMAIL_PORT "$EMAIL_PORT" "$ENV_FILE"
set_env_var EMAIL_USER "$EMAIL_USER" "$ENV_FILE"
set_env_var EMAIL_PASSWORD "$EMAIL_PASSWORD" "$ENV_FILE"
set_env_var EMAIL_FROM_NAME "$EMAIL_FROM_NAME" "$ENV_FILE"
set_env_var EMAIL_USE_TLS "$EMAIL_USE_TLS" "$ENV_FILE"
set_env_var EMAIL_USE_SSL "$EMAIL_USE_SSL" "$ENV_FILE"

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "==> Reiniciando API para carregar .env..."
docker compose -f "$COMPOSE" up -d --force-recreate api

echo "==> Teste SMTP (dentro do container)..."
docker compose -f "$COMPOSE" exec -T api python3 scripts/test-smtp.py "$EMAIL_USER"

echo ""
echo "OK — SMTP configurado. Teste o formulário em https://${DOMAIN}/contato"
