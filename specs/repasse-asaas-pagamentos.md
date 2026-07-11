# Spec: Repasse Asaas, pagamentos e financeiro white-label

**Versão:** 2.2  
**Data:** 2026-07-11  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

---

## 1. Objetivo

Garantir que vendas de ingressos pagos distribuam valores corretamente entre **organizador**, **plataforma EventosBR** e **taxas Asaas**; que eventos pagos só sejam **publicados e vendidos** após **conta de repasse configurada**; e que o organizador acompanhe vendas e extrato na plataforma.

**Dois modos de repasse** (controlados por `ASAAS_ONBOARDING_MODE`):

| Modo | Onboarding | Saques | Painel Asaas do organizador |
|------|------------|--------|-----------------------------|
| **`linked`** (padrão) | Vincula `walletId` da conta Asaas própria | No painel Asaas do organizador | Necessário para saque |
| **`baas`** | Subconta criada via `POST /v3/accounts` | White-label na plataforma (Pix) | Opcional |
| **`both`** | Ambos os fluxos disponíveis | Conforme tipo de conta ativa | Conforme tipo |

---

## 2. Distribuição do valor (split)

| Destino | O que recebe | Como |
|---------|----------------|------|
| **Organizador** | Preço − taxa EventosBR − descontos | `split[].walletId` = wallet do organizador |
| **Plataforma** | Taxa EventosBR (% + fixo) | Permanece na conta emissora (fora do array `split`) |
| **Asaas** | Taxas gateway | Fora do split |

**Regra Asaas:** a cobrança é criada com a API key da **plataforma**; o array `split` contém **somente** o wallet do organizador. Não incluir `ASAAS_PLATFORM_WALLET_ID` no split.

Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

Ledger por ingresso gravado em `registrar_ledger_ingressos_lote()` (`financeiro_organizador.py`), chamado no checkout.

---

## 3. Conta de repasse (organizador)

### 3.1 Modo linked (padrão)

1. Organizador cria/acessa conta no Asaas (sandbox ou produção).
2. Copia o `walletId` no painel Asaas.
3. Em Financeiro → **Vincular conta Asaas** (`PUT /api/organizador/asaas/wallet`).
4. Status `linked` libera publicação e venda imediatamente (sem KYC de subconta na plataforma).
5. Repasses caem na conta Asaas do organizador via split; saques são feitos **no painel Asaas**.

**API:** `PUT /api/organizador/asaas/wallet` — body `{ "wallet_id": "...", "sincronizar_eventos": true }`

**Resposta de status** (`GET /api/organizador/asaas`): inclui `onboarding_mode`, `permite_vinculo_wallet`, `permite_subconta`, `wallet_id`, `repasse_status`, `repasses_prontos`.

### 3.2 Modo BaaS (`baas` ou `both`)

1. Criar subconta em Financeiro → `POST /api/organizador/asaas/subconta` → `POST /v3/accounts` com webhooks (`asaas_webhooks_config.py`).
2. Acompanhar em `/organizador/financeiro/conta-repasse` (KYC).
3. Status: `pending` → `awaiting_approval` → `approved` | `rejected`.
4. CPF/CNPJ gravado em `usuario.asaas_repasse_cpf_cnpj` para validação Pix no saque white-label.

Sync de status: webhook `ACCOUNT_STATUS_*` + worker 10 min + UI poll 20s.

**APIs adicionais:** `POST /api/organizador/asaas/subconta`, `POST .../subconta/reenviar`, `GET /api/organizador/asaas/acompanhamento`

### 3.3 Status que liberam venda/publicação

Definidos em `app/services/evento_repasse.py` → `status_repasse_aprovados()`:

| Status | Quando |
|--------|--------|
| `linked` | Conta vinculada (modo `linked` ou `both`) |
| `approved` | Subconta BaaS aprovada pelo Asaas |
| `manual` | Apenas com `ASAAS_ALLOW_MANUAL_WALLET=true` ou dev/test |

---

## 4. Financeiro do organizador

**Base:** `GET/POST /api/organizador/financeiro/*`  
**UI:** `/organizador/financeiro` (`organizador-repasses-painel.tsx`)

### 4.1 Saldo

`GET /api/organizador/financeiro/saldo`

