#!/usr/bin/env bash
# Alinha a senha do usuário Postgres no volume persistente com POSTGRES_PASSWORD do .env.
#
# Uso: ./scripts/sync-postgres-password-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  exit 1
fi

pg_pass="$(env_get POSTGRES_PASSWORD "$ENV_FILE" || true)"
if [ -z "$pg_pass" ]; then
  echo "ERRO: POSTGRES_PASSWORD vazio em $ENV_FILE" >&2
  exit 1
fi

if env_is_placeholder "$pg_pass"; then
  echo "ERRO: POSTGRES_PASSWORD ainda é placeholder em $ENV_FILE" >&2
  echo "      Use ./scripts/generate-secrets.sh ou ./scripts/bootstrap-vps-env.sh" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running db 2>/dev/null | grep -q db; then
  echo "==> Subindo serviço db..."
  docker compose -f "$COMPOSE_FILE" up -d db
fi

echo "==> Aguardando Postgres..."
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U eventosbr -d eventosbr >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U eventosbr -d eventosbr >/dev/null 2>&1; then
  echo "ERRO: Postgres não ficou pronto." >&2
  exit 1
fi

echo "==> Sincronizando senha do usuário eventosbr com .env"
# Usa variável psql --set= (evita interpolação shell da senha — PGPASSWORD não interfere aqui
# pois -U já é o próprio superuser do container).
docker compose -f "$COMPOSE_FILE" exec -T \
  -e "NEWPW=${pg_pass}" \
  db \
  psql -v ON_ERROR_STOP=1 -U eventosbr -d eventosbr \
  -c "ALTER USER eventosbr WITH PASSWORD current_setting('newpw');" \
  --set=newpw="${pg_pass}" 2>/dev/null || \
docker compose -f "$COMPOSE_FILE" exec -T \
  db \
  psql -v ON_ERROR_STOP=1 -U postgres -d eventosbr \
  --set=newpw="${pg_pass}" \
  -c "ALTER USER eventosbr WITH PASSWORD :'newpw';"

echo "==> OK — senha do Postgres alinhada ao .env"
