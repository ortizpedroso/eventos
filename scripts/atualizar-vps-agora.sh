#!/usr/bin/env bash
# ÚNICO script do VPS — atualiza código (main/Asaas), .env, Postgres e sobe o site.
#
# Uso (só isto):
#   cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker-compose.prod.yml"

# Fase 0: git pull + re-exec (reset não atualiza o bash já em execução).
if [ "${EVENTOSBR_VPS_REEXEC:-}" != "1" ]; then
  echo "==> Atualizando origin/main e reiniciando script..."
  export GIT_TERMINAL_PROMPT=0
  git fetch origin main
  git checkout -B main origin/main 2>/dev/null || true
  git reset --hard origin/main
  export EVENTOSBR_VPS_REEXEC=1
  export GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
  exec bash "$ROOT/scripts/atualizar-vps-agora.sh" "$@"
fi

# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

echo "=============================================="
echo " EventosBR — deploy VPS (main / Asaas)"
echo "=============================================="

COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD)}"
export GIT_COMMIT="$COMMIT"
echo "    Commit: $COMMIT ($(git log -1 --oneline))"

if ! grep -q 'PAYMENT_PROVIDER' config/settings.py 2>/dev/null; then
  echo "ERRO: código inesperado (sem Asaas)." >&2
  exit 1
fi

_needs_bootstrap() {
  if [ ! -f .env ]; then
    return 0
  fi
  if grep -qiE '^STRIPE_' .env 2>/dev/null; then
    return 0
  fi
  if ! ./scripts/validate-env-production.sh 2>/dev/null; then
    return 0
  fi
  [ "$(env_get PAYMENT_PROVIDER .env 2>/dev/null || true)" = "asaas" ] || return 0
  return 1
}

echo ""
echo "[1/8] .env..."
if _needs_bootstrap; then
  ./scripts/bootstrap-vps-env.sh
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[2/8] Postgres + Redis..."
docker compose -f "$COMPOSE" up -d db redis

echo ""
echo "[3/8] Sync senha Postgres..."
./scripts/sync-postgres-password-vps.sh

echo ""
echo "[4/8] API..."
docker compose -f "$COMPOSE" build api
docker compose -f "$COMPOSE" up -d --force-recreate api

echo ""
echo "[5/8] Aguardando API healthy (até 4 min)..."
ok_api=0
for i in $(seq 1 48); do
  status="$(docker compose -f "$COMPOSE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok_api=1
    echo "  OK  API healthy"
    break
  fi
  if [ "$((i % 8))" -eq 0 ]; then
    docker compose -f "$COMPOSE" logs api --tail=15 2>/dev/null || true
  fi
  sleep 5
done
if [ "$ok_api" -ne 1 ]; then
  echo "ERRO: API unhealthy" >&2
  docker compose -f "$COMPOSE" logs api --tail=100 >&2
  exit 1
fi

echo ""
echo "[6/8] Build frontend (5-15 min)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[7/8] Web + Caddy..."
docker compose -f "$COMPOSE" up -d --force-recreate web caddy

sleep 12
docker compose -f "$COMPOSE" ps

echo ""
echo "[8/8] Verificação..."
if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "✅ SITE NO AR: https://${DOMAIN}"
else
  echo "❌ /ready falhou — logs: docker compose -f $COMPOSE logs api --tail=60" >&2
  exit 1
fi
