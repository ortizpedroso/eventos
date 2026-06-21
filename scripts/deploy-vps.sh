#!/usr/bin/env sh
# Atualiza a aplicacao no VPS (git pull + rebuild + migrate via entrypoint da API).
# Uso no servidor: bash ./scripts/deploy-vps.sh
#
# IMPORTANTE: alteracoes no GitHub NAO entram sozinhas no VPS — rode este script apos cada push.
#
# Pre-requisitos: .env configurado, docker compose v2, dominio apontando para o VPS.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "ERRO: crie .env a partir de .env.production.example" >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> docker compose up (build)"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> estado"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Verifique: curl -sS https://\${DOMAIN}/ready  (ou http://IP/ready se DNS ainda nao propagou)"
echo "Painel admin: https://\${DOMAIN}/admin/dashboard"
