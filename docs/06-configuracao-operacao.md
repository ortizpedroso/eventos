# 06 — Configuração, ambientes e operação

## Ficheiros de ambiente

| Local | Uso |
|-------|-----|
| **Raiz `.env`** | API FastAPI (`config/settings.py` lê `env_file=".env"`) |
| **Raiz `.env.example`** | Modelo para Postgres, Asaas, JWT, CORS, Redis, email |
| **`frontend/.env.local`** | `NEXT_PUBLIC_*`, `INTERNAL_API_URL` em Docker |
| **`frontend/.env.local.example`** | Documentação das variáveis do Next |

## Variáveis críticas (API)

| Variável | Notas |
|----------|--------|
| `DATABASE_URL` | Postgres em produção; SQLite possível em dev |
| `SECRET_KEY` | Obrigatória se `ENVIRONMENT` ≠ `development` |
| `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` / `ASAAS_PLATFORM_WALLET_ID` | Produção Asaas |
| `ASAAS_DISABLED` | Só desenvolvimento / emergência |
| `PAYMENT_PROVIDER` | Sempre `asaas` |
| `CORS_ORIGINS` | Lista separada por vírgulas; necessário se o front não usar proxy same-origin |
| `ENVIRONMENT` | `development` ativa `create_tables()` no startup da API |
| `DEBUG` | Influencia webhook mock em desenvolvimento |

## Docker Compose (raiz)

> **Segurança:** as credenciais padrão do Postgres no `docker-compose.yml` (`eventosbr` / `eventosbr`) servem **apenas para desenvolvimento local**. Nunca exponha esse compose em rede pública sem alterar usuário, senha e `SECRET_KEY` / `PLATFORM_ADMIN_API_KEY` fortes.

Serviços típicos:

- **`api`**: build raiz, porta 8000, comando `alembic upgrade head && uvicorn ...`; volume `.:/app`; `healthcheck` em `GET /ready`
- **`db`**: Postgres 16; `healthcheck` com `pg_isready`
- **`redis`**: Redis 7; `healthcheck` com `redis-cli ping`
- **`web`**: build `frontend/`, porta 3000, `INTERNAL_API_URL=http://api:8000`; arranca só com **`api` healthy**

**Importante:** no Windows, volumes com CRLF podem quebrar scripts shell; o compose usa `command` inline (`alembic` + `uvicorn`) na API.

## Migrações de base de dados

```bash
# Na raiz, com venv e DATABASE_URL apontando para a mesma BD da API
alembic upgrade head
```

O histórico está em **`alembic/versions/`**. Em CI/produção, preferir **sempre** Alembic em vez de confiar em `create_tables()`.

## Testes

```bash
python -m pytest tests/ -q
```

Usam SQLite em memória; pagamentos mockados com `ASAAS_DISABLED=true`.

## Observabilidade e saúde

- **`GET /health`**: liveness (processo HTTP vivo; não toca na BD).
- **`GET /ready`**: readiness (inclui BD); **503** se a base falhar — usar em balanceadores e no `healthcheck` do Compose.
- Logs: módulos usam `logging.getLogger(__name__)`; ajustar nível/handlers conforme ambiente.

## Documentação OpenAPI

Com a API a correr: **`/docs`** e **`/redoc`** — útil para experimentar corpos JSON (incl. `ingresso_lotes`).

## Deploy produção (VPS)

Guia completo: **[08 — Deploy Hostinger](./08-deploy-hostinger.md)**.

Ficheiros: `docker-compose.prod.yml`, `deploy/caddy/Caddyfile`, `.env.production.example`, `scripts/deploy-vps.sh`.

## E2E compra (local / CI)

```bash
docker compose -p eventosbr-e2e -f docker-compose.e2e.yml up -d --build --wait
cd frontend && PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e:compra
```

Windows: `.\scripts\e2e-up.ps1` e `.\scripts\e2e-run-compra.ps1`.

## Migração e smoke pós-auditoria

```bash
# Postgres (produção / Docker)
./scripts/migrate-db.sh

# Validar SMTP (defina EMAIL_* no .env antes)
python scripts/test-smtp.py seu-email@exemplo.com

# Smoke: pytest + health + CSP produção
./scripts/smoke-auditoria.sh
```

Teste SMTP pelo painel admin: `POST /api/admin/smtp-test` com header `X-Platform-Admin-Key` e corpo `{"destino":"..."}`.

## Checklist de deploy (sugestão)

1. Definir `ENVIRONMENT=production`, `DEBUG=False`, `SECRET_KEY` forte (`scripts/generate-secrets.ps1`).
2. `DATABASE_URL` persistente; correr **`alembic upgrade head`** (automático no entrypoint do compose prod).
3. Asaas: `ASAAS_API_KEY`, webhook em `https://<domínio>/api/webhooks/asaas`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_PLATFORM_WALLET_ID`.
4. Frontend: `NEXT_PUBLIC_API_URL` com HTTPS; `NEXT_PUBLIC_PAYMENT_PROVIDER=asaas`.
5. `CORS_ORIGINS` alinhado aos domínios reais do site.
6. Backup agendado: `scripts/backup-postgres.sh`.
