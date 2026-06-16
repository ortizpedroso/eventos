# Documentação técnica — EventosBR

Documentação do sistema (API FastAPI + frontend Next.js + Postgres/Redis + Stripe). Use em conjunto com o [README da raiz](../README.md) para instalação rápida. No site público (Next.js) há uma página resumida em **`/documentacao`**.

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [01 — Visão geral e arquitetura](./01-visao-geral-arquitetura.md) | Stack, diagramas de componentes e fluxos de alto nível |
| [02 — Backend (módulos e rotas)](./02-backend-modulos-rotas.md) | `app/main.py`, routers, schemas, serviços, convenções |
| [03 — Modelos de dados](./03-modelos-de-dados.md) | Entidades, relações, campos relevantes |
| [04 — Frontend Next.js](./04-frontend-nextjs.md) | Rotas App Router, `apiFetch`, componentes-chave |
| [05 — Pagamentos, lotes e webhooks](./05-pagamentos-lotes-webhooks-stripe.md) | Stripe, `PaymentIntent`, lotes, cancelamento, idempotência |
| [06 — Configuração e operação](./06-configuracao-operacao.md) | Variáveis de ambiente, Docker, Alembic, testes |
| [07 — Fase D (roadmap)](./07-fase-d-roadmap.md) | Produção, fiscal, E2E e admin ampliado |
| [08 — Deploy Hostinger (VPS)](./08-deploy-hostinger.md) | Docker prod, Caddy, DNS, go-live |
| [09 — Auditoria segurança e UX](./09-auditoria-seguranca-ux.md) | Checklist do que foi melhorado e o que falta (jun/2026) |
| [10 — Próximo patamar](./10-checklist-proximo-patamar.md) | Checklist completo: o que temos vs o que falta (produto, paridade, diferenciação) |

## Documentação interativa da API

Com a API em execução:

- **Swagger**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Convenções desta pasta

- Caminhos são relativos à **raiz do repositório** (`eventosbr/`), salvo indicação `frontend/...`.
- Rotas HTTP referem-se ao prefixo já montado no router (ex.: `/api/eventos/...`).
