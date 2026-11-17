#!/bin/sh
# Entrypoint da API no Docker — mensagens claras se alembic ou uvicorn falharem.
set -e

echo "==> EventosBR API — alembic upgrade head"
alembic upgrade head

UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
mkdir -p "$UPLOAD_DIR" 2>/dev/null || true
if ! touch "$UPLOAD_DIR/.write-test" 2>/dev/null; then
  echo "!! AVISO: $UPLOAD_DIR não é gravável por $(id -un) (uid $(id -u))." >&2
  echo "!! Upload de imagens vai falhar. Corrija: chown -R 1000:1000 no volume de uploads." >&2
else
  rm -f "$UPLOAD_DIR/.write-test"
fi

echo "==> EventosBR API — uvicorn"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
