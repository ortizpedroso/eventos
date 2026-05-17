#!/usr/bin/env sh
# Backup lógico PostgreSQL (Docker Compose prod ou dev).
# Uso na raiz do repo:
#   ./scripts/backup-postgres.sh
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/backup-postgres.sh
#
# Saída: ./backups/backup_eventosbr_YYYYMMDD_HHMM.sql.gz

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${PG_SERVICE:-db}"
USER="${PG_USER:-eventosbr}"
DB="${PG_DB:-eventosbr}"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$OUT_DIR/backup_${DB}_${STAMP}.sql.gz"

mkdir -p "$OUT_DIR"

if ! docker compose -f "$COMPOSE_FILE" ps --status running "$SERVICE" 2>/dev/null | grep -q "$SERVICE"; then
  echo "ERRO: serviço '$SERVICE' não está rodando (compose: $COMPOSE_FILE)." >&2
  exit 1
fi

echo "Backup $DB → $OUT_FILE"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  pg_dump -U "$USER" "$DB" | gzip -1 > "$OUT_FILE"

echo "OK: $(wc -c < "$OUT_FILE" | tr -d ' ') bytes"
