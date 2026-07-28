#!/usr/bin/env bash
# Atualiza SMTP no .env do VPS e reinicia a API (sem commitar senha no git).
#
# Uso no VPS:
#   cd /opt/eventosbr
#   EMAIL_PASSWORD='sua-senha' bash scripts/configure-smtp-vps.sh
#
# IMPORTANTE: senhas com # ou $ precisam ir entre aspas simples na linha de comando.
# O script grava o valor entre aspas duplas no .env automaticamente.

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
  echo "Ex.: EMAIL_PASSWORD='E@o2026*#' bash scripts/configure-smtp-vps.sh" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  exit 1
fi

echo "==> Configurando SMTP em $ENV_FILE"
echo "    USER=$EMAIL_USER SERVER=$EMAIL_SERVER:$EMAIL_PORT SSL=$EMAIL_USE_SSL"
echo "    Senha: ${#EMAIL_PASSWORD} caracteres"

set_env_var EMAIL_SERVER "$EMAIL_SERVER" "$ENV_FILE"
set_env_var EMAIL_PORT "$EMAIL_PORT" "$ENV_FILE"
set_env_var EMAIL_USER "$EMAIL_USER" "$ENV_FILE"
set_env_var EMAIL_PASSWORD "$EMAIL_PASSWORD" "$ENV_FILE"
set_env_var EMAIL_FROM_NAME "$EMAIL_FROM_NAME" "$ENV_FILE"
set_env_var EMAIL_USE_TLS "$EMAIL_USE_TLS" "$ENV_FILE"
set_env_var EMAIL_USE_SSL "$EMAIL_USE_SSL" "$ENV_FILE"

# Confirma leitura correta (senhas com # quebram sem aspas no .env)
read_back="$(env_get EMAIL_PASSWORD "$ENV_FILE" || true)"
if [ "$read_back" != "$EMAIL_PASSWORD" ]; then
  echo "ERRO: senha gravada incorretamente no .env (${#read_back} chars lidos vs ${#EMAIL_PASSWORD} esperados)." >&2
  echo "Verifique aspas em EMAIL_PASSWORD no arquivo." >&2
  exit 1
fi
echo "    OK: senha lida de volta com ${#read_back} caracteres"

chmod 600 "$ENV_FILE" 2>/dev/null || true

echo "==> Reiniciando API..."
docker compose -f "$COMPOSE" up -d --force-recreate api

echo "==> Aguardando API..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE" exec -T api python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Teste SMTP..."
docker compose -f "$COMPOSE" exec -T api python3 scripts/test-smtp.py "$EMAIL_USER"

echo ""
echo "OK — SMTP configurado. Teste https://${DOMAIN}/contato"
