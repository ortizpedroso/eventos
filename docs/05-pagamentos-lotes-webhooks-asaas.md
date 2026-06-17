# 05 — Pagamentos, lotes de ingressos e webhooks Asaas

## Modos de operação na API

| Flag | Efeito |
|------|--------|
| **`ASAAS_DISABLED=true`** | Não chama a API Asaas no registo/compra; `POST /criar` pode marcar ingresso como **pago** imediatamente com referência fake (`disabled_...`) — apenas `development`/`test` |
| **`ASAAS_E2E_MOCK=true`** | Respostas mock da API Asaas (E2E Playwright) |

**Produção:** `ASAAS_DISABLED` deve estar **desligado**; `ASAAS_WEBHOOK_TOKEN` obrigatório; `ASAAS_PLATFORM_WALLET_ID` para split da taxa.

## Fluxo `POST /api/pagamentos/criar`

1. **Autenticação** obrigatória (comprador logado).
2. Validação de **evento** existente e **`publicado=true`**.
3. Validação de **participante**: se nome+email de terceiro, exige CPF (válido) e telefone BR (DDD+número); caso contrário usa dados do utilizador.
4. **`resolver_lote_compra(db, evento)`** (`app/services/ingresso_lotes.py`): percorre lotes por `ordem`, aplica `ativo`, datas `vendas_inicio`/`vendas_fim`, e capacidade (`quantidade_maxima` vs contagens `pendente`+`pago`).
5. **`valor_centavos`** do pedido tem de coincidir com o preço do lote — evita manipulação de preço no cliente.
6. Criação de **`Ingresso`** com `lote_id`, `valor`, `status=pendente`, `reservado_ate` (35 min).
7. Resposta com `aguardando_cobranca: true` — o front chama **`POST /api/pagamentos/asaas/cobranca`** (PIX, cartão ou fatura).

**Pré-requisitos:** `evento.asaas_wallet_id` (organizador) e `ASAAS_PLATFORM_WALLET_ID` (plataforma).

**Dev local:** `ASAAS_DISABLED=true` ou `POST /api/webhooks/mock-payment?ingresso_id=...` (apenas `DEBUG` + `development`).

## Fluxo no browser após `criar`

1. Front recebe `ingresso_id` e exibe `CheckoutAsaasPainel`.
2. Comprador escolhe PIX, cartão ou fatura; confirmação via webhook Asaas ou polling PIX (`GET /asaas/status/{ingresso_id}`).
3. Sucesso → passo 3 do checkout (confirmação + e-mail do ingresso).

## Webhook `POST /api/webhooks/asaas`

- Header **`asaas-access-token`** = `ASAAS_WEBHOOK_TOKEN` no `.env` (fail-closed em produção).
- **Idempotência**: se `event["id"]` já existe em **`webhook_events`**, retorna sucesso idempotente.
- **`PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`**: marca ingressos pendentes como `pago`.
- **`PAYMENT_REFUNDED`**: cancela ingressos pagos/pendentes ligados à cobrança.
- **`PAYMENT_DELETED` / `PAYMENT_OVERDUE`**: cancela reservas pendentes.

Configuração: painel Asaas → Integrações → Webhooks → `https://SEU_DOMINIO/api/webhooks/asaas`. Ver [11-go-live-asaas.md](./11-go-live-asaas.md).

## Cancelamento e reembolso `POST /api/pagamentos/cancelar`

- Só dono do ingresso; só **`status=pago`**; dentro de **`data_limite_cancelamento`**.
- Reembolso via API Asaas (`cancelar_com_reembolso_asaas`), salvo modo `ASAAS_DISABLED`.
- Atualiza **`Cancelamento`** (`asaas_refund_id`) e `ingresso.status=cancelado`.

## Lotes — regras de negócio (síntese)

| Conceito | Implementação |
|----------|-----------------|
| Ordem de venda | `EventoIngressoLote.ordem` ascendente |
| Esgotamento | Contagem de ingressos `pendente` + `pago` com `lote_id` ≥ `quantidade_maxima` |
| Janela temporal | `vendas_inicio` ≤ agora ≤ `vendas_fim` (extremos opcionais `NULL` = sem limite desse lado) |
| Preço na vitrine | `evento.preco_ingresso` sincronizado como **mínimo** entre lotes **ativos** |
| Preço na compra | `preco_compra` na API = preço do **lote resolvido**; front deve usar este valor no `valor_centavos` |

## Edição de lotes (`substituir_lotes_evento`)

- Remoção de lote só se **não** houver ingressos `pendente`/`pago` associados.
- Lotes novos no PATCH **sem** `id` são inseridos; com `id` válido do evento são atualizados.

## Segurança e compliance

- Dados de cartão enviados **diretamente ao Asaas** (PCI no processador).
- Split de repasse: organizador (`asaas_wallet_id`) + plataforma (`ASAAS_PLATFORM_WALLET_ID`).
