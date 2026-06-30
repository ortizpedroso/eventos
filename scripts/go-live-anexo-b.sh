#!/usr/bin/env bash
# Anexo B — checklist go-live eventosbr.app.br (executar no VPS com .env de produção).
# Uso: cd /opt/eventosbr && bash ./scripts/go-live-anexo-b.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE="docker-compose.prod.yml"

echo "=============================================="
echo " EventosBR — Anexo B go-live"
echo "=============================================="

if [[ ! -f .env ]]; then
  echo "ERRO: copie .env.production.example → .env e preencha secrets." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env
DOMAIN="${DOMAIN:-eventosbr.app.br}"

check_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "  FALTA  $var"
    return 1
  fi
  echo "  OK     $var"
  return 0
}

echo ""
echo "[1] Variáveis obrigatórias"
fail=0
check_env ASAAS_API_KEY || fail=1
check_env ASAAS_WEBHOOK_TOKEN || fail=1
check_env ASAAS_PLATFORM_WALLET_ID || fail=1
check_env EMAIL_SERVER || fail=1
check_env EMAIL_USER || fail=1
check_env EMAIL_PASSWORD || fail=1
[[ $fail -eq 0 ]] || exit 1

echo ""
echo "[2] Deploy / atualização"
bash ./scripts/atualizar-vps-agora.sh

echo ""
echo "[3] Webhook Asaas"
echo "  Configure no painel Asaas:"
echo "  POST https://${DOMAIN}/api/webhooks/asaas"
echo "  Token: (valor de ASAAS_WEBHOOK_TOKEN no .env)"

echo ""
echo "[4] DNS"
echo "  A @ e www → IP deste VPS (${DOMAIN})"

echo ""
echo "[5] Pós-go-live manual"
echo "  - SPF/DKIM para noreply@${DOMAIN}"
echo "  - Cron: backup-postgres-cron.sh, monitor-ready.sh"
echo "  - Organizadores: walletId em Financeiro"
echo "  - 1ª venda real (PIX ou cartão)"

echo ""
echo "✅ Anexo B: passos automatizáveis concluídos. Complete os itens manuais acima."
