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
echo "[1/9] .env..."
if _needs_bootstrap; then
  ./scripts/bootstrap-vps-env.sh
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[2/9] Postgres + Redis..."
docker compose -f "$COMPOSE" up -d db redis

echo ""
echo "[3/9] Sync senha Postgres com .env..."
./scripts/sync-postgres-password-vps.sh

echo ""
echo "[4/9] Build API..."
docker compose -f "$COMPOSE" build api
docker compose -f "$COMPOSE" up -d --force-recreate api

echo ""
echo "[5/9] Aguardando API healthy (até 4 min)..."
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
echo "[6/9] Verificar preços abaixo de R\$ 10 (dry-run)..."
docker compose -f "$COMPOSE" exec -T api python3 scripts/migrar_precos_minimo_r10.py 2>/dev/null || true

echo ""
echo "[7/9] Build frontend (5-15 min)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[8/9] Web + Caddy..."
docker compose -f "$COMPOSE" up -d --force-recreate web caddy

sleep 15
docker compose -f "$COMPOSE" ps

echo ""
echo "[9/9] Verificação..."
ok=0

if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "  OK  /ready"
else
  echo "  FALHA  /ready"
  ok=1
fi

if [ -x ./scripts/verify-production.sh ]; then
  ./scripts/verify-production.sh || echo "  AVISO: verify-production retornou erro — revise manualmente"
fi

echo ""
if [ "$ok" -eq 0 ]; then
  echo "✅ SITE NO AR: https://${DOMAIN}"
else
  echo "❌ /ready falhou — logs: docker compose -f $COMPOSE logs api --tail=60" >&2
  exit 1
fi
