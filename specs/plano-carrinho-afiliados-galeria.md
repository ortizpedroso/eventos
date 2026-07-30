# Plano: carrinho abandonado + promoters + galeria (prova social viva)

**Data:** 2026-07-30  
**Status:** ✅ Aprovado e implementado (A→B→C) — timer 20 min, opt-out A1 transacional  
**Spec principal:** `specs/eventosbr-producao.md` (atualizar changelog na entrega)  
**Origem:** pedido `/build` — plano de implementação priorizado  

---

## 0. Princípios (não negociáveis)

- **Sem dados inventados:** sem depoimento fake, sem “X vendas” fabricado, sem foto genérica no lugar de galeria.
- **E-mail só pela fila confiável:** `enqueue_email_simples` (`app/services/notificacao_email.py`) — sem SMTP síncrono novo.
- **Não alterar checkout/pagamento/split:** só rastreio, lembrete e UI auxiliar.
- **Testes automatizados** por peça (pytest + onde fizer sentido frontend).
- **Migração Alembic** padronizada (`YYYYMMDD_NNNNNN_snake.py`) — nunca pular.
- **URL pública do evento:** `/eventos/{slug}` (não existe `/e/` hoje; afiliado usa `?ref=` nessa URL).

---

## 1. Visão e ordem de entrega

| Fase | Entrega | Por quê nessa ordem | Esforço relativo |
|------|---------|---------------------|------------------|
| **A** | Recuperação de carrinho abandonado | Infra pronta; maior ROI imediato | Médio |
| **B** | Promoters / links `?ref=` | Atribuição + painel simples; sem comissão | Médio |
| **C** | Galeria de edições anteriores (3–6 fotos) | Prova social só com fotos reais do organizador | Médio-baixo |

Cada fase abre PR/merge em `main` com testes verdes + atualização da spec, antes da próxima.

---

## 2. Fase A — Carrinho abandonado

### 2.1 Realidade do código (ajuste ao pedido “30–60 min”)

Hoje o checkout cria `Ingresso` com `status="pendente"` e **`reservado_ate = agora + 35 min`**. O worker `reserva_cleanup` cancela o pendente depois disso. **Não há modelo `Pedido`.**

| Pedido original | Restrição | Decisão do plano |
|-----------------|-----------|------------------|
| Lembrete em 30–60 min | Reserva só 35 min; aos 60 o link `?retomar=` já não serve | **Enviar 20 min após `data_compra`**, ainda com `status=pendente` e `reservado_ate > agora` |
| Extender reserva | Mexeria no checkout | **Fora de escopo** nesta fase |

Deep-link já existe:  
`{FRONTEND}/eventos/{slug}?retomar={ingressoId}#comprar`  
(`frontend/src/lib/reserva-pagamento.ts` → `urlRetomarPagamento`).

### 2.2 Critérios de envio (um único e-mail)

Candidato = ingresso (ou lote compartilhando o mesmo `asaas_payment_id` / mesmo `reservado_ate` + usuário + evento) tal que:

1. `status == "pendente"`
2. `data_compra <= agora - 20 min` (constante `CARRINHO_LEMBRETE_APOS_MINUTOS = 20`)
3. `reservado_ate` ainda no futuro (reserva recuperável)
4. Destino: `participante_email` ou e-mail do `Usuario`
5. One-shot / idempotência: `carrinho_lembrete_enviado_em` é **claim atômico** (`UPDATE … WHERE IS NULL`) *antes* do enqueue e commitado — um segundo cron na janela da reserva **não reenvia**. Se o enqueue falhar, o claim é liberado para retry.
6. Não enviar se já `pago` / `cancelado` / `usado` (reconsulta no momento do envio)
7. Um e-mail por **grupo de reserva** (qty > 1 gera várias linhas — dedupe pelo primeiro ingresso do lote)

### 2.3 Opt-out — decisão a aprovar

`Usuario.aceita_comunicacao_email` é **opt-in de marketing** (default `false`). Campanhas admin só enviam se `True`.

| Opção | Comportamento | Alcance |
|-------|---------------|---------|
| **A1 (recomendada)** | Tratar como **transacional de compra** (igual lista de espera / retomada): envia sempre; rodapé com link `/conta/perfil` para preferências | Alto |
| **A2 (literal ao pedido)** | Só envia se `aceita_comunicacao_email is True` | Baixo — a maioria dos abandonos não recebe |

**Pedido de aprovação:** A1 ou A2. O plano assume **A1** até você dizer o contrário.

### 2.4 Implementação (backend)

| Peça | Detalhe |
|------|---------|
| Migração | `alembic`: coluna `ingressos.carrinho_lembrete_enviado_em` (`DateTime`, nullable) + índice parcial opcional `(status, carrinho_lembrete_enviado_em)` se útil |
| Serviço | `app/services/lembrete_carrinho.py` — espelha o *padrão* de `lembrete_evento.py` (worker em thread), mas **envia via** `enqueue_email_simples` |
| HTML | `build_email_html` / branding existente; tom gentil; 1 CTA “Continuar compra”; sem urgência agressiva; sem repetir blast |
| Worker | Intervalo ~60–90s; registrar em `app/main.py` lifespan (junto aos outros), skip em `ENVIRONMENT=test` |
| Conteúdo mínimo | Nome do evento, CTA com `retomar`, prazo implícito (“sua reserva ainda está ativa”) |

