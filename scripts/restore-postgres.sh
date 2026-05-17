#!/usr/bin/env sh
# Restaura backup .sql ou .sql.gz no Postgres do Compose.
# Uso: ./scripts/restore-postgres.sh backups/backup_eventosbr_20260517_1200.sql.gz
#
# ATENÇÃO: sobrescreve dados da base eventosbr.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <ficheiro.sql|ficheiro.sql.gz>" >&2
  exit 1
fi

FILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${PG_SERVICE:-db}"
USER="${PG_USER:-eventosbr}"
DB="${PG_DB:-eventosbr}"

if [ ! -f "$FILE" ]; then
  echo "ERRO: ficheiro não encontrado: $FILE" >&2
  exit 1
fi

echo "ATENÇÃO: vai restaurar $FILE em $DB ($COMPOSE_FILE). Ctrl+C para cancelar."
sleep 3

gunzip -c "$FILE" 2>/dev/null | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$USER" -d "$DB" || cat "$FILE" | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$USER" -d "$DB"

echo "Restauração concluída."
