#!/usr/bin/env bash
# ÚNICO script do VPS — atualiza código (main/Asaas), .env, Postgres e sobe o site.
#
# Uso (só isto):
#   cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh
#
# Não precisa editar .env, copiar senhas nem configurar Stripe (removido — só Asaas).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker-compose.prod.yml"

# Se o servidor ainda tem código antigo sem os scripts novos, puxa main e reexecuta.
if [ ! -f "$ROOT/scripts/env-file-lib.sh" ] || [ ! -f "$ROOT/scripts/sync-postgres-password-vps.sh" ]; then
  echo "==> Código antigo detectado — atualizando de origin/main..."
  export GIT_TERMINAL_PROMPT=0
  git fetch origin main
  git checkout -B main origin/main 2>/dev/null || true
  git reset --hard origin/main
  exec bash "$ROOT/scripts/atualizar-vps-agora.sh" "$@"
fi

# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

echo "=============================================="
echo " EventosBR — deploy VPS (main / Asaas)"
echo "=============================================="

echo ""
echo "[1/9] Atualizando código = origin/main..."
export GIT_TERMINAL_PROMPT=0
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main
git branch --set-upstream-to=origin/main main 2>/dev/null || true

COMMIT="$(git rev-parse --short HEAD)"
export GIT_COMMIT="$COMMIT"
echo "    Commit: $COMMIT ($(git log -1 --oneline))"

if ! grep -q 'PAYMENT_PROVIDER' config/settings.py 2>/dev/null; then
  echo "ERRO: código inesperado (sem Asaas). Confira o repositório." >&2
  exit 1
fi

echo ""
echo "[2/9] .env (gera o que faltar — preserva Asaas/e-mail já configurados)..."
if [ ! -f .env ]; then
  ./scripts/bootstrap-vps-env.sh
elif ! ./scripts/validate-env-production.sh 2>/dev/null; then
  ./scripts/bootstrap-vps-env.sh
fi

DOMAIN="$(env_get DOMAIN .env || echo eventosbr.app.br)"

echo ""
echo "[3/9] Postgres + Redis..."
docker compose -f "$COMPOSE" up -d db redis

echo ""
echo "[4/9] Sincronizando senha Postgres com .env..."
./scripts/sync-postgres-password-vps.sh

echo ""
echo "[5/9] Build API..."
docker compose -f "$COMPOSE" build api
docker compose -f "$COMPOSE" up -d api

echo ""
echo "[6/9] Aguardando API healthy (até 4 min)..."
ok_api=0
for i in $(seq 1 48); do
  status="$(docker compose -f "$COMPOSE" ps api --format '{{.Health}}' 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    ok_api=1
    echo "  OK  API healthy"
    break
  fi
  if [ "$i" -eq 16 ] || [ "$i" -eq 32 ]; then
    docker compose -f "$COMPOSE" logs api --tail=8 2>/dev/null || true
  fi
  sleep 5
done
if [ "$ok_api" -ne 1 ]; then
  echo "ERRO: API não ficou healthy." >&2
  docker compose -f "$COMPOSE" logs api --tail=80 >&2
  exit 1
fi

echo ""
echo "[7/9] Build frontend (5-15 min)..."
docker compose -f "$COMPOSE" build --no-cache web

echo ""
echo "[8/9] Subindo web + caddy..."
docker compose -f "$COMPOSE" up -d --force-recreate web caddy

sleep 12
docker compose -f "$COMPOSE" ps

echo ""
echo "[9/9] Verificação..."
ok=0

if curl -fsS --max-time 20 "https://${DOMAIN}/ready" >/dev/null 2>&1; then
  echo "  OK  https://${DOMAIN}/ready"
else
  echo "  FALHA  /ready"
  ok=1
fi

HTML="$(curl -fsS --max-time 30 "https://${DOMAIN}/" 2>/dev/null || true)"
if echo "$HTML" | grep -q 'href="/organizador/novo"'; then
  echo "  OK  frontend atualizado"
else
  echo "  AVISO  frontend — aguarde 30s e recarregue (Ctrl+Shift+R)"
fi

BUILD_ON_SITE="$(echo "$HTML" | grep -o 'data-eventosbr-build="[^"]*"' | head -1 || true)"
if [ -n "$BUILD_ON_SITE" ]; then
  echo "  INFO  $BUILD_ON_SITE"
fi

asaas_off="$(env_get ASAAS_DISABLED .env || echo false)"
if [ "$asaas_off" = "true" ]; then
  echo "  AVISO  ASAAS_DISABLED=true — site no ar; pagamentos após configure-asaas-env.sh no servidor"
fi

echo ""
if [ "$ok" -eq 0 ]; then
  echo "✅ SITE NO AR: https://${DOMAIN}"
else
  echo "❌ Problema no /ready — envie: docker compose -f $COMPOSE logs api --tail=60"
  exit 1
fi
