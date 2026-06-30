#!/usr/bin/env bash
# Atualiza a aplicação no VPS (git pull + sync Postgres + rebuild + migrate na API).
#
# Uso no servidor:
#   cd /opt/eventosbr && ./scripts/deploy-vps.sh
#
# Pré-requisitos: .env configurado, docker compose v2, domínio apontando para o VPS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "ERRO: crie .env a partir de .env.production.example" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

DOMAIN_SHOW="${DOMAIN:-eventosbr.app.br}"

echo "==> Commit antes do pull"
git log -1 --oneline 2>/dev/null || true

echo ""
echo "==> git pull"
git pull --ff-only

echo ""
if [ -x ./scripts/update-env-vps.sh ]; then
  echo "==> Novas chaves no .env (sem sobrescrever segredos existentes)"
  ./scripts/update-env-vps.sh || true
fi

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
if curl -fsS --max-time 15 "https://${DOMAIN_SHOW}/ready" >/dev/null 2>&1; then
  echo "==> Site OK: https://${DOMAIN_SHOW}/ready"
elif curl -fsS --max-time 10 "http://127.0.0.1:8000/ready" >/dev/null 2>&1; then
  echo "==> API OK internamente; confira Caddy/DNS para https://${DOMAIN_SHOW}"
else
  echo "==> Verifique logs: docker compose -f $COMPOSE_FILE logs api web --tail=60"
fi

echo "Painel: https://${DOMAIN_SHOW}/admin/dashboard"
