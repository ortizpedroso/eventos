# Spec: Repasse Asaas, pagamentos e financeiro white-label

**Versão:** 2.0  
**Data:** 2026-06-26  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

---

## 1. Objetivo

Garantir que vendas de ingressos pagos distribuam valores corretamente entre **organizador**, **plataforma EventosBR** e **taxas Asaas**; que eventos pagos só sejam **publicados e vendidos** após **conta de repasse aprovada**; e que o organizador opere **100% na plataforma** (vendas, saldo, saques, extrato) sem acessar o painel Asaas.

---

## 2. Distribuição do valor (split)

| Destino | O que recebe | Como |
|---------|----------------|------|
| **Organizador** | Preço − taxa EventosBR − descontos | `split[].walletId` = wallet subconta |
| **Plataforma** | Taxa EventosBR (% + fixo) | `ASAAS_PLATFORM_WALLET_ID` |
| **Asaas** | Taxas gateway | Fora do split |

Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

---

## 3. Conta de repasse (organizador)

1. Criar conta em Financeiro → `POST /v3/accounts` com **webhooks** configurados (`asaas_webhooks_config.py`).
2. Acompanhar em `/organizador/financeiro/conta-repasse`.
3. Status: `pending` → `awaiting_approval` → `approved` | `rejected`.
4. CPF/CNPJ gravado em `usuario.asaas_repasse_cpf_cnpj` para validação Pix no saque.

Sync de status: webhook `ACCOUNT_STATUS_*` + worker 10 min + UI poll 20s.

---

## 4. Financeiro white-label do organizador

### 4.1 Saldo

| Campo | Significado |
|-------|-------------|
| `liquido_acumulado` | Total líquido de ingressos pagos/usados |
| `saldo_em_carencia` | Ainda dentro de `FINANCEIRO_CARENCIA_SAQUE_HORAS` (default 48h) após `pago_em` |
| `saldo_disponivel_saque` | Liberado após carência − saques comprometidos |
| `saldo_asaas.balance` | Saldo real na subconta (`GET /v3/finance/balance`) |

### 4.2 Saque / transferência Pix

- `POST /api/organizador/financeiro/saque` → `POST /v3/transfers` (API key subconta).
- Carência: 48h após confirmação do pagamento (`pago_em` no ingresso).
- Prazo informado ao organizador: até `FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS` (default 48h).
- Chave Pix CPF/CNPJ deve coincidir com cadastro da subconta.
- Comprovante: `GET /api/organizador/financeiro/saque/{id}/comprovante`.

### 4.3 Extrato e relatórios

- Extrato: vendas, estornos (reembolsos), saques.
- Vendas agrupadas: dia, semana, mês, ano, evento.
- Conciliação: `GET /api/organizador/financeiro/conciliacao` (ledger vs saldo Asaas).

### 4.4 Estornos

- Reembolso/chargeback cancela ingresso e grava `estornado_em`.
- Estorno aparece no extrato como movimento negativo.

---

## 5. Pagamento do comprador

- Checkout bloqueado sem repasse aprovado.
- Webhooks `PAYMENT_*` marcam ingresso pago e definem `pago_em`.
- Reembolso automático se fulfillment bloqueado.

---

## 6. Assinatura mensal (plataforma)

- Cobrança 100% plataforma (sem split de ingresso).
- Reutiliza PIX pendente em vez de duplicar cobrança.
- Idempotency key única por tentativa.
- Poll em `GET /assinatura` e `POST /assinatura/sincronizar` ativa plano se PIX pago.

---

## 7. Webhooks Asaas (produção)

URL: `https://DOMINIO/api/webhooks/asaas`  
Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`

**Pagamentos:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_OVERDUE`, `PAYMENT_CHARGEBACK_*`

**Conta:** `ACCOUNT_STATUS_*`

**Transferências (saques):** `TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`

Subcontas criadas via API recebem webhooks no payload de `POST /v3/accounts` quando `FRONTEND_PUBLIC_URL` e `ASAAS_WEBHOOK_TOKEN` estão configurados.

---

## 8. Variáveis de ambiente

| Variável | Produção |
|----------|----------|
| `ASAAS_API_KEY` | Obrigatório |
| `ASAAS_PLATFORM_WALLET_ID` | Obrigatório |
| `ASAAS_WEBHOOK_TOKEN` | Obrigatório |
| `FRONTEND_PUBLIC_URL` | URL pública (webhooks subconta) |
| `FINANCEIRO_CARENCIA_SAQUE_HORAS` | Default `48` |
| `FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS` | Default `48` |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` |

---

## 9. Critérios de conclusão

- [x] Split organizador + plataforma
- [x] Subconta + KYC + bloqueio publicação/venda
- [x] Saque Pix white-label com carência 48h
- [x] Saldo Asaas real + conciliação
- [x] Extrato com estornos
- [x] Vendas por período/evento
- [x] Webhooks subconta na criação
- [x] Assinatura: reutilizar PIX, poll, idempotency
- [x] Comprovante de transferência
- [ ] NFSe automática (ops/contabilidade — fora do escopo técnico)
- [ ] Alinhamento Asaas white-label para transferências sem token SMS (ação comercial)

---

## 10. Migrations

- `20260625_000032` — `pago_em`, campos saque Asaas
- `20260626_000033` — `asaas_repasse_cpf_cnpj`, `estornado_em`
