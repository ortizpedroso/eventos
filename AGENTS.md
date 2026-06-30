# AGENTS.md

EventosBR — a Brazilian event ticketing platform. Two dev services:

- **API**: FastAPI (Python) — repo root, package `app/`. Runs on port `8000`.
- **Web**: Next.js 16 (TypeScript) — `frontend/`. Runs on port `3000`. Proxies `/api/*` to the API (see `frontend/next.config.ts`).

See `README.md`, `QUICKSTART.md`, and `docs/README.md` for product/architecture details and API examples.

## Cursor Cloud specific instructions

The update script installs deps only. It creates a Python virtualenv at `./venv` and installs frontend deps under `frontend/node_modules`. It does NOT create env files or start services.

### Env files (gitignored — recreate if missing)
The app reads `.env` (API) and `frontend/.env.local` (web). These are gitignored and not in the repo. For local dev the API defaults to SQLite and `ENVIRONMENT=development`, but Stripe is enabled by default with empty keys, which breaks registration/checkout. Use a dev `.env` at the repo root with `STRIPE_DISABLED=true`, `STRIPE_SKIP_CONNECT_ON_REGISTER=true`, `DATABASE_URL=sqlite:///./eventos.db`, a `SECRET_KEY` of >=32 chars, and `RATE_LIMIT_USE_REDIS=false` / `TICKET_EMAIL_USE_REDIS=false` (so no Redis service is needed). Use `frontend/.env.local` with `INTERNAL_API_URL=http://127.0.0.1:8000`, `API_PROXY_TARGET=http://127.0.0.1:8000`, and `NEXT_PUBLIC_STRIPE_DISABLED=true`.

### Running services (dev mode)
- API: `./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (add `--reload` for hot reload). On startup it auto-creates SQLite tables in development; Alembic migrations are only needed for Postgres/Docker. Redis is optional — the API logs "Redis indisponível ... fallback em memória" and works without it.
- Web: `npm run dev` in `frontend/` (uses webpack, port 3000). `npm run dev:turbo` is the turbopack variant.
- Health checks: `GET /health` (liveness), `GET /ready` (readiness incl. DB).

### Gotchas
- The events list endpoint is `GET /api/eventos` (NO trailing slash); `/api/eventos/` returns 404.
- The browser talks to the API through the Next.js rewrite at `/api/*`; don't point the frontend directly at `:8000` for same-origin cookie auth (sessions use HttpOnly cookies).
- Docker Compose (`docker-compose.yml`) runs the full prod-like stack (Postgres + Redis + API + Web) and sets `ENVIRONMENT=production`, which requires a strong `SECRET_KEY`. For dev, prefer running the two services directly with SQLite as above.
- Next.js here is v16 with breaking changes vs. older versions — consult `frontend/node_modules/next/dist/docs/` before editing frontend code (see `frontend/AGENTS.md`).

### Lint / test / build
- Backend tests: `ENVIRONMENT=test ./venv/bin/pytest -q` (47 tests).
- Frontend lint: `npm run lint` in `frontend/`. Note: there is a pre-existing lint error in `src/app/sobre/page.tsx` (JSX comment) unrelated to environment setup.
- Frontend build: `npm run build` in `frontend/` (production build; not needed for dev).
