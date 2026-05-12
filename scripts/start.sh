#!/usr/bin/env sh
set -e

if [ "${ENVIRONMENT:-development}" != "development" ]; then
  alembic upgrade head
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
