#!/usr/bin/env bash
# Alinha a senha do usuário Postgres no volume persistente com POSTGRES_PASSWORD do .env.
# Necessário quando o .env foi alterado (generate-secrets / edição manual) mas o volume db
# ainda guarda a senha do primeiro deploy.
#
# Uso (na raiz do repo, com db rodando):
#   ./scripts/sync-postgres-password-vps.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

pg_pass="${POSTGRES_PASSWORD:-}"
if [ -z "$pg_pass" ]; then
  echo "ERRO: POSTGRES_PASSWORD vazio em $ENV_FILE" >&2
  exit 1
fi

case "$pg_pass" in
  GERE_*|*GERE_COM_*|changeme|*placeholder*)
    echo "ERRO: POSTGRES_PASSWORD ainda é placeholder em $ENV_FILE" >&2
    echo "      Use ./scripts/generate-secrets.sh na primeira instalação." >&2
    exit 1
    ;;
esac

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

# Escapa aspas simples para SQL ('' dentro de string SQL).
sql_pass="$(printf '%s' "$pg_pass" | sed "s/'/''/g")"

echo "==> Sincronizando senha do usuário eventosbr com .env"
docker compose -f "$COMPOSE_FILE" exec -T db \
  psql -v ON_ERROR_STOP=1 -U eventosbr -d eventosbr \
  -c "ALTER USER eventosbr WITH PASSWORD '${sql_pass}';"

echo "==> OK — senha do Postgres alinhada ao .env"
