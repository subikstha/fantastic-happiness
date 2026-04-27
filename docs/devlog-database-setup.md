# Devlog: PostgreSQL (Docker) + FastAPI database configuration

This document records the completed steps to run PostgreSQL in Docker and connect the FastAPI app using SQLAlchemy async sessions. Each section explains **what we did**, **why**, and **which files matter**.

---

## Step 1: Docker Compose for PostgreSQL

**What we did**

- Added a `postgres` service at the **repository root** so the whole monorepo shares one local database.

**Why**

- Developers get the same Postgres version and credentials without installing Postgres on the host.
- A named volume keeps data across container restarts.
- A **healthcheck** (`pg_isready`) lets you confirm the DB is accepting connections before relying on the app.

**File: [docker-compose.yml](../docker-compose.yml)**

| Purpose | Detail |
|--------|--------|
| **Service definition** | Runs `postgres:16-alpine`, exposes `5432:5432`. |
| **Credentials / DB name** | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` must match the app’s `DATABASE_URL`. |
| **Persistence** | `devflow_pgdata` volume stores data under `/var/lib/postgresql/data`. |
| **Healthcheck** | Fails fast in orchestration if Postgres is not ready. |

**Typical command (repo root)**

```bash
docker compose up -d
```

---

## Step 2: Environment variables and settings

**What we did**

- Centralized configuration in **Pydantic Settings**, loaded from **`apps/api/.env`**.
- Resolved the `.env` path from `config.py` so it works even when you start `uvicorn` from `apps/api/app` (current layout).

**Why**

- Secrets and environment-specific values stay out of source code.
- One place to read `DATABASE_URL`, JWT settings, CORS, etc.
- **`CORS_ORIGINS`** is stored as a **comma-separated string** because pydantic-settings otherwise tries to JSON-decode list fields from `.env`, which breaks simple values like `http://localhost:3000`.

**File: [apps/api/.env](../apps/api/.env)** (local only; not committed)

| Purpose | Detail |
|--------|--------|
| **Runtime secrets** | `DATABASE_URL`, `JWT_SECRET`, etc. |
| **DSN for async SQLAlchemy** | Must use the `asyncpg` driver, e.g. `postgresql+asyncpg://user:pass@localhost:5432/devflow`. |

**File: [apps/api/.env.example](../apps/api/.env.example)**

| Purpose | Detail |
|--------|--------|
| **Template** | Documents required variables for new clones; safe to commit. |

**File: [apps/api/app/core/config.py](../apps/api/app/core/config.py)**

| Purpose | Detail |
|--------|--------|
| **`Settings` class** | Typed settings from env + optional `.env` file. |
| **`_API_ROOT` / `_ENV_FILE`** | Points to `apps/api/.env` regardless of process working directory. |
| **`get_settings()` + `lru_cache`** | Single cached settings instance per process. |
| **`settings` singleton** | Imported by `main.py`, `session.py`, and endpoints. |

---

## Step 3: SQLAlchemy async session layer

**What we did**

- Created an **async engine** from `settings.DATABASE_URL`.
- Exposed **`async_session_maker`** and a FastAPI dependency **`get_db`** that yields an `AsyncSession`.

**Why**

- All route handlers that need the DB depend on `get_db` instead of creating connections ad hoc.
- **`pool_pre_ping=True`** avoids using stale connections after idle periods.
- **`expire_on_commit=False`** avoids surprise lazy-load issues after commit in async code (common default for APIs).

**File: [apps/api/app/infrastructure/db/session.py](../apps/api/app/infrastructure/db/session.py)**

| Purpose | Detail |
|--------|--------|
| **`engine`** | Connection pool to PostgreSQL via asyncpg. |
| **`async_session_maker`** | Factory for `AsyncSession` instances. |
| **`get_db()`** | FastAPI dependency: `async with session` then `yield` for request-scoped DB work. |

**Supporting package markers**

- [apps/api/app/infrastructure/__init__.py](../apps/api/app/infrastructure/__init__.py) and [apps/api/app/infrastructure/db/__init__.py](../apps/api/app/infrastructure/db/__init__.py) — make `infrastructure` a regular Python package for stable imports.

---

## Step 4: Prove connectivity (health vs readiness)

**What we did**

- Kept **liveness** (`GET /api/v1/health`) — no DB; answers if the process is up.
- Added **readiness** (`GET /api/v1/health/ready`) — runs `SELECT 1` through `get_db`; returns **503** if the database is unreachable.

**Why**

- Load balancers and deploy pipelines often need **liveness** (process) vs **readiness** (dependencies such as DB).
- A failing DB should not always crash the whole process; returning **503** on `/ready` is the usual pattern.

**File: [apps/api/app/api/v1/endpoints/health.py](../apps/api/app/api/v1/endpoints/health.py)**

| Purpose | Detail |
|--------|--------|
| **`health`** | Sync liveness payload (app name, environment). |
| **`ready`** | Async; uses `Depends(get_db)` and `text("SELECT 1")`. |

**File: [apps/api/app/api/v1/router.py](../apps/api/app/api/v1/router.py)**

| Purpose | Detail |
|--------|--------|
| **`api_router`** | Groups v1 routes; mounts `health.router` under `/health`. |

**File: [apps/api/app/main.py](../apps/api/app/main.py)**

| Purpose | Detail |
|--------|--------|
| **`FastAPI` app** | Title from settings; CORS from comma-separated `CORS_ORIGINS`. |
| **`include_router`** | Mounts `api_router` at `settings.API_V1_PREFIX` (`/api/v1`). |

**Resulting URLs**

| URL | Role |
|-----|------|
| `GET /api/v1/health` | Liveness |
| `GET /api/v1/health/ready` | Readiness (DB) |

---

## Step 5: Developer documentation

**File: [apps/api/README.md](../apps/api/README.md)**

| Purpose | Detail |
|--------|--------|
| **Copy `.env`** | From `.env.example`. |
| **Docker** | `docker compose up -d` from repo root. |
| **Run API** | `uv run uvicorn main:app --reload` from `apps/api/app`. |
| **Verify** | `curl` the readiness endpoint. |

---

## Verification checklist (quick)

1. **Repo root:** `docker compose up -d` — Postgres healthy.
2. **Optional:** `docker compose exec postgres pg_isready -U postgres -d devflow`
3. **`apps/api/app`:** `uv run uvicorn main:app --reload`
4. **Browser or curl:** `GET http://127.0.0.1:8000/api/v1/health/ready` → `200` and `{"status":"ok","database":"connected"}` when DB is up; `503` when it is down.

---

## What comes next (not in this devlog)

- **Alembic** migrations and SQLAlchemy models, using the same `DATABASE_URL`.
- **Repository / Unit of Work** layers on top of `get_db` for domain logic.

---

*Last updated: database + Docker wiring as implemented in this repository.*
