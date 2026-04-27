---
name: PostgreSQL Docker DB connection
overview: Add a Docker Compose Postgres service, align `DATABASE_URL` via environment, and implement async SQLAlchemy session wiring in FastAPI so the API can connect and optionally expose a readiness check.
todos:
  - id: compose-postgres
    content: Add docker-compose.yml with postgres service, volume, port 5432, healthcheck
    status: completed
  - id: env-dsn
    content: Align DATABASE_URL in .env with Compose; fix .env path vs cwd if needed
    status: completed
  - id: session-layer
    content: Implement infrastructure/db/session.py (async engine, sessionmaker, get_db)
    status: completed
  - id: ready-endpoint
    content: Add optional GET /api/v1/health/ready using get_db + SELECT 1
    status: completed
  - id: verify
    content: Document docker up + curl ready endpoint / manual verification steps
    status: completed
isProject: false
---

# PostgreSQL in Docker + FastAPI connection

## Current state

- `[apps/api/app/core/config.py](apps/api/app/core/config.py)` already has `DATABASE_URL` (asyncpg DSN). Prefer **no secrets in code**: load from `[apps/api/.env](apps/api/.env)` (or `apps/api/app/.env` depending on where you run uvicorn) and remove hardcoded defaults for production-like setups.
- `[apps/api/app/infrastructure/db/session.py](apps/api/app/infrastructure/db/session.py)` is **empty** — this is where the engine, session factory, and `get_db` dependency belong.
- There is **no** `docker-compose` in the repo yet.

## 1. Docker Compose for PostgreSQL

Add a compose file at the repo root (recommended for monorepos) e.g. `[docker-compose.yml](docker-compose.yml)` with:

- **Service** `postgres`: image `postgres:16` (or 15), published port **5432:5432**, env vars `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` matching your app DSN.
- **Volume** for data persistence (named volume) so data survives container restarts.
- Optional: **healthcheck** using `pg_isready` so other services can depend on DB later.

Example DSN the app will use from the host machine:

`postgresql+asyncpg://USER:PASSWORD@localhost:5432/DBNAME`

Document in README or comment: run `docker compose up -d` from repo root before starting the API.

## 2. Environment variables

In `[apps/api/.env](apps/api/.env)` (or the `.env` path your `Settings` actually loads — today `config` uses `env_file=".env"`, which resolves relative to the **process cwd**):

- Set `DATABASE_URL` to match Compose credentials and database name.
- Ensure **one convention**: either always run `uvicorn` from a directory where `.env` sits, or change `SettingsConfigDict` to use an absolute path / `env_file="../.env"` — pick one and stick to it in the plan implementation.

## 3. Implement SQLAlchemy async session layer

In `[apps/api/app/infrastructure/db/session.py](apps/api/app/infrastructure/db/session.py)`:

- Import `create_async_engine`, `async_sessionmaker`, `AsyncSession` from SQLAlchemy 2.x.
- Build `engine` from `settings.DATABASE_URL` with sensible pool settings for dev (`pool_pre_ping=True`).
- Expose `async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)`.
- Add FastAPI dependency `async def get_db()` that yields a session and closes it in a `finally` block.

Optional small **declarative base** in e.g. `infrastructure/db/base.py` for future models (not required for “connection only”).

## 4. Prove the connection (minimal API surface)

Pick one:

- **A)** Add `GET /api/v1/health/ready` (or extend existing health module) that runs `await session.execute(text("SELECT 1"))` and returns 200 vs 503 — best for ops.
- **B)** One-off script or pytest that opens a session — faster but not visible at runtime.

Recommendation: **A** alongside existing `[apps/api/app/api/v1/endpoints/health.py](apps/api/app/api/v1/endpoints/health.py)` and register route in `[apps/api/app/api/v1/router.py](apps/api/app/api/v1/router.py)`.

## 5. Verification checklist

1. `docker compose up -d` — container healthy.
2. From host: `psql` or `docker compose exec postgres psql -U ... -d ... -c 'select 1'`.
3. Start API: `uv run uvicorn main:app --reload` from `[apps/api/app](apps/api/app)` (or your chosen cwd).
4. Hit `GET /api/v1/health/ready` (if implemented) — expect `200`.

## 6. Later (out of scope unless you want it in same PR)

- Alembic migrations wired to the same `DATABASE_URL` and first revision — follow after raw connectivity works.

```mermaid
flowchart LR
  subgraph host [Host]
    FastAPI[FastAPI_uvicorn]
  end
  subgraph docker [Docker]
    PG[(postgres_5432)]
  end
  FastAPI -->|"DATABASE_URL localhost:5432"| PG
```



