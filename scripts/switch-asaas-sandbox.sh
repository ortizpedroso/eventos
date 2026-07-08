#!/usr/bin/env bash
# Faz backup das credenciais atuais e alterna o .env para Asaas sandbox (testes).
#
# Uso no VPS:
#   cd /opt/eventosbr
#   ./scripts/switch-asaas-sandbox.sh \
#     --api-key '$aact_hmlg_...' \
#     --platform-wallet 'uuid-sandbox' \
#     --webhook-token 'token-sandbox'
#
# Com reload automático da API:
#   ./scripts/switch-asaas-sandbox.sh --reload --api-key '...' --platform-wallet '...' --webhook-token '...'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE:-docker-compose.prod.yml}"
RELOAD=0
ARGS=()

usage() {
  echo "Uso: $0 [--reload] --api-key KEY --platform-wallet ID --webhook-token TOKEN"
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --reload) RELOAD=1; shift ;;
    --api-key|--platform-wallet|--webhook-token|--env)
      ARGS+=("$1" "$2")
      shift 2
      ;;
    -h|--help) usage ;;
    *) echo "Opção desconhecida: $1" >&2; usage ;;
  esac
done

if [ ${#ARGS[@]} -lt 6 ]; then
  echo "ERRO: informe --api-key, --platform-wallet e --webhook-token do sandbox." >&2
  usage
fi

echo "==> 1/3 Backup das credenciais atuais..."
"$ROOT/scripts/backup-asaas-prod-env.sh"

echo ""
echo "==> 2/3 Aplicando sandbox no .env..."
"$ROOT/scripts/configure-asaas-env.sh" --env sandbox "${ARGS[@]}"

DOMAIN="$(grep '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- || echo 'eventosbr.app.br')"

echo ""
echo "==> 3/3 Webhooks no painel Asaas SANDBOX:"
echo "  https://${DOMAIN}/api/webhooks/asaas"
echo "  https://${DOMAIN}/api/webhooks/asaas/transfer-auth"
echo "  IP whitelist: 187.77.240.125"
echo ""
echo "Após os testes, volte para produção:"
echo "  ./scripts/restore-asaas-prod-env.sh --reload"

if [ "$RELOAD" -eq 1 ]; then
  echo ""
  echo "==> Recriando api..."
  docker compose -f "$COMPOSE" up -d --force-recreate api
  echo "OK — sandbox ativo."
fi
