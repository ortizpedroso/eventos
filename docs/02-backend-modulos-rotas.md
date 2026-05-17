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

## `app/routes/auth.py` — prefixo `/api/auth`

| Rota | Método | Autenticação | Descrição |
|------|--------|--------------|-------------|
| `/registrar` | POST | — | Cria `Usuario`; opcionalmente Stripe `Customer` e, se organizador, `Account` Express (salvo `STRIPE_DISABLED` / skip / erro de termos Connect) |
| `/login` | POST | — | Valida email/senha; devolve JWT |
| `/me` | GET | Bearer | Lê utilizador fresco da BD; headers `Cache-Control: no-store` |
| `/me` | PATCH | Bearer | Atualiza perfil; email/senha exigem `senha_atual`; sincroniza Stripe Customer/Account se aplicável |

**Dependências reutilizáveis:**

- `get_usuario_atual`: obriga token válido + utilizador existente.
- `get_usuario_atual_opcional`: token ausente ou inválido → `None` (rotas públicas com “extra” se logado).

**Helpers internos:** `_stripe_error_all_text`, `_stripe_connect_platform_terms_missing` — diagnosticar erros Stripe Connect (termos da plataforma).

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
- Criação: se `ingresso_lotes` omitido, serviço **`criar_lotes_iniciais`** cria um lote “Geral” com o `preco_ingresso` enviado.

## `app/routes/pagamentos.py` — prefixo `/api/pagamentos`

| Rota | Descrição |
|------|-----------|
| `POST /criar` | Valida evento publicado, participante (CPF/telefone se terceiro), resolve **lote atual** (`resolver_lote_compra`), exige `valor_centavos` igual ao preço do lote; cria `Ingresso` + Stripe `PaymentIntent` (ou modo `STRIPE_DISABLED`) |
| `GET /meus` | Lista ingressos do utilizador; filtro opcional `?status=` |
| `POST /cancelar` | Cancela ingresso **pago** dentro do prazo; `Refund` Stripe ou skip se `STRIPE_DISABLED` / PI fake |

## `app/routes/ingressos.py` — prefixo `/api/ingressos`

| Rota | Descrição |
|------|-----------|
| `GET /meus` | Lista simplificada de ingressos do utilizador (estrutura JSON própria; pode diferir ligeiramente de `/pagamentos/meus`) |

## `app/routes/relatorios.py` — prefixo `/api/relatorios`

| Rota | Descrição |
|------|-----------|
| `GET /organizador` | Agregações: totais por status, receita, por evento, série diária; query params `dias`, `evento_id`; apenas `tipo=organizador` |
| `GET /organizador/participantes` | Lista/exporta participantes dos eventos do organizador; `formato=json\|csv`, `evento_id`, `limite`; CSV com BOM UTF-8 e `;` como separador |

(Detalhes de colunas CSV no código em `relatorios.py`.)

## `app/routes/webhooks.py` — prefixo `/api/webhooks`

| Rota | Descrição |
|------|-----------|
| `POST /stripe` | Valida payload (`construct_event` ou JSON em dev sem secret); idempotência com tabela **`stripe_events`**; trata `payment_intent.succeeded` / `payment_intent.payment_failed` |
| `POST /mock-payment` | **Só** `DEBUG` + `development`: marca ingresso como pago (ferramenta local) |

## `app/schemas/`

- **`evento.py`**: `CriarEventoRequest`, `AtualizarEventoRequest`, `IngressoLoteWrite/Response`, `EventoResponse`, **`montar_evento_response`**, `EventoPublicoResponse` (se usado).
- **`usuario.py`**: registo, login, resposta de token, atualização de perfil.

## `app/services/`

| Módulo | Função |
|--------|--------|
| **`auth.py`** | `hash_password`, `verify_password`, `create_access_token`, `decode_token` |
| **`ingresso_lotes.py`** | Regras de lotes: elegibilidade, contagem de ocupação, resolução do lote à venda, substituição de lotes, sincronização de `preco_ingresso` no evento |

## `app/models/`

Ver [03-modelos-de-dados.md](./03-modelos-de-dados.md). Import central em **`app/models/__init__.py`** para Alembic/Base.

## `app/utils/`

Utilitários transversos (ex.: **`cpf.py`**) usados nas rotas de pagamento/participante.

## Testes automatizados

`tests/test_api.py` — `TestClient` contra app com BD **SQLite em memória** e `dependency_overrides` em `get_db`; Stripe mockado com `unittest.mock.patch`.
