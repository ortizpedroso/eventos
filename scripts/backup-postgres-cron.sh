#!/usr/bin/env sh
# Backup PostgreSQL com rotação, log e upload off-site opcional.
# Pensado para cron no VPS Hostinger:
#   0 3 * * * cd /opt/eventosbr && ./scripts/backup-postgres-cron.sh
#
# Variáveis opcionais (.env ou ambiente):
#   BACKUP_DIR          — pasta local (padrão: ./backups)
#   BACKUP_KEEP_DAYS    — dias a manter (padrão: 14)
#   BACKUP_LOG          — ficheiro de log (padrão: $BACKUP_DIR/backup.log)
#   BACKUP_UPLOAD_CMD   — comando pós-backup (ex.: rclone copy)
#   COMPOSE_FILE        — docker-compose.prod.yml

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_LOG="${BACKUP_LOG:-$BACKUP_DIR/backup.log}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$BACKUP_DIR"

log() {
  printf '%s %s\n' "$STAMP" "$1" | tee -a "$BACKUP_LOG"
}

log "==> Início backup-postgres-cron"

if ! ./scripts/backup-postgres.sh 2>&1 | tee -a "$BACKUP_LOG"; then
  log "ERRO: backup-postgres.sh falhou"
  exit 1
fi

LATEST="$(ls -1t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -n1 || true)"
if [ -z "$LATEST" ]; then
  log "ERRO: nenhum ficheiro backup_*.sql.gz encontrado em $BACKUP_DIR"
  exit 1
fi

log "OK backup: $LATEST ($(wc -c < "$LATEST" | tr -d ' ') bytes)"

# Rotação por idade
if [ "$BACKUP_KEEP_DAYS" -gt 0 ] 2>/dev/null; then
  DELETED=0
  while IFS= read -r old; do
    [ -z "$old" ] && continue
    rm -f "$old"
    DELETED=$((DELETED + 1))
    log "Removido (>${BACKUP_KEEP_DAYS}d): $old"
  done <<EOF
$(find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.sql.gz' -type f -mtime +"$BACKUP_KEEP_DAYS" 2>/dev/null || true)
EOF
  log "Rotação: $DELETED ficheiro(s) antigo(s) removido(s)"
fi

# Upload off-site opcional
if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  log "Upload off-site: $BACKUP_UPLOAD_CMD"
  if eval "$BACKUP_UPLOAD_CMD"; then
    log "Upload off-site concluído"
  else
    log "AVISO: upload off-site falhou (backup local mantido em $LATEST)"
    exit 1
  fi
elif [ -x "$ROOT/scripts/upload-backup-offsite.sh" ] && [ -n "${BACKUP_OFFSITE_TARGET:-}" ]; then
  if "$ROOT/scripts/upload-backup-offsite.sh" "$LATEST"; then
    log "Upload via upload-backup-offsite.sh concluído"
  else
    log "AVISO: upload-backup-offsite.sh falhou"
    exit 1
  fi
fi

log "==> Fim backup-postgres-cron"
exit 0
