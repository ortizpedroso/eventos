#!/usr/bin/env bash
# Atualiza a aplicação no VPS (git pull main + sync Postgres + rebuild + migrate na API).
#
# Uso no servidor:
#   cd /opt/eventosbr && ./scripts/deploy-vps.sh
#
# IMPORTANTE: use sempre a branch main (Asaas). Não use branches antigas com Stripe.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "==> .env ausente — bootstrap automático"
  ./scripts/bootstrap-vps-env.sh
elif [ -x ./scripts/bootstrap-vps-env.sh ] && [ -x ./scripts/validate-env-production.sh ]; then
  if ! ./scripts/validate-env-production.sh 2>/dev/null; then
    echo ""
    echo "==> .env incompleto — bootstrap automático"
    ./scripts/bootstrap-vps-env.sh
  fi
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo "==> Commit ANTES do pull"
git log -1 --oneline 2>/dev/null || echo "(sem git)"

echo ""
echo "==> git fetch + pull origin main"
git fetch origin main
git checkout -B main origin/main 2>/dev/null || git checkout main
git pull origin main

echo ""
echo "==> Commit DEPOIS do pull"
git log -1 --oneline

export GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"

if [ -x ./scripts/validate-env-production.sh ]; then
  echo ""
  ./scripts/validate-env-production.sh
fi

echo ""
echo "==> Infra base (db + redis)"
docker compose -f "$COMPOSE_FILE" up -d db redis

if [ -x ./scripts/sync-postgres-password-vps.sh ]; then
  echo ""
  ./scripts/sync-postgres-password-vps.sh
fi

echo ""
echo "==> Build e subida da stack"
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "==> Aguardando API healthy (até 3 min)..."
for _ in $(seq 1 36); do
  status="$(docker compose -f "$COMPOSE_FILE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    echo "  OK  API healthy"
    break
  fi
  if [ "$_" -eq 36 ]; then
    echo "  AVISO  API ainda não healthy — veja: docker compose -f $COMPOSE_FILE logs api --tail=80" >&2
  fi
  sleep 5
done

echo ""
docker compose -f "$COMPOSE_FILE" ps

echo ""
if curl -fsS --max-time 15 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "==> Site OK: https://${DOMAIN}/ready"
elif curl -fsS --max-time 10 "http://127.0.0.1:8000/ready" >/dev/null 2>&1; then
  echo "==> API OK internamente; confira Caddy/DNS para https://${DOMAIN}"
else
  echo "==> Verifique logs: docker compose -f $COMPOSE_FILE logs api web --tail=60"
fi

echo ""
echo "Painel: https://${DOMAIN}/admin/dashboard"
echo "Asaas:  ./scripts/configure-asaas-env.sh && ./scripts/verify-production.sh"
