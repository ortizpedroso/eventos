#!/bin/sh
# Entrypoint da API no Docker — mensagens claras se alembic ou uvicorn falharem.
set -e

echo "==> EventosBR API — alembic upgrade head"
alembic upgrade head

echo "==> EventosBR API — uvicorn"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
