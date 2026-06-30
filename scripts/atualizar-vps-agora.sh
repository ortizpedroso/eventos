#!/usr/bin/env bash
# Atualização completa do EventosBR no VPS — força origin/main (Asaas).
# Uso: cd /opt/eventosbr && bash ./scripts/atualizar-vps-agora.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

COMPOSE="docker-compose.prod.yml"

echo "=============================================="
echo " EventosBR — atualização VPS (main / Asaas)"
echo "=============================================="

if [ ! -f .env ]; then
  echo "==> .env ausente — bootstrap"
  ./scripts/bootstrap-vps-env.sh
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[1/8] Commit ANTES (no servidor):"
git log -1 --oneline 2>/dev/null || echo "  (sem git)"

echo ""
echo "[2/8] Forçando código = origin/main do GitHub..."
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

if [ -x ./scripts/validate-env-production.sh ]; then
  echo ""
  echo "[3/8] Validando .env..."
  ./scripts/validate-env-production.sh
fi

echo ""
echo "[4/8] Postgres + Redis + sync senha..."
docker compose -f "$COMPOSE" up -d db redis
./scripts/sync-postgres-password-vps.sh

echo ""
echo "[5/8] Rebuild frontend com BUILD_SHA=$GIT_COMMIT (5-15 min)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[6/8] Subindo containers..."
docker compose -f "$COMPOSE" up -d --build --force-recreate api web caddy

echo ""
echo "[7/8] Aguardando API healthy..."
ok_api=0
for i in $(seq 1 36); do
  status="$(docker compose -f "$COMPOSE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok_api=1
    break
  fi
  sleep 5
done
if [ "$ok_api" -ne 1 ]; then
  echo "ERRO: API não healthy — logs:" >&2
  docker compose -f "$COMPOSE" logs api --tail=60 >&2
  exit 1
fi

sleep 10
docker compose -f "$COMPOSE" ps

echo ""
echo "[8/8] Verificação automática..."
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

if curl -fsS --max-time 15 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "  OK  /ready"
else
  echo "  FALHA  /ready"
  ok=1
fi

echo ""
if [[ $ok -eq 0 ]]; then
  echo "✅ VPS ATUALIZADO — teste no browser (Ctrl+Shift+R):"
  echo "   https://${DOMAIN}"
else
  echo "❌ Ainda com problemas — envie esta saída ao suporte."
  exit 1
fi
