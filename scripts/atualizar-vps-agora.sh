#!/usr/bin/env bash
# Atualização completa do EventosBR no VPS — força origin/main (corrige main desatualizado).
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
echo "[1/9] Commit ANTES (no servidor):"
git log -1 --oneline 2>/dev/null || echo "  (sem git)"

echo ""
echo "[2/9] Forçando código = origin/main do GitHub..."
export GIT_TERMINAL_PROMPT=0
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main
git branch --set-upstream-to=origin/main main 2>/dev/null || true

COMMIT="$(git rev-parse --short HEAD)"
echo "    Commit ativo: $COMMIT ($(git log -1 --oneline))"

if ! grep -q 'hrefCriarEvento' frontend/src/app/page.tsx 2>/dev/null; then
  echo "ERRO: código ainda antigo (page.tsx sem hrefCriarEvento). Verifique o repositório." >&2
  exit 1
fi

export GIT_COMMIT="$COMMIT"

echo ""
echo "[3/9] Rebuild frontend com BUILD_SHA=$GIT_COMMIT (5-15 min)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[4/9] Subindo containers..."
docker compose -f "$COMPOSE" up -d --build --force-recreate web api

echo ""
echo "[5/9] Migrações Alembic..."
docker compose -f "$COMPOSE" exec -T api alembic upgrade head

echo ""
echo "[6/9] Verificar preços abaixo de R$ 10 (dry-run)..."
docker compose -f "$COMPOSE" exec -T api python3 scripts/migrar_precos_minimo_r10.py || true
echo "    (Se houver lotes listados, rode: docker compose -f $COMPOSE exec -T api python3 scripts/migrar_precos_minimo_r10.py --apply)"

echo ""
echo "[7/9] Aguardando web..."
sleep 25
docker compose -f "$COMPOSE" ps

echo ""
echo "[8/9] Verificação automática..."
HTML="$(curl -fsS --max-time 30 "https://${DOMAIN}/" 2>/dev/null || true)"
BUILD_ON_SITE="$(echo "$HTML" | grep -o 'data-eventosbr-build="[^"]*"' | head -1 || true)"

ok=0
if echo "$HTML" | grep -q 'href="/organizador/novo"'; then
  echo "  OK  links → /organizador/novo"
else
  echo "  FALHA  links ainda em /auth?next (código antigo no HTML)"
  ok=1
fi

if echo "$HTML" | grep -q 'scroll-smooth'; then
  echo "  FALHA  scroll-smooth ainda presente (build antigo)"
  ok=1
else
  echo "  OK  scroll-smooth removido"
fi

if echo "$BUILD_ON_SITE" | grep -q "$COMMIT"; then
  echo "  OK  build no site: $BUILD_ON_SITE"
else
  echo "  AVISO  build no site: ${BUILD_ON_SITE:-não encontrado} (esperado: $COMMIT)"
fi

echo ""
echo "[9/9] verify-production.sh (se disponível)..."
if [[ -x ./scripts/verify-production.sh ]]; then
  ./scripts/verify-production.sh || echo "  AVISO: verify-production retornou erro — revise manualmente"
fi

echo ""
echo "Resultado"
if [[ $ok -eq 0 ]]; then
  echo "✅ VPS ATUALIZADO — teste no browser (Ctrl+Shift+R):"
  echo "   https://${DOMAIN}"
else
  echo "❌ Ainda com problemas — envie esta saída ao suporte."
  exit 1
fi
