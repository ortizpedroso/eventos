#!/usr/bin/env bash
# Deploy completo no VPS: pull + rebuild api/web + recreate + checagem /ready.
# Alias operacional de deploy-vps.sh com passos extras para releases de frontend.
#
# Uso: cd /opt/eventosbr && ./scripts/atualizar-vps-agora.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE:-docker-compose.prod.yml}"

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado" >&2
  exit 1
fi

DOMAIN_VAL="$(grep -m1 '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
DOMAIN_VAL="${DOMAIN_VAL:-eventosbr.app.br}"

echo "==> git pull"
git pull --ff-only

echo "==> subir db + redis"
docker compose -f "$COMPOSE" up -d db redis

echo "==> build + recreate api"
docker compose -f "$COMPOSE" build api
docker compose -f "$COMPOSE" up -d --force-recreate api

echo "==> aguardar API /ready"
for i in $(seq 1 40); do
  if docker compose -f "$COMPOSE" exec -T api python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready', timeout=8)" 2>/dev/null; then
    echo "API pronta."
    break
  fi
  if [ "$i" -eq 40 ]; then
    echo "ERRO: API não ficou pronta — logs:" >&2
    docker compose -f "$COMPOSE" logs api --tail=40 >&2
    exit 1
  fi
  sleep 3
done

echo "==> build + recreate web + caddy"
docker compose -f "$COMPOSE" build --no-cache web
docker compose -f "$COMPOSE" up -d --force-recreate web caddy

echo "==> estado"
docker compose -f "$COMPOSE" ps

echo ""
echo "==> checagem pública"
if curl -sf "https://${DOMAIN_VAL}/ready" >/dev/null; then
  echo "OK https://${DOMAIN_VAL}/ready"
else
  echo "AVISO: https://${DOMAIN_VAL}/ready não respondeu — verifique DNS/Caddy" >&2
fi

echo ""
echo "Próximo passo (vitrine demo):"
echo "  python3 scripts/seed-vitrine-profissional.py"
