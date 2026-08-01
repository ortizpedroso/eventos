# EventosBR — instruções para agentes

Monorepo: **FastAPI** (raiz) + **Next.js 16** (`frontend/`).

## Cursor Cloud

O ambiente é definido em `.cursor/environment.json`. No boot:

1. `install` roda `.cursor/setup-cloud.sh` (pip + `npm ci`, `.env` e `frontend/.env.local` se ausentes).
2. Terminais padrão: API (`8000`) e web (`3000`).

### Comandos úteis

| Tarefa | Comando |
|--------|---------|
| Testes API | `python -m pytest tests/ -q --tb=short` |
| Build web | `npm run build --prefix frontend` |
| Lint web | `npm run lint --prefix frontend` |
| Stack Docker completa | `docker compose up -d --build` (requer Docker) |
| E2E (Docker) | `docker compose -p eventosbr-e2e -f docker-compose.e2e.yml up -d --build --wait` |

### Variáveis de ambiente (dev local)

- Raiz: `.env` — `ASAAS_DISABLED=true`, `ENVIRONMENT=development`, SQLite por padrão.
- Frontend: `frontend/.env.local` — `INTERNAL_API_URL=http://127.0.0.1:8000`.
- Secrets de produção (Asaas, SMTP, etc.): configurar na aba **Secrets** do Cloud Agent, não commitar.

### CI

Espelha `.github/workflows/ci.yml`: Python 3.11+, Node 22, pytest, `npm ci` + build no `frontend/`.

## Frontend (Next.js)

Ver também `frontend/AGENTS.md` — esta versão de Next.js difere do treinamento padrão; consulte `node_modules/next/dist/docs/` antes de alterar rotas ou APIs.
