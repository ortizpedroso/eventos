#!/usr/bin/env bash
# Recuperação no VPS: força main (Asaas) + .env + senha Postgres + rebuild.
#
# Uso: cd /opt/eventosbr && ./scripts/recover-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RESET_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --reset-db-secret) RESET_ARGS+=(--reset-db-secret) ;;
  esac
done

export DOMAIN="${DOMAIN:-eventosbr.app.br}"

echo "==> Forçando código = origin/main (Asaas)"
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo ""
echo "==> Bootstrap .env (${DOMAIN})"
./scripts/bootstrap-vps-env.sh "${RESET_ARGS[@]}"

DOMAIN="$(env_get DOMAIN .env || echo "$DOMAIN")"

echo ""
echo "==> Postgres + Redis"
docker compose -f "$COMPOSE_FILE" up -d db redis
./scripts/sync-postgres-password-vps.sh

echo ""
echo "==> Build e subida da stack"
docker compose -f "$COMPOSE_FILE" up -d --build api

echo "==> Aguardando API healthy (até 4 min)..."
ok=0
for i in $(seq 1 48); do
  status="$(docker compose -f "$COMPOSE_FILE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok=1
    echo "  OK  API healthy"
    break
  fi
  if [ "$i" -eq 12 ] || [ "$i" -eq 24 ] || [ "$i" -eq 36 ]; then
    docker compose -f "$COMPOSE_FILE" logs api --tail=6 2>/dev/null || true
  fi
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo "ERRO: API não ficou healthy." >&2
  docker compose -f "$COMPOSE_FILE" logs api --tail=80 >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d --build web caddy

echo ""
docker compose -f "$COMPOSE_FILE" ps

if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo ""
  echo "==> SITE OK: https://${DOMAIN}/ready"
else
  echo ""
  echo "==> API healthy. Teste: curl -fsS https://${DOMAIN}/ready"
fi
