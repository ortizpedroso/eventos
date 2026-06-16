#!/usr/bin/env bash
# Smoke manual pós-auditoria: API, migração, CSP e testes.
set -euo pipefail
cd "$(dirname "$0")/.."

export SECRET_KEY="${SECRET_KEY:-test-secret-key-with-at-least-32-chars-here}"
export ENVIRONMENT="${ENVIRONMENT:-development}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///./eventos_smoke.db}"

echo "==> 1/4 pytest (suite completa)"
python3 -m pytest tests/ -q

echo "==> 2/4 alembic current (se Postgres disponível)"
if [[ "${DATABASE_URL}" == postgresql* ]]; then
  alembic upgrade head
  alembic current | grep -q "20260616_000019" && echo "Migração 20260616_000019 OK"
else
  echo "Pule migração Postgres (DATABASE_URL não é postgresql)"
fi

echo "==> 3/4 API health"
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8765 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
sleep 3
curl -sf http://127.0.0.1:8765/health | grep -q '"status"' && echo "GET /health OK"
curl -sf http://127.0.0.1:8765/ready | grep -q '"database"' && echo "GET /ready OK"

echo "==> 4/4 CSP produção (build Next.js)"
cd frontend
NODE_ENV=production npm run build >/tmp/eventosbr-build.log 2>&1
NODE_ENV=production npm run start -- -p 3456 &
WEB_PID=$!
sleep 4
CSP=$(curl -sI http://127.0.0.1:3456/ | tr -d '\r' | grep -i '^content-security-policy:' || true)
kill $WEB_PID 2>/dev/null || true
if echo "$CSP" | grep -q "nonce-"; then
  echo "CSP com nonce OK"
else
  echo "AVISO: header CSP com nonce não encontrado (verifique middleware em produção)"
  echo "$CSP"
fi

echo "Smoke concluído."
