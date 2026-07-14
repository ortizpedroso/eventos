#!/usr/bin/env bash
# Restaura produção a partir do backup e sai do modo sandbox.
#
# Uso:
#   ./scripts/voltar-producao-asaas.sh [--reload] [--force]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MARKER="${SANDBOX_MARKER:-.asaas-sandbox-active}"
ARGS=()

for arg in "$@"; do
  case "$arg" in
    --reload|--force) ARGS+=("$arg") ;;
    -h|--help)
      echo "Uso: $0 [--reload] [--force]"
      echo ""
      echo "Restaura .env.prod-backup (ou .env.asaas-prod-backup)"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

echo "=============================================="
echo " EventosBR — voltar para PRODUÇÃO Asaas"
echo "=============================================="

if [ ! -f .env.prod-backup ] && [ ! -f .env.asaas-prod-backup ]; then
  echo "ERRO: nenhum backup de produção encontrado." >&2
  echo "  Esperado: .env.prod-backup (rode backup-prod-env.sh antes do sandbox)" >&2
  exit 1
fi

if [ -f .env.prod-backup ]; then
  echo "==> Verificando backup..."
  ./scripts/verify-prod-backup.sh || echo "AVISO: backup incompleto — restauração parcial." >&2
fi

echo "==> Restaurando .env de produção..."
./scripts/restore-prod-env.sh "${ARGS[@]}"

rm -f "$MARKER"

DOMAIN="$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- || echo eventosbr.app.br)"
echo ""
echo "✅ Produção restaurada."
echo "   ASAAS_ENVIRONMENT deve ser 'production'"
echo "   Webhook: configure no painel Asaas PRODUÇÃO (não sandbox)"
echo "   URL: https://${DOMAIN}/api/webhooks/asaas"
echo ""
if [[ " ${ARGS[*]} " != *" --reload "* ]]; then
  echo "   Reinicie: docker compose -f docker-compose.prod.yml up -d --force-recreate api"
fi
