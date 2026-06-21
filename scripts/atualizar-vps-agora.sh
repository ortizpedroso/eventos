#!/usr/bin/env bash
# Atualização completa do EventosBR no VPS — cole no terminal SSH.
# Uso: cd /opt/eventosbr && bash ./scripts/atualizar-vps-agora.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker-compose.prod.yml"

echo "=============================================="
echo " EventosBR — atualização VPS"
echo "=============================================="

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado em $ROOT" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env
DOMAIN="${DOMAIN:-eventosbr.app.br}"

echo ""
echo "[1/6] Commit atual no servidor:"
git log -1 --oneline 2>/dev/null || echo "  (sem git)"

echo ""
echo "[2/6] Baixando código do GitHub (branch main)..."
export GIT_TERMINAL_PROMPT=0
git fetch origin main
git checkout main 2>/dev/null || git checkout -b main origin/main
git pull origin main

echo ""
echo "[3/6] Commit após pull (esperado: f218e0a ou mais novo):"
git log -1 --oneline

echo ""
echo "[4/6] Rebuild do frontend (5-15 min — aguarde)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[5/6] Subindo todos os containers..."
docker compose -f "$COMPOSE" up -d --build --force-recreate web

echo ""
echo "[6/6] Verificando..."
sleep 20
docker compose -f "$COMPOSE" ps

HTML="$(curl -fsS --max-time 25 "https://${DOMAIN}/" 2>/dev/null || true)"
echo ""
if echo "$HTML" | grep -q 'href="/organizador/novo"'; then
  echo "✅ SUCESSO — site atualizado!"
  echo "   Links Criar evento → /organizador/novo"
elif echo "$HTML" | grep -q 'scroll-smooth'; then
  echo "⚠️  Site ainda parece ANTIGO (scroll-smooth presente)"
  echo "   Tente: docker compose -f $COMPOSE logs web --tail 30"
else
  echo "ℹ️  Containers rodando — teste manual: https://${DOMAIN}"
fi

if echo "$HTML" | grep -q 'auth?next=%2Forganizador'; then
  echo "⚠️  Ainda há links /auth?next (versão antiga do HTML)"
fi

echo ""
echo "Teste no browser:"
echo "  https://${DOMAIN}"
echo "  https://${DOMAIN}/organizador/novo"
echo ""
echo "Health: curl -sS https://${DOMAIN}/health"
