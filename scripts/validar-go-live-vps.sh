#!/usr/bin/env bash
# Validação operacional pós-deploy (spec §2.8) — rodar NO VPS após merge e atualizar-vps-agora.sh.
#
# NÃO cobra automaticamente: guia os 3 passos (webhook, SMTP, venda real).
# Uso:
#   cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh
#   cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh --webhook-only
#   cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh --smtp-check
#   cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh --all

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/env-file-lib.sh
source "$ROOT/scripts/env-file-lib.sh"

ENV_FILE="${ENV_FILE:-.env}"
RUN_WEBHOOK=0
RUN_SMTP=0
RUN_VENDA=0

if [ $# -eq 0 ]; then
  RUN_WEBHOOK=1
  RUN_SMTP=1
  RUN_VENDA=1
else
  for arg in "$@"; do
    case "$arg" in
      --webhook-only) RUN_WEBHOOK=1 ;;
      --smtp-check) RUN_SMTP=1 ;;
      --venda-check) RUN_VENDA=1 ;;
      --all) RUN_WEBHOOK=1; RUN_SMTP=1; RUN_VENDA=1 ;;
      -h|--help)
        echo "Uso: $0 [--webhook-only] [--smtp-check] [--venda-check] [--all]"
        exit 0
        ;;
      *) echo "Opção desconhecida: $arg" >&2; exit 1 ;;
    esac
  done
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado. Rode bootstrap/deploy antes." >&2
  exit 1
fi

DOMAIN="$(env_get DOMAIN "$ENV_FILE" || echo eventosbr.app.br)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"

echo "=============================================="
echo " EventosBR — validação go-live (spec §2.8)"
echo " Domínio: $DOMAIN | commit: $COMMIT"
echo "=============================================="
echo ""

echo "==> Pré-check: verify-production.sh"
bash "$ROOT/scripts/verify-production.sh"
echo ""

if [ "$RUN_WEBHOOK" -eq 1 ]; then
  echo "==> §2.8 A — Webhook (token + URL)"
  bash "$ROOT/scripts/test-asaas-webhook.sh" --expect-ok
  echo ""
  echo "    Próximo passo manual:"
  echo "    1. Painel Asaas → Webhooks → $DOMAIN/api/webhooks/asaas"
  echo "    2. Token = ASAAS_WEBHOOK_TOKEN do .env (header asaas-access-token)"
  echo "    3. Eventos: PAYMENT_*, ACCOUNT_STATUS_*"
  echo "    4. Faça uma compra de teste e confirme PAYMENT_RECEIVED nos logs da API"
  echo ""
fi

if [ "$RUN_SMTP" -eq 1 ]; then
  echo "==> §2.8 B — SMTP"
  for var in EMAIL_USER EMAIL_PASSWORD EMAIL_SERVER; do
    if [ -n "$(env_get "$var" "$ENV_FILE" || true)" ]; then
      echo "    OK  $var definida"
    else
      echo "    FALHA  $var vazia"
      exit 1
    fi
  done
  echo ""
  echo "    Próximo passo manual:"
  echo "    1. Compra de teste → e-mail de ingresso na caixa de entrada"
  echo "    2. Validar SPF/DKIM do domínio remetente no DNS"
  echo ""
fi

if [ "$RUN_VENDA" -eq 1 ]; then
  echo "==> §2.8 C — Primeira venda real"
  echo "    Checklist manual:"
  echo "    [ ] Organizador com conta de recebimento approved (Financeiro)"
  echo "    [ ] Evento publicado com ingresso pago"
  echo "    [ ] Compra PIX ou cartão concluída"
  echo "    [ ] QR do ingresso em Minha conta → Ingressos"
  echo "    [ ] E-mail de ingresso recebido"
  echo "    [ ] Split visível no Financeiro do organizador"
  echo ""
  echo "    Teste mock automatizado (não cobra):"
  bash "$ROOT/scripts/test-compra-split-mock.sh"
  echo ""
fi

echo "=============================================="
echo " Validação automatizada concluída."
echo " Complete os passos manuais acima e marque §2.8 na spec."
echo "=============================================="
