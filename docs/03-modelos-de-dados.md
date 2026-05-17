# 03 — Modelos de dados

ORM: **SQLAlchemy** sobre `config.database.Base`. Identificadores principais: **UUID em string** (`String` PK).

## Diagrama entidade-relacionamento (simplificado)

```mermaid
erDiagram
  USUARIO ||--o{ EVENTO : organiza
  EVENTO ||--o{ INGRESSO : tem
  EVENTO ||--o{ EVENTO_INGRESSO_LOTE : define
  EVENTO_INGRESSO_LOTE ||--o{ INGRESSO : classifica
  INGRESSO ||--o| CANCELAMENTO : pode_ter
  USUARIO ||--o{ INGRESSO : compra

  USUARIO {
    string id PK
    string email UK
    string nome
    string senha_hash
    string tipo
    string stripe_customer_id
    string stripe_account_id
  }

  EVENTO {
    string id PK
    string slug UK
    string organizador_id FK
    string nome
    text descricao
    datetime data_inicio
    datetime data_fim
    string local
    text imagem_url
    float preco_ingresso
    string categoria
    text mensagem_confirmacao
    string stripe_account_id
    bool publicado
  }

  EVENTO_INGRESSO_LOTE {
    string id PK
    string evento_id FK
    string nome
    float preco
    int ordem
    int quantidade_maxima "null=ilimitado"
    bool ativo
    datetime vendas_inicio
    datetime vendas_fim
  }

  INGRESSO {
    string id PK
    string evento_id FK
    string usuario_id FK
    string lote_id FK
    string participante_nome
    string participante_email
    string participante_cpf
    string participante_telefone
    string stripe_payment_intent_id UK
    float valor
    string status
    datetime data_compra
    datetime data_limite_cancelamento
  }

  CANCELAMENTO {
    string id PK
    string ingresso_id FK UK
    float valor_reembolso
    string status
    string stripe_refund_id
  }

  STRIPE_EVENT {
    string id PK
    string tipo
    datetime data_recebimento
  }
```

## Tabela `usuarios`

- **`tipo`**: valores usados na API incluem `organizador` e `cliente` (normalização no registo).
- **`stripe_customer_id`**: necessário para `PaymentIntent` com `customer` (fluxo atual).
- **`stripe_account_id`**: conta **Connect Express** do organizador; copiada para o **evento** na criação para `transfer_data.destination` no pagamento.

## Tabela `eventos`

- **`slug`**: URL pública única; **não muda** no PATCH de atualização.
- **`publicado`**: `false` = pausado — oculto na listagem pública e compra bloqueada; dono autenticado ainda pode ver pelo slug.
- **`data_fim`**: obrigatória na BD; a API pode preencher com `data_inicio` se omitida no pedido.
- **`preco_ingresso`**: mantido como **menor preço entre lotes ativos** após operações de lotes (também serve vitrine/listagens “a partir de”).

## Tabela `evento_ingresso_lotes`

- **`ordem`**: prioridade de venda (menor primeiro).
- **`quantidade_maxima`**: `NULL` = ilimitado; ocupação = ingressos `pendente` + `pago` com esse `lote_id`.
- **`vendas_inicio` / `vendas_fim`**: janela opcional (comparação com “agora” na API, naive UTC alinhado ao resto do código).
- **`ativo`**: lote fora da fila se `false`.

## Tabela `ingressos`

- **`usuario_id`**: quem paga (responsável financeiro).
- **`participante_*`**: quem vai ao evento (pode ser o mesmo que o pagador).
- **`status`**: `pendente`, `pago`, `cancelado`, `usado` (valores usados nos relatórios e filtros).
- **`stripe_payment_intent_id`**: único; em modo disabled pode prefixar `disabled_`.
- **`lote_id`**: FK opcional historicamente; com lotes implementados, preenchido na criação do pagamento.

## Tabela `cancelamentos`

- Relação **1:1** com ingresso (`ingresso_id` único).
- Guarda estado do reembolso e `stripe_refund_id` quando aplicável.

## Tabela `stripe_events`

- **`id`**: ID do evento Stripe (`evt_...`) — garante **idempotência** do webhook (reprocessamento seguro).

## Migrações Alembic

Ficheiros em `alembic/versions/` com revisões encadeadas (`down_revision`). A migração **`20260514_000006`** cria `evento_ingresso_lotes`, adiciona `ingressos.lote_id` e **backfill** de um lote “Geral” por evento existente.

**Ordem típica de evolução:** init → preço ingresso → participantes → imagem URL texto → CPF/telefone → lotes.
