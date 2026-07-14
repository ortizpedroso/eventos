# Documentação técnica — EventosBR

Documentação do sistema (API FastAPI + frontend Next.js + Postgres/Redis + **Asaas**). Use em conjunto com o [README da raiz](../README.md) para instalação rápida. No site público (Next.js) há uma página resumida em **`/documentacao`**.

## Documento consolidado

| Documento | Conteúdo |
|-----------|----------|
| **[00 — Sistema completo](./00-sistema-completo.md)** | **Visão única**: produto, funcionalidades, stack, API, frontend, integrações e **todas as tabelas do banco** |

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [01 — Visão geral e arquitetura](./01-visao-geral-arquitetura.md) | Stack, diagramas de componentes e fluxos de alto nível |
| [02 — Backend (módulos e rotas)](./02-backend-modulos-rotas.md) | `app/main.py`, routers, schemas, serviços, convenções |
| [03 — Modelos de dados](./03-modelos-de-dados.md) | Entidades, relações, campos relevantes |
| [04 — Frontend Next.js](./04-frontend-nextjs.md) | Rotas App Router, `apiFetch`, componentes-chave |
| [05 — Pagamentos, lotes e webhooks](./05-pagamentos-lotes-webhooks-asaas.md) | Asaas, PIX/cartão/fatura, lotes, cancelamento, idempotência |
| [06 — Configuração e operação](./06-configuracao-operacao.md) | Variáveis de ambiente, Docker, Alembic, testes |
| [07 — Fase D (roadmap)](./07-fase-d-roadmap.md) | Produção, fiscal, E2E e admin ampliado |
| [08 — Deploy Hostinger (VPS)](./08-deploy-hostinger.md) | Docker prod, Caddy, DNS, go-live |
| [09 — Auditoria segurança e UX](./09-auditoria-seguranca-ux.md) | Checklist do que foi melhorado e o que falta (jun/2026) |
| [10 — Próximo patamar](./10-checklist-proximo-patamar.md) | Checklist completo: o que temos vs o que falta (produto, paridade, diferenciação) |
| [11 — Go-live Asaas](./11-go-live-asaas.md) | Checklist operacional de deploy em produção |
| [12 — Checklist publicação](./12-checklist-publicacao.md) | O que está pronto no código vs o que falta no VPS |
| **Spec produção** | [`specs/eventosbr-producao.md`](../specs/eventosbr-producao.md) — documento único `/build` e `/review` |

## Documentação interativa da API

Em **desenvolvimento local**, com a API em execução:

- **Swagger**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

Em **produção**, `/docs`/`/redoc` ficam desligados por segurança. Use a referência estática gerada a partir do schema real:

- Site: **`/documentacao/api`**
- Esquema bruto: **`/openapi.json`**
- Regenerar após mudar rotas: `python3 scripts/export-openapi.py`

## Convenções desta pasta

- Caminhos são relativos à **raiz do repositório** (`eventosbr/`), salvo indicação `frontend/...`.
- Rotas HTTP referem-se ao prefixo já montado no router (ex.: `/api/eventos/...`).
