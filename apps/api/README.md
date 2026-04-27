# DevFlow API (FastAPI)

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/)
- Docker (for local PostgreSQL)

## Configuration

1. Copy environment template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` if needed. `DATABASE_URL` must match the Postgres service (default: `postgresql+asyncpg://postgres:postgres@localhost:5432/devflow`).

Settings load from **`apps/api/.env`** regardless of the directory you start `uvicorn` from (see `app/core/config.py`).

## PostgreSQL (Docker)

From the **repository root**:

```bash
docker compose up -d
```

Check health:

```bash
docker compose ps
docker compose exec postgres pg_isready -U postgres -d devflow
```

## Run the API

From **`apps/api`**:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Or with FastAPI CLI:

```bash
uv run fastapi dev app/main.py
```

## Verify database connectivity

- Liveness: `GET http://127.0.0.1:8000/api/v1/health`
- Readiness (runs `SELECT 1`): `GET http://127.0.0.1:8000/api/v1/health/ready`

Example:

```bash
curl -s http://127.0.0.1:8000/api/v1/health/ready
```

Expect `200` and `{"status":"ok","database":"connected"}` when Postgres is up. If the DB is down, expect `503`.

## Alembic migrations

From `apps/api`:

```bash
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

## Run tests

From `apps/api`:

```bash
uv run python -m pytest -q app/tests
```
