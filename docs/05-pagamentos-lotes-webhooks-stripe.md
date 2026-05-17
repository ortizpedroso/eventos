# 05 — Pagamentos, lotes de ingressos e webhooks Stripe

## Modos de operação Stripe na API

| Flag | Efeito |
|------|--------|
| **`STRIPE_DISABLED=true`** | Não cria Customer/Connect no registo conforme ramos do código; pagamento “criar” pode marcar ingresso como **pago** imediatamente com `stripe_payment_intent_id` fake (`disabled_...`) |
| **`STRIPE_SKIP_CONNECT_ON_REGISTER=true`** | Organizador regista-se **sem** `Account.create` Connect (útil até aceitar termos da plataforma no Stripe Dashboard) |

**Produção:** `STRIPE_DISABLED` deve estar **desligado**; `STRIPE_WEBHOOK_SECRET` deve ser o secret real do endpoint de webhook.

## Fluxo `POST /api/pagamentos/criar`

1. **Autenticação** obrigatória (comprador logado).
2. Validação de **evento** existente e **`publicado=true`**.
3. Validação de **participante**: se nome+email de terceiro, exige CPF (válido) e telefone BR (DDD+número); caso contrário usa dados do utilizador.
4. **`resolver_lote_compra(db, evento)`** (`app/services/ingresso_lotes.py`): percorre lotes por `ordem`, aplica `ativo`, datas `vendas_inicio`/`vendas_fim`, e capacidade (`quantidade_maxima` vs contagens `pendente`+`pago`).
5. **`valor_centavos`** do pedido tem de coincidir com `round(lote.preco * 100)` — evita manipulação de preço no cliente.
6. Criação de **`Ingresso`** com `lote_id`, `valor`, `status=pendente`, `stripe_payment_intent_id=intent.id`.
7. **Stripe `PaymentIntent.create`**: `amount`, `currency=brl`, `customer`, `automatic_payment_methods` (com `allow_redirects: never` quando só cartão); **metadata** com ids e participante; se `evento.stripe_account_id`, **`transfer_data.destination`** para Connect.

**Dev local (webhook):** `scripts/stripe-webhook-setup.ps1` → `docker compose up -d api` → `stripe-webhook-dev.ps1` → `compra-teste-stripe.ps1`. Ver [TROUBLESHOOTING](../TROUBLESHOOTING.md).

## Fluxo no browser após `criar`

1. Front recebe `client_secret` e `ingresso_id`.
2. Stripe.js confirma pagamento; em sucesso sem redirect, navega para `/conta/pagamentos?ok=1&ingresso=...`.

## Webhook `POST /api/webhooks/stripe`

- **`_parse_stripe_webhook_event`**: em `DEBUG` + `development` sem secret real, aceita JSON **sem verificar assinatura** (apenas dev); caso contrário usa **`stripe.Webhook.construct_event`**.
- **Idempotência**: se `event["id"]` já existe em **`stripe_events`**, retorna sucesso idempotente.
- **`payment_intent.succeeded`**: localiza `Ingresso` por `stripe_payment_intent_id` → `status=pago`.
- **`payment_intent.payment_failed`**: se `pendente` → `cancelado`.
- **Race duplicado**: `IntegrityError` ao inserir `StripeEvent` → tratado como idempotente.

## Cancelamento e reembolso `POST /api/pagamentos/cancelar`

- Só dono do ingresso; só **`status=pago`**; dentro de **`data_limite_cancelamento`**.
- **`stripe.Refund.create`** com `payment_intent` e `idempotency_key` por ingresso, salvo modo skip (disabled / PI fake).
- Atualiza **`Cancelamento`** e `ingresso.status=cancelado`.

## Lotes — regras de negócio (síntese)

| Conceito | Implementação |
|----------|-----------------|
| Ordem de venda | `EventoIngressoLote.ordem` ascendente |
| Esgotamento | Contagem de ingressos `pendente` + `pago` com `lote_id` ≥ `quantidade_maxima` |
| Janela temporal | `vendas_inicio` ≤ agora ≤ `vendas_fim` (extremos opcionais `NULL` = sem limite desse lado) |
| Preço na vitrine | `evento.preco_ingresso` sincronizado como **mínimo** entre lotes **ativos** (`preco_minimo_lotes_ativos`) |
| Preço na compra | `preco_compra` na API = preço do **lote resolvido**; front deve usar este valor no `valor_centavos` |

## Edição de lotes (`substituir_lotes_evento`)

- Remoção de lote só se **não** houver ingressos `pendente`/`pago` associados.
- Lotes novos no PATCH **sem** `id` são inseridos; com `id` válido do evento são atualizados.

## Segurança e compliance (lembrete)

- Dados de cartão tratados pelo **Stripe** (PCI DSS no processador).
- Logs não devem gravar PAN/CVC; metadata já trunca strings longas onde aplicável.
