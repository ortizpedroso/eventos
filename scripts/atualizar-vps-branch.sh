#!/usr/bin/env bash
# Deploy no VPS a partir de uma branch específica (ex.: PR antes do merge em main).
# Não faz reset para main — útil para deploy de branch de feature antes do merge.
#
# Uso:
#   cd /opt/eventosbr
#   ./scripts/atualizar-vps-branch.sh cursor/ux-seo-melhorias-v2-bf71

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

BRANCH="${1:-}"
COMPOSE="docker-compose.prod.yml"

if [ -z "$BRANCH" ]; then
  echo "Uso: $0 <branch>" >&2
  echo "Ex.: $0 cursor/ux-seo-melhorias-v2-bf71" >&2
  exit 1
fi

echo "=============================================="
echo " EventosBR — deploy VPS (branch: $BRANCH)"
echo "=============================================="

export GIT_TERMINAL_PROMPT=0
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

COMMIT="$(git rev-parse --short HEAD)"
export GIT_COMMIT="$COMMIT"
echo "    Commit: $COMMIT ($(git log -1 --oneline))"
echo "    Última migração: $(ls alembic/versions/*.py 2>/dev/null | xargs -n1 basename | sort | tail -1)"

if ! grep -q 'PAYMENT_PROVIDER' config/settings.py 2>/dev/null; then
  echo "ERRO: código inesperado (sem Asaas)." >&2
  exit 1
fi

if [ ! -f .env ]; then
  ./scripts/bootstrap-vps-env.sh
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[1/8] Postgres + Redis..."
docker compose -f "$COMPOSE" up -d db redis

echo ""
echo "[2/8] Sync senha Postgres..."
./scripts/sync-postgres-password-vps.sh

LATEST_MIGRATION="$(ls alembic/versions/*.py | xargs -n1 basename | sort | tail -1)"
echo ""
echo "[3/8] Build API ($LATEST_MIGRATION)..."
docker compose -f "$COMPOSE" build api
docker compose -f "$COMPOSE" up -d --force-recreate api

echo ""
echo "[4/8] Aguardando API healthy..."
ok_api=0
for i in $(seq 1 48); do
  status="$(docker compose -f "$COMPOSE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok_api=1
    break
  fi
  sleep 5
done
if [ "$ok_api" -ne 1 ]; then
  echo "ERRO: API unhealthy" >&2
  docker compose -f "$COMPOSE" logs api --tail=80 >&2
  exit 1
fi

echo ""
echo "[5/8] Build frontend..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[6/8] Web + Caddy..."
docker compose -f "$COMPOSE" up -d --force-recreate web caddy

sleep 12

echo ""
echo "[7/8] Verificação..."
if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "  OK  /ready"
else
  echo "  FALHA  /ready" >&2
  exit 1
fi

echo ""
echo "[8/8] Estado dos containers"
docker compose -f "$COMPOSE" ps

echo ""
echo "✅ Branch $BRANCH no ar: https://${DOMAIN}"
echo "   Para voltar à main: ./scripts/atualizar-vps-agora.sh"
