#!/usr/bin/env bash
# Diagnóstico e recuperação quando eventosbr-api-1 falha ao subir.
# Uso: cd /opt/eventosbr && bash ./scripts/recuperar-api-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $ROOT" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE" ]]; then
  echo "ERRO: $COMPOSE não encontrado." >&2
  exit 1
fi

echo "=============================================="
echo " EventosBR — diagnóstico API"
echo "=============================================="
echo ""
echo "Compose: $COMPOSE"
echo ""

echo "==> Containers"
docker compose -f "$COMPOSE" ps || true
echo ""

echo "==> Últimos logs da API (80 linhas)"
docker compose -f "$COMPOSE" logs api --tail 80 2>&1 || true
echo ""

echo "==> Variáveis críticas no .env"
for var in SECRET_KEY POSTGRES_PASSWORD ENVIRONMENT; do
  if grep -q "^${var}=." .env 2>/dev/null; then
    echo "  OK  $var definida"
  else
    echo "  FALHA  $var vazia ou ausente"
  fi
done
echo ""

echo "==> Tentando subir API com compose de produção..."
docker compose -f "$COMPOSE" up -d api

echo ""
echo "Aguardando 15s..."
sleep 15

echo ""
docker compose -f "$COMPOSE" ps

if docker compose -f "$COMPOSE" ps api 2>/dev/null | grep -qE 'Up|healthy'; then
  echo ""
  echo "✅ API em execução. Subindo web se necessário..."
  docker compose -f "$COMPOSE" up -d web caddy 2>/dev/null || docker compose -f "$COMPOSE" up -d web
  echo ""
  echo "Teste: curl -fsS https://\${DOMAIN:-eventosbr.app.br}/ready"
else
  echo ""
  echo "❌ API ainda falhou. Causas comuns:"
  echo "  1. Comando sem -f docker-compose.prod.yml (senha do Postgres errada)"
  echo "  2. SECRET_KEY ausente ou fraca no .env"
  echo "  3. Migração Alembic com erro (coluna duplicada)"
  echo ""
  echo "Envie a saída acima (logs da API) para análise."
  exit 1
fi
