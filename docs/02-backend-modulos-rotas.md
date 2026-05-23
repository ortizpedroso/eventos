# 02 — Backend: módulos e rotas

Raiz Python da API: pacote `app/` e `config/`. Ponto de entrada: **`app/main.py`**.

## `app/main.py`

| Bloco | Função |
|-------|--------|
| `load_dotenv()` | Carrega `.env` da raiz antes de importar settings |
| `lifespan` | Avisos Stripe placeholder; `create_tables()` só se `ENVIRONMENT=development` |
| `CORSMiddleware` | Origens de `CORS_ORIGINS` (lista ou `*`) |
| `include_router` | Monta todos os routers sob `/api/...` |
| `GET /health` | Liveness: processo responde (sem consultar a BD) |
| `GET /ready` | Readiness: `SELECT 1` na BD; **200** se `database: up`, **503** se indisponível |
| `GET /` | Mensagem de boas-vindas + link `/docs` |

## `config/settings.py` (`settings`)

Instância única **`settings`** (Pydantic `BaseSettings`): lê variáveis de ambiente e `.env`. Campos relevantes: `DATABASE_URL`, chaves Stripe, `STRIPE_DISABLED`, `STRIPE_SKIP_CONNECT_ON_REGISTER`, JWT (`SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`), `CORS_ORIGINS`, `ENVIRONMENT`, `DEBUG`.  
**Regra:** fora de `development`, `SECRET_KEY` obrigatório (senão `RuntimeError` ao importar).

## `config/database.py`

| Função / objeto | Descrição |
|-----------------|-----------|
| `Base` | Declarative base SQLAlchemy |
| `engine` | Motor SQLAlchemy; `check_same_thread=False` só para SQLite |
| `SessionLocal` | Factory de sessões |
| `get_db()` | Dependência FastAPI: `yield` sessão e `close()` no `finally` |
| `create_tables()` | `Base.metadata.create_all` — útil em dev; produção deve usar Alembic |

---

## `app/routes/auth.py` — prefixo `/api/auth`

| Rota | Método | Autenticação | Descrição |
|------|--------|--------------|-----------|
| `/registrar` | POST | — | Cria `Usuario`; opcionalmente Stripe `Customer` e, se organizador, `Account` Express |
| `/login` | POST | — | Valida email/senha; devolve JWT + cookie HttpOnly |
| `/logout` | POST | — | Encerra sessão (remove cookie HttpOnly) |
| `/me` | GET | Bearer/cookie | Lê utilizador fresco da BD; `Cache-Control: no-store` |
| `/me` | PATCH | Bearer/cookie | Atualiza nome, email ou senha; email/senha exigem `senha_atual` |
| `/oauth-config` | GET | — | Devolve client IDs Google para o frontend (login social) |
| `/google` | POST | — | Login / registo via Google ID token; devolve JWT |
| `/vincular-google` | POST | Bearer/cookie | Vincula conta Google a conta com senha existente |

**Dependências reutilizáveis:**

- `get_usuario_atual`: obriga token válido (cookie HttpOnly ou Bearer) + utilizador existente.
- `get_usuario_atual_opcional`: token ausente ou inválido → `None` (rotas públicas com "extra" se logado).

---

## `app/routes/eventos.py` — prefixo `/api/eventos`

| Rota | Método | Quem |
|------|--------|------|
| `/criar` | POST | Organizador autenticado |
| `/id/{evento_id}` | PATCH | Dono do evento |
| `/meus` | GET | Organizador |
| `/{slug}` | GET | Público (+ opcional JWT para ver evento pausado se for o dono) |
| `/` | GET | Lista só eventos `publicado=true` (paginação `skip`/`limit`) |

**Comportamento importante:**

- Slug único gerado com `python-slugify` e sufixo numérico em colisão (`_slug_unico`).
- Respostas montadas com **`montar_evento_response`** (`app/schemas/evento.py`): inclui `ingresso_lotes` (com `vendidos`), `lote_compra_id`, `preco_compra`.
- Queries usam `selectinload(Evento.ingresso_lotes)` onde necessário para evitar N+1.
- Criação: se `ingresso_lotes` omitido, serviço **`criar_lotes_iniciais`** cria um lote "Geral" com o `preco_ingresso` enviado.

---

## `app/routes/pagamentos.py` — prefixo `/api/pagamentos`