### 2.5 O que **não** fazer

- Não criar SMTP síncrono.
- Não reutilizar `lembrete_enviado_em` (é do lembrete do *dia do evento*, só pagos).
- Não alterar `_RESERVA_MINUTOS`, Asaas, split ou webhook.
- Não enviar WhatsApp nesta fase.

### 2.6 Testes (A)

- Unidade: query de candidatos (inclui / exclui por tempo, status, one-shot, lote dedupe).
- Integração: mock `enqueue_email_simples`; ingresso vira `pago` antes do worker → não envia; `cancelado` → não envia.
- Regressão: `reserva_cleanup` e fluxo `retomar` intactos.

---

## 3. Fase B — Promoters / links `?ref=`

### 3.1 Escopo desta fase (sem comissão)

- Organizador cria **códigos de divulgação** por evento.
- Link: `https://eventosbr.app.br/eventos/{slug}?ref={CODIGO}` (código curto, case-insensitive).
- Compra com `?ref=` grava atribuição no ingresso.
- Painel: contagem de vendas (`pago`/`usado`) por código — **sem % de comissão, sem saque de afiliado**.

### 3.2 Modelo de dados

Nova tabela `evento_promoters` (nome sugerido):

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID/str | PK |
| `evento_id` | FK → eventos | |
| `organizador_id` | FK → usuarios | dono; valida ownership |
| `codigo` | str(16–32) | único **por evento**; gerado ou custom sanitizado `[a-zA-Z0-9_-]` |
| `rotulo` | str opcional | ex. “Influencer Ana” |
| `ativo` | bool | default true |
| `criado_em` | datetime | |

Em `ingressos`:

| Coluna | Tipo | Notas |
|--------|------|-------|
| `promoter_id` | FK nullable → `evento_promoters` | preenchido na criação do ingresso se `ref` válido e ativo |
| (opcional) `promoter_codigo` | str nullable | snapshot do código no momento da venda (auditoria se código for renomeado/apagado) |

**Privacidade:** painel do organizador mostra só agregados (código, rótulo, qtd vendas, receita bruta opcional). **Nunca** nome/e-mail/CPF do comprador pro “divulgador”. Divulgador nesta fase **não tem login próprio** — só o organizador vê o painel.

### 3.3 Fluxo técnico

1. **API organizador** (auth + dono do evento):
   - `POST /api/eventos/id/{id}/promoters` — cria código
   - `GET /api/eventos/id/{id}/promoters` — lista + métricas
   - `PATCH .../promoters/{pid}` — rotulo/ativo
2. **Página pública:** lê `searchParams.ref`; guarda em `sessionStorage` (ex. `eventosbr:ref:{eventoId}`) por ~24h ou até compra.
3. **`POST /api/pagamentos/criar`:** aceita campo opcional `ref` (ou lê header); resolve `EventoPromoter` ativo do evento; grava `promoter_id` nos ingressos criados. **Não muda valor, split nem taxa.**
4. **Compartilhar:** estender `evento-compartilhar.tsx` com prop opcional `shareUrl` / `refCodigo`. No painel do organizador, botão “Copiar link” / WhatsApp reutiliza o mesmo componente com URL já com `?ref=`.
5. **Página do evento (visitante):** compartilhamento público continua sem `ref` (não “roubar” atribuição do promoter). Só o link gerado no painel leva `?ref=`.

### 3.4 UI organizador

- Aba ou seção em editar evento / financeiro leve: “Divulgadores”.
- Lista: código, link completo, vendas, ativo/inativo, copiar/compartilhar.
- Sem tela de cadastro externo de afiliado nesta fase.

### 3.5 Testes (B)

- Criar código; compra com `ref` válido → `promoter_id` setado.
- `ref` inválido/inativo/de outro evento → ingresso sem promoter (compra normal).
- Métricas: só conta `pago`/`usado`; pendente/cancelado não infla painel.
- Isolamento: organizador A não vê promoters do evento de B.
- Regressão: pagamento sem `ref` inalterado.

---

## 4. Fase C — Galeria (prova social viva)

### 4.1 Escopo

- Campo opcional no criar/editar evento: **3 a 6 fotos** de edições anteriores.
- Exibir na página pública **junto ao “Sobre”**, só se houver ≥1 foto real enviada.
- **Nunca** placeholder / stock / fake.

### 4.2 Modelo

Nova tabela `evento_galeria_fotos` (ou JSON tipado — preferir tabela para ordenação e delete):

| Coluna | Tipo |
|--------|------|
| `id` | PK |
| `evento_id` | FK |
| `url` | Text (mesma validação de `imagem_url`) |
| `ordem` | int 0..5 |
| `criado_em` | datetime |

