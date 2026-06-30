# Spec: Repasse Asaas, pagamentos e financeiro white-label

**Versão:** 2.1  
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

Ledger por ingresso gravado em `registrar_ledger_ingressos_lote()` (`financeiro_organizador.py`), chamado no checkout.

---

## 3. Conta de repasse (organizador)

1. Criar conta em Financeiro → `POST /v3/accounts` com **webhooks** configurados (`asaas_webhooks_config.py`).
2. Acompanhar em `/organizador/financeiro/conta-repasse`.
3. Status: `pending` → `awaiting_approval` → `approved` | `rejected`.
4. CPF/CNPJ gravado em `usuario.asaas_repasse_cpf_cnpj` para validação Pix no saque.

Sync de status: webhook `ACCOUNT_STATUS_*` + worker 10 min + UI poll 20s.

**API:** `POST /api/organizador/asaas/subconta`  
**Acompanhamento:** `GET /api/organizador/asaas/acompanhamento`

---

## 4. Financeiro white-label do organizador

**Base:** `GET/POST /api/organizador/financeiro/*`  
**UI:** `/organizador/financeiro` (`organizador-repasses-painel.tsx`)

### 4.1 Saldo

`GET /api/organizador/financeiro/saldo`

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
- Comprovante: `GET /api/organizador/financeiro/saque/{id}/comprovante` (JSON estruturado).

### 4.3 Extrato e relatórios

- Extrato: `GET /api/organizador/financeiro/extrato` — vendas, estornos (reembolsos), saques.
- Vendas agrupadas: `GET /api/organizador/financeiro/vendas?agrupamento=` — dia, semana, mês, ano, evento.
- Conciliação: `GET /api/organizador/financeiro/conciliacao` (ledger vs saldo Asaas).

**Fórmula de conciliação** (`financeiro_conciliacao.py`):

| Campo | Cálculo |
|-------|---------|
| `ledger.saldo_esperado_asaas` | `liquido_acumulado − saques_pagos_total` |
| `asaas.balance` | `GET /v3/finance/balance` na subconta |
| `diferenca` | `saldo_esperado_asaas − balance` — dispara `alerta` se \|diferença\| > R$ 0,05 |
| `diferenca_disponivel` | `saldo_disponivel_saque − balance` — **informativo**; não dispara alerta |

Valores em carência de saque permanecem no saldo Asaas e **não** devem gerar alerta na conciliação principal.

### 4.4 Estornos

- Reembolso/chargeback cancela ingresso e grava `estornado_em`.
- Estorno aparece no extrato como movimento negativo (`tipo: "estorno"`).

---

## 5. Pagamento do comprador

- Checkout bloqueado sem repasse aprovado (API, schema do evento e UI).
- Webhooks `PAYMENT_*` marcam ingresso pago e definem `pago_em`.
- Reembolso automático se fulfillment bloqueado (`exigir_fulfillment_pagamento`).

---

## 6. Assinatura mensal (plataforma)

- Cobrança 100% plataforma (sem split de ingresso).
- Reutiliza PIX pendente em vez de duplicar cobrança (`_cobranca_assinatura_pendente`).
- Idempotency key única por tentativa.
- Poll em `GET /api/organizador/assinatura` e `POST /api/organizador/assinatura/sincronizar` ativa plano se PIX pago.
- Cobrança: `POST /api/organizador/assinatura/pagar`

---

## 7. Webhooks Asaas (produção)

URL: `https://DOMINIO/api/webhooks/asaas`  
Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`

**Pagamentos:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_OVERDUE`, `PAYMENT_CHARGEBACK_*`

**Conta:** `ACCOUNT_STATUS_*`

**Transferências (saques):** `TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`

Subcontas criadas via API recebem webhooks no payload de `POST /v3/accounts` quando `FRONTEND_PUBLIC_URL` e `ASAAS_WEBHOOK_TOKEN` estão configurados.

Idempotência de eventos por `WebhookEvent.id`.

### 7.1 Autorização de saques (BaaS — sem token SMS)

| Mecanismo | URL / config |
|-----------|----------------|
| Webhook de autorização | `https://DOMINIO/api/webhooks/asaas/transfer-auth` |
| IP whitelist | IP fixo do VPS; desabilitar evento crítico em saques para esse IP (painel Asaas) |
| Header | `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN` |

Resposta da API: `{"status": "APPROVED"}` ou `{"status": "REFUSED", "refuseReason": "..."}`.

Validação: `FinanceiroSaque` por `asaas_transfer_id` ou `externalReference` (id do saque) + valor.

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
- [x] Saldo Asaas real + conciliação (fórmula §4.3)
- [x] Extrato com estornos
- [x] Vendas por período/evento
- [x] Webhooks subconta na criação
- [x] Assinatura: reutilizar PIX, poll, idempotency
- [x] Comprovante de transferência
- [x] Autorização de saques BaaS (webhook + IP whitelist ops) — §7.1
- [ ] NFSe automática (ops/contabilidade — fora do escopo técnico)

---

## 10. Migrations

- `20260625_000032` — `pago_em`, campos saque Asaas (`asaas_transfer_id`, `previsao_liquidacao_em`, `processado_em`)
- `20260626_000033` — `asaas_repasse_cpf_cnpj`, `estornado_em`

---

## 11. Extensões implementadas (além do núcleo acima)

Funcionalidades presentes na build, documentadas para revisão — **não são requisitos adicionais de `/build`**.

| Extensão | Onde |
|----------|------|
| Cancelamento de saque pendente/processando | `POST /api/organizador/financeiro/saque/{id}/cancelar` |
| Listagem de saques | `GET /api/organizador/financeiro/saques` |
| Antecipação automática cartão na subconta | `PUT /api/organizador/asaas/antecipacao`, `POST .../antecipacao/simular` |
| Reenvio de subconta após rejeição KYC | `organizador_asaas.py` → `reenviar_subconta_organizador` |
| Backfill `pago_em` e ledger em ingressos antigos | `financeiro_organizador.py` |
| Comprovante na UI (toast) | `organizador-repasses-painel.tsx` |
| `PAYMENT_CREATED` / `PAYMENT_UPDATED` inscritos em webhooks de subconta | `asaas_webhooks_config.py` (handler ignora — no-op) |
| Scripts operacionais de go-live | `scripts/asaas-webhook-setup.sh`, `scripts/asaas-transfer-auth-setup.sh` |
| Mock Asaas para dev/test (`ASAAS_E2E_MOCK`) | `asaas_e2e_mock.py` |
| Checks de produção no admin | `production_checks.py` |
