#!/usr/bin/env bash
# Recuperação completa no VPS: .env + senha Postgres + rebuild.
#
# Uso:
#   cd /opt/eventosbr && git pull && ./scripts/recover-vps.sh
#
# Opções:
#   --reset-db-secret   nova senha Postgres (sincroniza no volume)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RESET_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --reset-db-secret) RESET_ARGS+=(--reset-db-secret) ;;
  esac
done

export DOMAIN="${DOMAIN:-eventosbr.app.br}"

echo "==> Bootstrap .env (${DOMAIN})"
./scripts/bootstrap-vps-env.sh "${RESET_ARGS[@]}"

# shellcheck disable=SC1091
set -a
source .env
set +a

echo ""
echo "==> Postgres + Redis"
docker compose -f "$COMPOSE_FILE" up -d db redis

./scripts/sync-postgres-password-vps.sh

echo ""
echo "==> Teste de conexão Postgres com senha do .env"
docker compose -f "$COMPOSE_FILE" run --rm --no-deps \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  api python -c "
import os
import psycopg2
url = os.environ.get('DATABASE_URL', '')
# compose injeta DATABASE_URL no run; fallback manual
pwd = os.environ.get('POSTGRES_PASSWORD', '')
conn = psycopg2.connect(
    host='db', port=5432, user='eventosbr', password=pwd, dbname='eventosbr'
)
conn.close()
print('conexao_postgres_ok')
" 2>/dev/null || {
  echo "AVISO: teste Python falhou; seguindo com deploy (sync já rodou)."
}

echo ""
echo "==> Build API + stack"
docker compose -f "$COMPOSE_FILE" up -d --build api

echo "==> Aguardando API (até 4 min)..."
ok=0
for i in $(seq 1 48); do
  status="$(docker compose -f "$COMPOSE_FILE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  state="$(docker compose -f "$COMPOSE_FILE" ps api --format '{{.State}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok=1
    echo "  OK  API healthy (${i}x5s)"
    break
  fi
  if echo "$state" | grep -qi restarting; then
    echo "  ... API restarting (${i}/48) — últimas linhas do log:"
    docker compose -f "$COMPOSE_FILE" logs api --tail=8 2>/dev/null || true
  fi
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo ""
  echo "ERRO: API não ficou healthy. Log completo:" >&2
  docker compose -f "$COMPOSE_FILE" logs api --tail=100 >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d web caddy

echo ""
docker compose -f "$COMPOSE_FILE" ps

if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo ""
  echo "==> SITE OK: https://${DOMAIN}/ready"
else
  echo ""
  echo "==> API healthy; se o site ainda der 502, aguarde 30s e teste de novo."
  echo "    curl -fsS https://${DOMAIN}/ready"
fi
