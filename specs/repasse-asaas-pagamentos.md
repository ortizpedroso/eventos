# Spec: Repasse Asaas e split de pagamentos

**Versão:** 1.1  
**Data:** 2026-06-22  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

---

## 1. Objetivo

Garantir que vendas de ingressos pagos distribuam valores corretamente entre **organizador**, **plataforma EventosBR** e **taxas Asaas**, e que eventos pagos só sejam **publicados e vendidos** após **conta de repasse aprovada pelo Asaas**.

---

## 2. Distribuição do valor (split)

| Destino | O que recebe | Como |
|---------|----------------|------|
| **Organizador** | Preço do ingresso − taxa EventosBR − descontos (ex.: parcelamento) | `split[].walletId` = wallet da subconta (`evento.asaas_wallet_id`) |
| **Plataforma** | Taxa EventosBR (% + fixo por plano) | `split[].walletId` = `ASAAS_PLATFORM_WALLET_ID` |
| **Asaas** | Taxas de gateway (PIX, cartão, boleto, parcelamento) | **Fora do split** — retidas pelo Asaas na conta mestre / descontadas no processamento |

Regras adicionais:

- Acréscimo de parcelamento pago pelo **comprador** entra no `value` total da cobrança, mas **não** entra no split.
- Se `repasse_parcelamento = organizador`, o desconto de parcelamento reduz o líquido do organizador no ledger interno.
- Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

---

## 3. Conta de repasse (organizador)

### 3.1 Fluxo obrigatório em produção

1. Organizador acessa **Financeiro** → **Criar conta de repasses**.
2. Dados enviados via `POST /v3/accounts` (subconta Asaas).
3. Redirecionamento para `/organizador/financeiro/conta-repasse` (acompanhamento).
4. Asaas valida cadastro (KYC) — status: `pending` → `awaiting_approval` → `approved` ou `rejected`.
5. Com `approved`, organizador pode **publicar** eventos pagos e **vender** ingressos.

### 3.2 Atualização de status (três camadas)

| Camada | Mecanismo |
|--------|-----------|
| 1 | Webhook `ACCOUNT_STATUS_*` → `POST /api/webhooks/asaas` |
| 2 | Worker a cada 10 min → poll `GET /v3/myAccount/status` (subcontas pendentes) |
| 3 | UI a cada 20 s → `GET /api/organizador/asaas/acompanhamento` |

### 3.3 Wallet manual (desativada em produção)

- `PUT /api/organizador/asaas/wallet` **bloqueado** quando `ASAAS_ALLOW_MANUAL_WALLET=false` (padrão em produção).
- Exceção: header `X-Platform-Admin-Key` válido (suporte/migração).
- Em `development`/`test`, wallet manual permanece disponível para E2E.

### 3.4 Conta reprovada

- Status `rejected` → organizador vê motivo na timeline.
- `POST /api/organizador/asaas/subconta/reenviar` limpa vínculo local reprovado e reenvia dados ao Asaas.

---

## 4. Publicação e venda

| Ação | Evento gratuito | Evento pago |
|------|-----------------|-------------|
| Criar pausado | ✅ | ✅ |
| Visualizar (organizador) | ✅ | ✅ |
| Publicar na vitrine | ✅ | ❌ sem repasse `approved` |
| Comprar ingresso | ✅ (sem gateway) | ❌ sem repasse `approved` |

Validações:

- API: `validar_publicacao_evento_pago()`, `organizador_pode_vender()`
- Frontend: checklist + radio “Publicar” desabilitado
- Default: `publicado: false` ao criar evento

---

## 5. Webhooks Asaas (produção)

Configurar em Integrações → Webhooks → `https://DOMINIO/api/webhooks/asaas`

**Pagamentos:**

- `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`
- `PAYMENT_REFUNDED`
- `PAYMENT_DELETED`, `PAYMENT_OVERDUE`
- `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`

**Conta (repasse):**

- `ACCOUNT_STATUS_GENERAL_APPROVAL_*`
- `ACCOUNT_STATUS_COMMERCIAL_INFO_*`
- `ACCOUNT_STATUS_DOCUMENT_*`
- `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_*`

Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`

---

## 6. Variáveis de ambiente

| Variável | Produção |
|----------|----------|
| `ASAAS_API_KEY` | Obrigatório |
| `ASAAS_PLATFORM_WALLET_ID` | Obrigatório (split plataforma) |
| `ASAAS_WEBHOOK_TOKEN` | Obrigatório |
| `ASAAS_DISABLED` | `false` |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` (padrão) |

---

## 7. Critérios de conclusão

- [x] Split organizador + plataforma no `POST /v3/payments`
- [x] Taxa Asaas fora do split (gateway)
- [x] Subconta + acompanhamento + poll/webhook de status
- [x] Bloqueio publicação/venda sem repasse aprovado
- [x] Wallet manual bloqueada em produção
- [x] Reenvio após reprovação
- [x] Webhook `ACCOUNT_STATUS_*` e chargeback
- [x] Worker de sync de repasses pendentes