| Rota | Descrição |
|------|-----------|
| `POST /criar` | Valida evento publicado, participante (CPF/telefone se terceiro), resolve **lote atual** (`resolver_lote_compra`), exige `valor_centavos` igual ao preço do lote; cria `Ingresso` + Stripe `PaymentIntent` (ou modo `STRIPE_DISABLED`) |
| `GET /meus` | Lista ingressos do utilizador; filtro opcional `?status=` |
| `POST /cancelar` | Cancela ingresso **pago** dentro do prazo; `Refund` Stripe ou skip se `STRIPE_DISABLED` / PI fake |

---

## `app/routes/ingressos.py` — prefixo `/api/ingressos`

| Rota | Método | Descrição |
|------|--------|-----------|
| `/meus` | GET | Lista simplificada de ingressos do utilizador, inclui campos de repasse |
| `/{id}/download` | GET | HTML formatado para impressão/PDF; exibe banner âmbar se o ingresso foi repassado |
| `/{id}/qr` | GET | PNG do QR Code (apenas `pago` ou `usado`) |
| `/{id}/enviar-email` | POST | Reenvia ingresso por e-mail (campo `email` opcional; usa e-mail do participante por padrão) |
| `/{id}/repassar` | POST | Transfere titularidade do participante — atualiza `participante_*` e grava dados do novo participante em `repassado_para_*` |

**`POST /{id}/repassar` — payload:**

```json
{
  "nome": "string",
  "cpf": "string (11 dígitos)",
  "email": "string (EmailStr)",
  "telefone": "string",
  "data_nascimento": "YYYY-MM-DD"
}
```

- Exige ingresso pertencente ao utilizador autenticado e `status == "pago"`.
- Permite repassar múltiplas vezes (substitui o repasse anterior).

---

## `app/routes/checkin.py` — prefixo `/api/checkin`

| Rota | Método | Quem | Descrição |
|------|--------|------|-----------|
| `/validar` | POST | Organizador autenticado | Valida QR Code (`codigo`) na portaria; rate-limited; delega para `ingresso_checkin.realizar_checkin` |

Exige `usuario.tipo == "organizador"`. Erros de validação do QR são convertidos de `ValueError` para HTTP 400.

---

## `app/routes/portaria.py` — prefixo `/api/portaria`

Check-in via **link secreto** — colaboradores sem conta EventosBR.

| Rota | Método | Descrição |
|------|--------|-----------|
| `/evento` | GET | `?evento_id=&k=` — Valida token da portaria e devolve nome/local/data do evento |
| `/validar` | POST | `{ evento_id, token, codigo }` — Valida QR sem autenticação JWT; rate-limited |

O `token` é o `checkin_token` do evento (coluna `eventos.checkin_token`, gerado por `evento_portaria.py`).

---

## `app/routes/organizador.py` — prefixo `/api/organizador`

| Rota | Método | Quem | Descrição |
|------|--------|------|-----------|
| `/comunicados` | POST | Organizador autenticado | Enfileira e-mail em massa para participantes com `status in (pago, usado)` de um evento seu |

Payload: `{ evento_id, assunto, mensagem }`. Devolve `{ ok, destinatarios, enfileirados, mensagem }`.

---

## `app/routes/relatorios.py` — prefixo `/api/relatorios`

| Rota | Descrição |
|------|-----------|
| `GET /organizador` | Agregações: totais por status, receita, por evento, série diária; query params `dias`, `evento_id`; apenas `tipo=organizador` |
| `GET /organizador/participantes` | Lista/exporta participantes dos eventos do organizador; `formato=json\|csv`, `evento_id`, `limite`; CSV com BOM UTF-8 e `;` como separador |

---

## `app/routes/admin.py` — prefixo `/api/admin`

Todas as rotas exigem `require_platform_admin` (via `app/deps/platform_admin.py`).

| Rota | Método | Descrição |
|------|--------|-----------|
| `/setup` | GET | Checklist de produção (sem segredos); usado no painel admin |
| `/eventos` | GET | Lista todos os eventos da plataforma |
| `/eventos/{evento_id}/publicado` | PATCH | Ativa/desativa publicação de qualquer evento |
| `/usuarios` | GET | Lista todos os utilizadores |
| `/usuarios/{usuario_id}/ativo` | PATCH | Ativa/desativa qualquer utilizador |
| `/marketing/contatos` | GET | Contatos com opt-in de marketing; filtros `canal`, `tipo` |
| `/marketing/campanhas` | GET | Lista campanhas de marketing |
| `/marketing/campanhas` | POST | Cria campanha de marketing |
| `/marketing/campanhas/{id}` | GET | Detalhe de campanha |
| `/marketing/campanhas/{id}/disparar` | POST | Dispara campanha (enfileira envios) |

---

## `app/routes/webhooks.py` — prefixo `/api/webhooks`