| Campo | Significado |
|-------|-------------|
| `liquido_acumulado` | Total líquido de ingressos pagos/usados |
| `saldo_em_carencia` | Ainda dentro de `FINANCEIRO_CARENCIA_SAQUE_HORAS` (default 48h) após `pago_em` |
| `saldo_disponivel_saque` | Liberado após carência − saques comprometidos (modo BaaS) |
| `saldo_asaas.balance` | Saldo real na subconta (`GET /v3/finance/balance`) — **só modo BaaS** |
| `saque_habilitado` | `true` apenas com API key de subconta; `false` no modo linked |
| `nota_saque` | Mensagem contextual (white-label vs. sacar no Asaas) |

### 4.2 Saque / transferência Pix

**Modo BaaS (subconta):**

- `POST /api/organizador/financeiro/saque` → `POST /v3/transfers` (API key subconta).
- Carência: 48h após confirmação do pagamento (`pago_em` no ingresso).
- Prazo informado ao organizador: até `FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS` (default 48h).
- Chave Pix CPF/CNPJ deve coincidir com cadastro da subconta.
- Comprovante: `GET /api/organizador/financeiro/saque/{id}/comprovante` (JSON estruturado).

**Modo linked:**

- Saques **não** são solicitados pela plataforma (`saque_habilitado: false`).
- Organizador saca no próprio painel Asaas; extrato e vendas permanecem na plataforma para acompanhamento.

### 4.3 Extrato e relatórios

- Extrato: `GET /api/organizador/financeiro/extrato` — vendas, estornos (reembolsos), saques.
- Vendas agrupadas: `GET /api/organizador/financeiro/vendas?agrupamento=` — dia, semana, mês, ano, evento.
- Conciliação: `GET /api/organizador/financeiro/conciliacao` (ledger vs saldo Asaas — **relevante no modo BaaS**).

**Fórmula de conciliação** (`financeiro_conciliacao.py`) — modo BaaS:

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

- Checkout bloqueado sem repasse configurado (`linked`, `approved` ou `manual` conforme §3.3).
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

**Conta:** `ACCOUNT_STATUS_*` (modo BaaS)

**Transferências (saques):** `TRANSFER_*` (modo BaaS)

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

**Não aplicável** ao modo `linked` (organizador saca direto no Asaas).

---

## 8. Variáveis de ambiente

| Variável | Produção |
|----------|----------|
| `ASAAS_API_KEY` | Obrigatório |
| `ASAAS_PLATFORM_WALLET_ID` | Obrigatório (conta emissora; não entra no split) |
| `ASAAS_WEBHOOK_TOKEN` | Obrigatório |
| `ASAAS_ONBOARDING_MODE` | `linked` (padrão), `baas` ou `both` |
| `FRONTEND_PUBLIC_URL` | URL pública (webhooks subconta) |
| `FINANCEIRO_CARENCIA_SAQUE_HORAS` | Default `48` |
| `FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS` | Default `48` |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` (bypass dev/test; não substitui modo linked) |

---

## 9. Critérios de conclusão

### Núcleo (ambos os modos)

- [x] Split: líquido organizador no array `split`; taxa plataforma na conta emissora
- [x] Bloqueio publicação/venda sem repasse configurado
- [x] Extrato com estornos
- [x] Vendas por período/evento
- [x] Assinatura: reutilizar PIX, poll, idempotency
- [ ] NFSe automática (ops/contabilidade — fora do escopo técnico)

### Modo linked (`ASAAS_ONBOARDING_MODE=linked`)

- [x] `PUT /api/organizador/asaas/wallet` em produção
- [x] Status `linked` libera venda
- [x] UI: formulário “Vincular conta Asaas” com instruções
- [x] `nota_saque` orienta saque no painel Asaas
- [ ] Validação opcional do `walletId` via API Asaas (não implementado)

### Modo BaaS (`baas` ou `both`)

- [x] Subconta + KYC + bloqueio até `approved`
- [x] Saque Pix white-label com carência 48h
- [x] Saldo Asaas real + conciliação (fórmula §4.3)
- [x] Webhooks subconta na criação
- [x] Comprovante de transferência
- [x] Autorização de saques BaaS (webhook + IP whitelist ops) — §7.1

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
| Scripts sandbox (backup/restore/switch) | `scripts/backup-asaas-prod-env.sh`, `restore-asaas-prod-env.sh`, `switch-asaas-sandbox.sh` |
| Mock Asaas para dev/test (`ASAAS_E2E_MOCK`) | `asaas_e2e_mock.py` |
| Checks de produção no admin | `production_checks.py` |
| Máscaras CPF/CNPJ, CEP, telefone | `lib/cpf.ts`, `lib/cep.ts`, `lib/telefone-br.ts` |
