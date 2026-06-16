#!/usr/bin/env sh
# Copia o último backup para destino remoto (rclone, scp ou aws cli).
#
# Configure no .env do VPS:
#   BACKUP_OFFSITE_TARGET=s3:eventosbr-backups/postgres
#   # ou: user@backup-host:/var/backups/eventosbr
#   # ou: rclone-remote:bucket/eventosbr
#
# Uso:
#   ./scripts/upload-backup-offsite.sh [ficheiro.sql.gz]
#   BACKUP_OFFSITE_TARGET=... ./scripts/upload-backup-offsite.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

FILE="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
TARGET="${BACKUP_OFFSITE_TARGET:-}"

if [ -z "$FILE" ]; then
  FILE="$(ls -1t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -n1 || true)"
fi

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "ERRO: ficheiro de backup não encontrado." >&2
  exit 1
fi

if [ -z "$TARGET" ]; then
  echo "ERRO: defina BACKUP_OFFSITE_TARGET no .env" >&2
  echo "Ex.: BACKUP_OFFSITE_TARGET=s3:eventosbr-backups/postgres" >&2
  exit 1
fi

BASENAME="$(basename "$FILE")"
echo "Upload $FILE → $TARGET/$BASENAME"

case "$TARGET" in
  s3://*|s3:*)
    if command -v aws >/dev/null 2>&1; then
      DEST="$TARGET"
      case "$DEST" in
        s3:*) DEST="s3://${DEST#s3:}" ;;
      esac
      aws s3 cp "$FILE" "$DEST/$BASENAME"
    else
      echo "ERRO: aws cli não instalado" >&2
      exit 1
    fi
    ;;
  *@*:*|*:*)
  # scp user@host:/path ou rclone remote:path
    if command -v rclone >/dev/null 2>&1 && [[ "$TARGET" != *@* ]]; then
      rclone copyto "$FILE" "$TARGET/$BASENAME"
    elif command -v scp >/dev/null 2>&1; then
      scp -q "$FILE" "$TARGET/$BASENAME"
    else
      echo "ERRO: instale rclone ou scp para este destino" >&2
      exit 1
    fi
    ;;
  *)
    mkdir -p "$TARGET"
    cp -f "$FILE" "$TARGET/$BASENAME"
    ;;
esac

echo "OK: $BASENAME enviado"
