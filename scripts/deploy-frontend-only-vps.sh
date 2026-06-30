#!/usr/bin/env bash
# Atualiza SOMENTE o frontend no VPS de produção, sem quebrar a API.
# Uso: cd /opt/eventosbr && bash ./scripts/deploy-frontend-only-vps.sh [branch]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BRANCH="${1:-}"

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $ROOT" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE" ]]; then
  echo "ERRO: $COMPOSE não encontrado — use docker-compose.prod.yml no VPS." >&2
  exit 1
fi

if [[ -n "$BRANCH" ]]; then
  echo "==> Checkout branch: $BRANCH"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
fi

COMMIT="$(git rev-parse --short HEAD)"
export GIT_COMMIT="$COMMIT"
echo "==> Commit: $COMMIT ($(git log -1 --oneline))"

echo ""
echo "==> Rebuild web (frontend) com docker-compose.prod.yml..."
docker compose -f "$COMPOSE" build web

echo ""
echo "==> Recriar apenas web (API e DB permanecem intactos)..."
docker compose -f "$COMPOSE" up -d --no-deps --force-recreate web

echo ""
echo "==> Status"
docker compose -f "$COMPOSE" ps

echo ""
echo "✅ Frontend atualizado. Se a API estiver parada, rode:"
echo "   bash ./scripts/recuperar-api-vps.sh"
