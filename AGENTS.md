# AGENTS.md

EventosBR — a Brazilian event ticketing platform. Two services in one repo:

- **Backend**: FastAPI (Python) in `app/`, config in `config/`. Serves `/api/*`, `/docs`, `/health`, `/ready` on port **8000**.
- **Frontend**: Next.js 16 + React 19 (TypeScript, Tailwind v4) in `frontend/`, port **3000**.

See `README.md`, `QUICKSTART.md`, and `docs/` for product/architecture details. Frontend has its own `frontend/AGENTS.md` (Next.js 16 has breaking changes vs. older versions — read `frontend/node_modules/next/dist/docs/` before editing frontend code).

## Cursor Cloud specific instructions

The startup update script already: creates the Python venv (`./venv`) + installs `requirements.txt`, runs `npm ci` in `frontend/`, and creates a local dev `.env` if one is missing. You normally don't need to reinstall anything.

Non-obvious caveats for running/testing here:

- **No Docker / Postgres / Redis in this environment.** Ignore the `docker-compose*.yml` paths for local dev. The backend runs directly against **SQLite** and falls back to in-memory rate-limiting/email queues (a "Redis indisponível ... usando fallback em memória" log line is expected, not an error).
- **A dev `.env` is required for auth to work.** Without a `SECRET_KEY`, `ENVIRONMENT=development` still boots but JWT issuance (register/login) throws `JWSError: Expecting a string- or bytes-formatted key`. The update script writes a dev `.env` (SQLite + a dev `SECRET_KEY` + `ASAAS_DISABLED=true` + `ENVIRONMENT=development`) if absent. Do **not** copy `.env.example` verbatim — it points `DATABASE_URL` at Postgres, which isn't running here.
- **Run the backend** (from repo root, venv active): `./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`. In `development` the app auto-creates SQLite tables on startup (no Alembic needed). `DEBUG=True` in `.env` makes SQLAlchemy echo every SQL statement (very verbose logs) — set `DEBUG=False` if you want quieter logs.
- **Run the frontend**: `npm run dev` in `frontend/` (uses webpack: `next dev --webpack -p 3000`). With no `NEXT_PUBLIC_API_URL`, the browser talks to the API same-origin via the Next.js `/api/*` proxy → `127.0.0.1:8000`; SSR uses `INTERNAL_API_URL` (defaults to `127.0.0.1:8000`). So no `frontend/.env.local` is needed locally.
- **Publishing a paid event** requires the organizer to have an approved payment (repasse) account; with `ASAAS_DISABLED=true` you can still create events and toggle publish in the organizer dashboard for local testing.

### Commands (standard, from CI `.github/workflows/ci.yml`)

- Backend tests: `./venv/bin/python -m pytest tests/ -q --tb=short`
- Frontend build: `npm run build` (in `frontend/`, with `NEXT_PUBLIC_PAYMENT_PROVIDER=asaas`)
- Frontend lint: `npm run lint` (in `frontend/`) — note: `main` currently has pre-existing eslint errors (e.g. `react-hooks/static-components` in `src/components/navbar.tsx`); CI does not run lint.
- Playwright E2E lives in `frontend/e2e/`; the compra/asaas projects assume the Docker E2E stack (`docker-compose.e2e.yml`) which is not available here.
