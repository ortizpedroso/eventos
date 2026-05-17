# 01 — Visão geral e arquitetura

## Propósito do produto

A **EventosBR** é uma plataforma para **organizadores** publicarem eventos (página pública por slug), definirem **preços** e **lotes de ingressos**, e para **participantes** comprarem ingresso com **pagamento online** (Stripe). Há fluxo de **cancelamento/reembolso** e **relatórios** para o organizador.

## Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| API | Python 3.11+, **FastAPI**, **Pydantic v2**, **SQLAlchemy** |
| Base de dados | **PostgreSQL** (produção/Docker) ou **SQLite** (dev simples) |
| Migrações | **Alembic** (`alembic/versions/`) |
| Cache / fila (infra) | **Redis** (declarado no Docker Compose; uso depende de evolução futura) |
| Pagamentos | **Stripe** (Customer, PaymentIntent, Refund; Connect Express para organizadores) |
| Autenticação API | **JWT** (Bearer), senhas com hash (bcrypt via serviço de auth) |
| Frontend | **Next.js** (App Router), **React**, **TypeScript**, **Tailwind CSS v4** |
| Pagamento no browser | **Stripe.js** + `@stripe/react-stripe-js` (Payment Element) |

## Diagrama de componentes (lógico)

```mermaid
flowchart LR
  subgraph browser [Browser]
    Next[Next.js app]
  end
  subgraph server [Servidor]
    API[FastAPI API :8000]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end
  subgraph external [Externo]
    ST[Stripe API]
    WH[Stripe Webhooks]
  end
  Next -->|HTTP /api/* rewrite ou NEXT_PUBLIC_API_URL| API
  API --> PG
  API -.-> RD
  API --> ST
  WH -->|POST /api/webhooks/stripe| API
```

## Dois modos de o frontend falar com a API

1. **Mesma origem (recomendado em dev com `npm run dev`)**  
   `NEXT_PUBLIC_API_URL` vazio no browser → `fetch` usa a origem do Next (`localhost:3000`). O **Next reescreve** `/api/*` para o backend (`next.config.ts` → `rewrites` para `API_PROXY_TARGET` / `INTERNAL_API_URL` / `127.0.0.1:8000`).

2. **URL absoluta da API**  
   `NEXT_PUBLIC_API_URL=http://localhost:8000` → o browser chama diretamente a API. Exige **CORS** correto (`CORS_ORIGINS` no backend). Em telemóvel na LAN, se a API for `localhost`, o `api.ts` pode forçar proxy (origem vazia) para evitar que “localhost” seja o telemóvel.

No **Docker**, o container `web` usa `INTERNAL_API_URL=http://api:8000` para **SSR** e builds server-side; o browser continua com `NEXT_PUBLIC_API_URL` apontando para onde o utilizador acede à API (ex.: `http://localhost:8000`).

## Ciclo de vida da aplicação FastAPI (`app/main.py`)

- **`lifespan`**: em `ENVIRONMENT=development`, chama `create_tables()` (SQLAlchemy) para facilitar setup; em **produção** espera-se **Alembic** (`alembic upgrade head`) antes do deploy (o Docker Compose da API já executa isso).
- **CORS**: origens vindas de `CORS_ORIGINS` (lista separada por vírgulas ou `*`).
- **Routers** montados em `/api/...` (ver documento 02).

## Fluxo resumido: compra de ingresso

```mermaid
sequenceDiagram
  participant U as Utilizador
  participant N as Next.js
  participant A as FastAPI
  participant S as Stripe
  U->>N: Continuar para o cartão
  N->>A: POST /api/pagamentos/criar (JWT, valor_centavos)
  A->>A: Resolver lote atual + validar valor
  A->>S: PaymentIntent.create
  A->>A: Ingresso pendente + lote_id
  A-->>N: client_secret
  N->>S: confirmPayment (Stripe.js)
  S-->>A: Webhook payment_intent.succeeded
  A->>A: Ingresso status pago
```

## Fluxo resumido: organizador cria evento

1. Registo/login como `tipo=organizador` (Stripe Customer + opcionalmente conta Connect).
2. `POST /api/eventos/criar` com dados do evento e opcionalmente `ingresso_lotes`.
3. API persiste `Evento`, lotes (`EventoIngressoLote`), sincroniza `preco_ingresso` (mínimo entre lotes ativos) e devolve `EventoResponse` com `ingresso_lotes`, `lote_compra_id`, `preco_compra`.

## Onde aprofundar

- Rotas e ficheiros: [02-backend-modulos-rotas.md](./02-backend-modulos-rotas.md)
- Entidades: [03-modelos-de-dados.md](./03-modelos-de-dados.md)
- Stripe e lotes: [05-pagamentos-lotes-webhooks-stripe.md](./05-pagamentos-lotes-webhooks-stripe.md)
