# 03 — Modelos de dados

ORM: **SQLAlchemy** sobre `config.database.Base`. Identificadores principais: **UUID em string** (`String` PK).

## Diagrama entidade-relacionamento (simplificado)

```mermaid
erDiagram
  USUARIO ||--o{ EVENTO : organiza
  EVENTO ||--o{ INGRESSO : tem
  EVENTO ||--o{ EVENTO_INGRESSO_LOTE : define
  EVENTO ||--o{ EVENTO_CUPOM : tem
  EVENTO_INGRESSO_LOTE ||--o{ INGRESSO : classifica
  EVENTO_CUPOM ||--o{ INGRESSO : aplica
  INGRESSO ||--o| CANCELAMENTO : pode_ter
  USUARIO ||--o{ INGRESSO : compra
  CAMPANHA_MARKETING ||--o{ CAMPANHA_ENVIO : gera

  USUARIO {
    string id PK
    string email UK
    string nome
    string senha_hash "nullable (OAuth)"
    string auth_provider "email|google|apple"
    string auth_provider_id
    string tipo "cliente|organizador"
    string asaas_wallet_id
    bool ativo
    int token_version
    bool aceita_comunicacao_email
    bool aceita_comunicacao_whatsapp
    string telefone
    datetime comunicacao_consentimento_em
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
    bool publicado
    int limite_ingressos_por_cpf "null=sem limite"
    string checkin_token UK "link portaria"
  }

  EVENTO_INGRESSO_LOTE {
    string id PK
    string evento_id FK
    string nome
    string tipo "inteira|meia|vip|cortesia"
    float preco
    int ordem
    int quantidade_maxima "null=ilimitado"
    bool ativo
    datetime vendas_inicio
    datetime vendas_fim
  }

  EVENTO_CUPOM {
    string id PK
    string evento_id FK
    string codigo UK
    float desconto_percentual
    int limite_usos
    bool ativo
  }

  INGRESSO {
    string id PK
    string evento_id FK
    string usuario_id FK
    string lote_id FK
    string cupom_id FK
    string participante_nome
    string participante_email
    string participante_cpf
    string participante_telefone
    string cortesia_responsavel
    string asaas_payment_id UK
    float valor
    string status "pendente|pago|cancelado|usado"
    datetime data_compra
    datetime data_limite_cancelamento
    datetime checkin_em
    string checkin_por_id FK
    string repassado_para_nome
    string repassado_para_cpf
    string repassado_para_email
    string repassado_para_telefone
    string repassado_para_data_nascimento
    datetime repassado_em
  }

  CANCELAMENTO {
    string id PK
    string ingresso_id FK UK
    float valor_reembolso
    string status "pendente|processado|falhou"
    datetime data_solicitacao
    datetime data_processamento
  }

  WEBHOOK_EVENT {
    string id PK
    string tipo
    datetime data_recebimento
  }

  CAMPANHA_MARKETING {
    string id PK
    string nome
    string assunto
    text mensagem_html
    string status
    datetime criado_em
    datetime disparado_em
  }

  CAMPANHA_ENVIO {
    string id PK
    string campanha_id FK
    string usuario_id
    string email
    string status
    datetime enviado_em
  }
```

---

## Tabela `usuarios`

- **`tipo`**: `cliente` ou `organizador` (normalizado no registo).
- **`auth_provider`**: `email` (senha), `google` ou `apple`. Se OAuth, `senha_hash` pode ser `NULL`.
- **`token_version`**: incrementado ao desativar conta ou alterar senha — invalida todos os JWTs anteriores.
- **`asaas_wallet_id`**: carteira Asaas do organizador para split de pagamentos.
- **`aceita_comunicacao_*`** + **`comunicacao_consentimento_em`**: opt-in LGPD para campanhas de marketing da plataforma.

---

## Tabela `eventos`

- **`slug`**: URL pública única; **não muda** no PATCH de atualização.
- **`publicado`**: `false` = pausado — oculto na listagem pública e compra bloqueada; dono autenticado ainda pode ver pelo slug.
- **`data_fim`**: obrigatória na BD; a API pode preencher com `data_inicio` se omitida no pedido.
- **`preco_ingresso`**: mantido como **menor preço entre lotes ativos** após operações de lotes (também serve como vitrine "a partir de").
- **`limite_ingressos_por_cpf`**: `NULL` = sem limite; verificado no serviço `cpf_limite.py` antes de criar a cobrança.
- **`checkin_token`**: string aleatória de 64 chars (índice único); usada no link `/portaria/{id}?k=...` para colaboradores sem conta.

