#!/usr/bin/env bash
# Configuração do webhook Asaas em produção (referência manual).
# A API do Asaas não permite criar webhooks via conta raiz de forma unificada em todos os planos;
# use o painel Asaas ou a API com a chave da conta.
set -euo pipefail

DOMAIN="${1:-}"
TOKEN="${2:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Uso: $0 SEU_DOMINIO.com.br [ASAAS_WEBHOOK_TOKEN]"
  echo ""
  echo "URL do webhook:"
  echo "  https://SEU_DOMINIO/api/webhooks/asaas"
  echo ""
  echo "No painel Asaas (Integrações → Webhooks), configure:"
  echo "  - URL acima"
  echo "  - Token de autenticação = ASAAS_WEBHOOK_TOKEN no .env"
  echo "  - Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_REFUNDED, PAYMENT_OVERDUE, PAYMENT_DELETED"
  echo "  - Eventos: PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  echo "  - Conta: ACCOUNT_STATUS_GENERAL_APPROVAL_*, ACCOUNT_STATUS_COMMERCIAL_INFO_*, ACCOUNT_STATUS_DOCUMENT_*, ACCOUNT_STATUS_BANK_ACCOUNT_INFO_*"
  exit 0
fi

URL="https://${DOMAIN}/api/webhooks/asaas"
echo "Webhook URL: $URL"
if [[ -n "$TOKEN" ]]; then
  echo "Configure o header asaas-access-token com o valor de ASAAS_WEBHOOK_TOKEN no .env (não exibido aqui)."
fi
echo ""
echo "Teste local (com API rodando):"
echo "  curl -X POST '$URL' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'asaas-access-token: SEU_TOKEN' \\"
echo "    -d '{\"event\":\"PAYMENT_RECEIVED\",\"id\":\"evt_test\",\"payment\":{\"id\":\"pay_test\"}}'"