| Rota | Descrição |
|------|-----------|
| `POST /stripe` | Valida payload (`construct_event` ou JSON em dev sem secret); idempotência com tabela **`stripe_events`**; trata `payment_intent.succeeded` / `payment_intent.payment_failed` |
| `POST /mock-payment` | **Só** `DEBUG` + `development`: marca ingresso como pago (ferramenta local) |

---

## `app/schemas/`

- **`evento.py`**: `CriarEventoRequest`, `AtualizarEventoRequest`, `IngressoLoteWrite/Response`, `EventoResponse`, **`montar_evento_response`**, `EventoPublicoResponse`.
- **`usuario.py`**: registo, login, resposta de token, atualização de perfil.
- **`campanha_marketing.py`**: `CampanhaCreate`, `CampanhaResponse`, `CampanhaDetalheResponse`.

---

## `app/services/`

| Módulo | Função |
|--------|--------|
| `auth.py` | `hash_password`, `verify_password`, `create_access_token`, `decode_token` |
| `ingresso_lotes.py` | Regras de lotes: elegibilidade, contagem de ocupação, resolução do lote à venda, substituição e sincronização de `preco_ingresso` |
| `ingresso_checkin.py` | Geração e validação do payload QR (`EBR1:{uuid}:{hmac}`); `realizar_checkin` (organizador JWT) e `realizar_checkin_portaria` (link secreto) |
| `ingresso_qr.py` | Gera PNG do QR Code de um ingresso (`gerar_qr_png_bytes`) |
| `ingresso_pago.py` | Ações pós-confirmação de pagamento (marcação `pago`, enfileiramento de e-mail) |
| `ticket_email.py` | Fila SMTP para ingresso individual (`enqueue_ticket_email`) e comunicado de evento (`enqueue_comunicado_evento`) |
| `oauth_verify.py` | Valida Google ID tokens (`google-auth` library) |
| `oauth_usuario.py` | Encontra ou cria `Usuario` a partir de payload OAuth Google |
| `oauth_vincular.py` | Vincula conta Google a conta com senha existente (exige senha atual) |
| `usuario_stripe.py` | Cria `stripe.Customer` e `stripe.Account` (Connect Express) no registo |
| `cpf_limite.py` | Aplica `limite_ingressos_por_cpf` por evento |
| `cupom_desconto.py` | Valida e aplica cupões de desconto por evento |
| `metricas_evento.py` | Métricas operacionais por evento (capacidade, conversão) |
| `evento_portaria.py` | Geração e validação do token secreto de portaria (`checkin_token`) |
| `export_presenca.py` | Exportação de lista de presença (PDF e Excel) |
| `tarifas_plataforma.py` | Cálculo de tarifas da plataforma por faixa de preço |
| `marketing_contatos.py` | Lista contatos com opt-in LGPD para campanhas |
| `marketing_email.py` | Envio de e-mails de marketing da plataforma |
| `marketing_campanha.py` | Criação e disparo de campanhas admin (`criar_campanha`, `disparar_campanha`) |
| `production_checks.py` | Checklist de produção (`build_setup_status`) |
| `redis_conn.py` | Cliente Redis compartilhado (rate limit, filas) |

---

## `app/utils/`

| Módulo | Função |
|--------|--------|
| `cpf.py` | Validação de CPF (11 dígitos) |
| `ingresso_tipos.py` | Tipos de ingresso por lote (`inteira`, `meia`, `vip`, `cortesia`) |
| `privacy.py` | Máscara de dados sensíveis nas respostas JSON (`mask_cpf`, `mask_telefone_br`) |
| `html_escape.py` | Escapa conteúdo dinâmico em templates HTML |
| `imagem_url.py` | Valida URLs de imagem de eventos (`http(s)://` ou `data:image/*` base64) |
| `auth_cookie.py` | Cookie HttpOnly para JWT (alternativa ao Bearer no browser) |
| `public_errors.py` | Mensagens de erro seguras para o cliente (sem vazar internals) |

---

## `app/deps/`

| Módulo | Função |
|--------|--------|
| `rate_limit.py` | Dependências de rate limit por IP (checkin, portaria info, portaria validar) |
| `platform_admin.py` | `require_platform_admin` — protege rotas do painel admin |

---

## `app/models/`

Ver [03-modelos-de-dados.md](./03-modelos-de-dados.md). Import central em **`app/models/__init__.py`** para Alembic/Base.

---

## Testes automatizados

`tests/` — `TestClient` contra app com BD **SQLite em memória** e `dependency_overrides` em `get_db`; Stripe mockado com `unittest.mock.patch`. Cobertura inclui fluxos de compra, cancelamento, check-in, OAuth e cupons.