Regra: max 6 por evento (enforce API).

### 4.3 Upload

Reaproveitar pipeline do banner:

1. Frontend: `comprimir-imagem.ts` + componente baseado em `EventoImagemField` / `ImagemAssetField` (multi-slot).
2. Backend: `POST /api/organizador/eventos/upload-imagem` (ou variante `upload-galeria` com subdir `eventos/{user}/galeria`) → Pillow + R2/local.
3. Persistência: create/patch evento aceitam lista `galeria_urls: string[]` (ou endpoints CRUD de fotos).

### 4.4 UI pública

- Em `evento-public-client.tsx`, após bloco “Sobre o evento”: seção “Edições anteriores” / “Galeria” só se `galeria.length > 0`.
- Grid simples responsivo; lightbox leve opcional (sem lib pesada se der com `<dialog>`).
- Sem texto inventado tipo “milhares de pessoas amaram”.

### 4.5 Testes (C)

- Limite 6; rejeita 7ª.
- Página pública omite seção com lista vazia.
- Upload usa compressor (teste de contrato API + validação URL).
- Organizador só edita fotos do próprio evento.

---

## 5. Arquivos principais (mapa)

| Área | Criar / tocar |
|------|----------------|
| A — lembrete | `lembrete_carrinho.py`, `main.py` lifespan, migration ingresso, testes |
| A — e-mail | HTML via `email_branding.py` + `enqueue_email_simples` |
| B — modelo/API | `models/evento_promoter.py`, routes eventos/pagamentos, migration |
| B — FE | painel promoters, `evento-compartilhar.tsx` (`shareUrl`), `eventos/[slug]/page` ref capture, `pagamentos` body `ref` |
| C — modelo/API | `evento_galeria_fotos` + schemas evento, assets upload |
| C — FE | editar/novo evento slots; `evento-public-client.tsx` seção galeria |
| Spec | `eventosbr-producao.md` changelog + checklist; marcar itens neste plano ✅ |

---

## 6. Fora de escopo (fases futuras)

- Comissão automática / split pro promoter / saque de afiliado.
- Portal do divulgador (login próprio).
- Extender `reservado_ate` ou mudar fluxo Asaas.
- Depoimentos em texto/vídeo fabricados ou curados sem origem clara.
- SMS/WhatsApp de recuperação.
- URL curta `/e/{slug}` (pode ser alias depois; não bloqueia `?ref=`).

---

## 7. Critérios de aceite por fase

### A — Carrinho
- [ ] Um único e-mail por reserva abandonada elegível
- [ ] Zero e-mail se pago/cancelado entre agendamento e envio
- [ ] Fila Redis/confiável (não SMTP direto no worker de lembrete)
- [ ] Envio ainda dentro da janela de reserva (~20–25 min)
- [ ] Testes verdes

### B — Promoters
- [ ] Link com `?ref=` atribui venda
- [ ] Painel só com agregados; sem PII do comprador
- [ ] Compartilhar reutiliza `evento-compartilhar.tsx`
- [ ] Sem cálculo de comissão
- [ ] Testes de atribuição e isolamento

### C — Galeria
- [ ] 0 fotos → seção ausente
- [ ] 1–6 fotos reais via pipeline existente
- [ ] Sem imagem genérica
- [ ] Testes de limite e visibilidade

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Lembrete depois da expiração da reserva | Timer 20–25 min + checagem `reservado_ate` |
| Opt-in marketing zera alcance | Decisão A1/A2 explícita (§2.3) |
| Duplo envio em multi-worker | One-shot com update condicional (`carrinho_lembrete_enviado_em IS NULL`) ou lock |
| Fraude de `ref` (auto-atribuição) | Aceitável na fase sem comissão; documentar; fase futura pode bloquear promoter = comprador |
| Galeria pesada | Mesmo cap de resolução do banner; max 6 |

---

## 9. Estimativa técnica (sem calendário)

- **A:** migration + worker + e-mail + ~6–10 testes  
- **B:** 2 migrations/tabelas + API + captura FE + painel + compartilhar + testes de atribuição  
- **C:** tabela + upload multi + UI editar/público + testes  

Dependências externas: nenhuma nova (Redis/fila e R2/local já existem).

---

## 10. Aprovações pedidas antes do `/build`

1. **Timer do lembrete:** 20–25 min (por causa dos 35 min de reserva) — OK?  
2. **Opt-out:** A1 (transacional) vs A2 (só quem aceitou marketing)?  
3. **URL afiliado:** `/eventos/{slug}?ref=CODIGO` (sem criar `/e/` agora) — OK?  
4. **Ordem A → B → C** — OK, ou quer galeria antes de promoters?  
5. **Comissão:** confirmado que fica fora desta implementação?

---

**Próximo passo após o seu OK:** implementar Fase A na branch `cursor/carrinho-abandonado-9182`, testes, merge `main`, atualizar spec; depois B e C na mesma lógica.
