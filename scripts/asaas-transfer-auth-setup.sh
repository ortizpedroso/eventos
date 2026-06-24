#!/usr/bin/env bash
# Referência para autorização de saques Asaas (BaaS — sem token SMS).
set -euo pipefail

DOMAIN="${1:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Uso: $0 SEU_DOMINIO.com.br"
  echo ""
  echo "1) IP fixo (Integrações → Mecanismos de segurança → Lista de IPs):"
  echo "   - Adicione o IP público de saída do VPS"
  echo "   - Desabilite 'Evento crítico em requisições de saque' para esse IP"
  echo ""
  echo "2) Webhook de autorização de saque:"
  echo "   URL: https://SEU_DOMINIO/api/webhooks/asaas/transfer-auth"
  echo "   Token (header asaas-access-token): mesmo ASAAS_WEBHOOK_TOKEN do .env"
  echo ""
  echo "Docs:"
  echo "  https://docs.asaas.com/docs/ip-whitelisting"
  echo "  https://docs.asaas.com/docs/mechanism-for-validating-withdrawals-via-webhooks"
  exit 0
fi

URL="https://${DOMAIN}/api/webhooks/asaas/transfer-auth"
echo "Webhook autorização de saque: $URL"
echo ""
echo "Configure no painel Asaas (Integrações → Mecanismos de segurança):"
echo "  - URL acima"
echo "  - Token = ASAAS_WEBHOOK_TOKEN no .env"
echo "  - E-mail para notificações de falha"
echo ""
echo "Teste (com API rodando e token configurado):"
echo "  curl -X POST '$URL' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'asaas-access-token: SEU_TOKEN' \\"
echo "    -d '{\"type\":\"TRANSFER\",\"transfer\":{\"id\":\"tra_test\",\"value\":10,\"status\":\"PENDING\"}}'"