---

## Tabela `evento_ingresso_lotes`

- **`tipo`**: `inteira`, `meia`, `vip`, `cortesia` (normalizado via `ingresso_tipos.py`).
- **`ordem`**: prioridade de venda (menor primeiro).
- **`quantidade_maxima`**: `NULL` = ilimitado; ocupação = ingressos `pendente` + `pago` com esse `lote_id`.
- **`vendas_inicio` / `vendas_fim`**: janela opcional (comparação com "agora" naive UTC).
- **`ativo`**: lote fora da fila se `false`.

---

## Tabela `evento_cupons`

- **`codigo`**: único por plataforma (índice único); case-insensitive na validação.
- **`desconto_percentual`**: 0–100; aplica-se sobre o preço do lote.
- **`limite_usos`**: `NULL` = ilimitado.
- Validação e aplicação via `cupom_desconto.py`.

---

## Tabela `ingressos`

- **`usuario_id`**: quem paga (responsável financeiro — não muda no repasse).
- **`participante_*`**: quem vai ao evento; pode diferir do pagador e é **atualizado no repasse**.
- **`cortesia_responsavel`**: nome/identificação de quem emitiu a cortesia.
- **`status`**: `pendente` → `pago` (webhook Asaas) → `usado` (check-in) | `cancelado`.
- **`lote_id`**: FK para o lote; preenchido na criação da cobrança.
- **`cupom_id`**: FK para o cupom aplicado (pode ser `NULL`).
- **`asaas_payment_id`**: ID da cobrança Asaas; único por ingresso pago.
- **`checkin_em` / `checkin_por_id`**: data e operador do check-in na portaria.
- **Campos de repasse** (`repassado_para_*` + `repassado_em`): gravados ao chamar `POST /api/ingressos/{id}/repassar`; `usuario_id` **não é alterado** (o comprador original permanece dono financeiro).

---

## Tabela `cancelamentos`

- Relação **1:1** com ingresso (`ingresso_id` único).
- Guarda estado do reembolso via API Asaas quando aplicável.
- **`status`**: `pendente`, `processado`, `falhou`.

---

## Tabela `webhook_events`

- **`id`**: ID do evento Asaas — garante **idempotência** do webhook (reprocessamento seguro).

---

## Tabelas de marketing

### `campanha_marketing`

Campanhas criadas pelo admin da plataforma. `status`: `rascunho`, `disparada`, `concluida`.

### `campanha_envio`

Um registro por destinatário por campanha; rastreia `status` de cada envio.

---

## Migrações Alembic

Ficheiros em `alembic/versions/` com revisões encadeadas (`down_revision`).

| Revisão | Descrição |
|---------|-----------|
| `20260511_000001` | Init — tabelas base (`usuarios`, `eventos`, `ingressos`, `cancelamentos`, `webhook_events` legado) |
| `20260511_000002` | `eventos.preco_ingresso` |
| `20260512_000003` | `ingressos.participante_*` (nome, email) |
| `20260512_000004` | `eventos.imagem_url` como `Text` |
| `20260513_000005` | `ingressos.participante_cpf`, `participante_telefone` |
| `20260514_000006` | Tabela `evento_ingresso_lotes`; `ingressos.lote_id`; backfill lote "Geral" por evento |
| `20260516_000007` | `eventos.limite_ingressos_por_cpf`; `lotes.tipo`; `ingressos.checkin_em/checkin_por_id` |
| `20260517_000008` | Cupons, comunicados, cortesia (`evento_cupons`, `ingressos.cupom_id/cortesia_responsavel`) |
| `20260518_000009` | `usuarios.aceita_comunicacao_*`, `telefone`, `comunicacao_consentimento_em` |
| `20260519_000010` | Campanhas de marketing (`campanha_marketing`, `campanha_envio`) |
| `20260520_000011` | OAuth: `usuarios.auth_provider`, `auth_provider_id`, `token_version` |
| `20260522_000012` | `eventos.checkin_token` (link portaria sem conta) |
| `20260522_000013` | `ingressos.repassado_para_*` + `repassado_em` (repasse de ingresso) |
| `20260618_000022` | Renomeia `stripe_events` → `webhook_events` |
| `20260618_000023` | Remove colunas Stripe legadas; migra refs para `asaas_payment_id` |
