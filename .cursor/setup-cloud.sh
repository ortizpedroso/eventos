#!/usr/bin/env bash
# Idempotent install for Cursor Cloud Agents — runs from repo root on each boot.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"

echo "==> EventosBR — Cursor Cloud setup"

# API env (dev local sem Asaas real)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created .env from .env.example"
fi
# Garante overrides seguros para agentes (não altera se já customizado)
ensure_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s/^${key}=.*/${key}=${val}/" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
ensure_env ENVIRONMENT development
ensure_env ASAAS_DISABLED true
ensure_env RATE_LIMIT_USE_REDIS false
ensure_env TICKET_EMAIL_USE_REDIS false

# Frontend env
if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.local.example frontend/.env.local
  echo "    created frontend/.env.local from example"
fi

echo "==> Python dependencies"
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

echo "==> Frontend dependencies"
npm ci --prefix frontend

echo "==> Cursor Cloud setup complete"
