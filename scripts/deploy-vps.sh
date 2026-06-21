#!/usr/bin/env bash
# Atualiza a aplicacao no VPS (git pull + rebuild + migrate via entrypoint da API).
# Uso no servidor: bash ./scripts/deploy-vps.sh
#
# IMPORTANTE: alteracoes no GitHub NAO entram sozinhas no VPS — rode este script apos cada push.
#
# Pre-requisitos: .env configurado, docker compose v2, dominio apontando para o VPS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "ERRO: crie .env a partir de .env.production.example" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true
DOMAIN="${DOMAIN:-eventosbr.app.br}"

echo "==> Commit ANTES do pull"
git log -1 --oneline 2>/dev/null || echo "(sem git)"

echo ""
echo "==> git fetch + pull origin main"
git fetch origin main
git checkout main 2>/dev/null || true
git pull origin main

echo ""
echo "==> Commit DEPOIS do pull (deve ser 3f8e9ec ou mais recente)"
git log -1 --oneline

echo ""
echo "==> Rebuild frontend (web) — pode levar 5-10 min"
docker compose -f "$COMPOSE_FILE" build --no-cache web
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "==> Aguardando web..."
sleep 15
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Verificação rápida do site"
HTML="$(curl -fsS --max-time 20 "https://${DOMAIN}/" 2>/dev/null || true)"
if echo "$HTML" | grep -q 'href="/organizador/novo"'; then
  echo "  OK  Site atualizado (links /organizador/novo)"
elif echo "$HTML" | grep -q 'auth?next'; then
  echo "  AVISO  Site ainda mostra links antigos (/auth?next) — tente:"
  echo "         docker compose -f $COMPOSE_FILE build --no-cache web"
  echo "         docker compose -f $COMPOSE_FILE up -d --force-recreate web"
else
  echo "  INFO  Não foi possível verificar automaticamente"
fi

echo ""
echo "Painel: https://${DOMAIN}/admin/dashboard"
echo "Health: curl -sS https://${DOMAIN}/health"
