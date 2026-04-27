# Project Context

## Overview
StackOverflow clone using Next.js + FastAPI

## Stack
- Frontend: Next.js
- Backend: FastAPI
- DB: PostgreSQL
- ORM: SQLAlchemy 2.0

## Architecture
- Router → Service → DB
- DTOs via Pydantic
- No repository layer (yet)

## Current Progress
- User model implemented
- Alembic configured

## Next Tasks
- Auth endpoints
- Question model

## Notes
- Using UUID for IDs
- Using JWT auth

# Context Summary for Continuation

## Completed so far

- Migration direction established: **Next.js -> FastAPI + PostgreSQL**.
- FastAPI app base + DB connectivity set up.
- Health endpoints added:
  - `GET /api/v1/health`
  - `GET /api/v1/health/ready` (checks DB with `SELECT 1`)
- Docker PostgreSQL setup added via `docker-compose.yml`.
- SQLAlchemy models and Alembic flow established for initial entities (`users`, `accounts`).
- Users/accounts API endpoints, schemas, and service layer created.
- Multiple migration/devlog docs added under `docs/`.

## Key fixes that were made

- `__table_args__` tuple issue fixed in `Account` model (single-item tuple needs trailing comma).
- Alembic placeholder URL (`driver://...`) replaced with real Postgres URL.
- Installed sync driver for Alembic (`psycopg`) while app runtime keeps async driver (`asyncpg`).
- Route prefix duplication issue explained and corrected pattern adopted.
- `account_service` duplicate check fixed to match DB unique constraint pair:
  - `provider + provider_account_id` (not independent OR checks).

## Major structural change completed

Python project root moved from `apps/api/app` to `apps/api`.

### New root artifacts

- `apps/api/pyproject.toml`
- `apps/api/uv.lock`
- `apps/api/.venv`
- `apps/api/alembic.ini`

### Removed old root artifacts from `apps/api/app`

- `pyproject.toml`
- `uv.lock`
- `alembic.ini`
- old `.venv`

### Import/path normalization

- Imports standardized to `app.*`.
- Added `apps/api/app/__init__.py`.
- VS Code interpreter updated to:
  - `${workspaceFolder}/apps/api/.venv/bin/python`

## Command conventions now (run from `apps/api`)

### Run API

```bash
uv run fastapi dev app/main.py
```

or

```bash
uv run uvicorn app.main:app --reload
```

### Alembic

```bash
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

### Tests

```bash
uv run pytest -q
```

(`pyproject.toml` has pytest config pointing to `app/tests`)

## Testing state

- Tests exist:
  - `app/tests/conftest.py`
  - `app/tests/test_users.py`
  - `app/tests/test_accounts.py`
- Test collection from `apps/api` works.
- Full execution depends on test DB availability (`devflow_test` / `TEST_DATABASE_URL`).

## Important docs created

- `docs/devlog-database-setup.md`
- `docs/fastapi-migration-qna.md`
- `docs/alembic-docker-migrations-qna.md`
- `docs/fastapi-next-steps-users-accounts.md`
- `docs/users-service-endpoint-convention-cleanup.md`
- `docs/pyproject-root-move-devlog.md`
- `docs/step-indicator/users-accounts-progress.md`
- `docs/authentication-migration-plan.md`

## Recommended immediate next steps

1. Finish users/accounts slice hardening:
   - ensure accounts endpoint fully follows service pattern
   - validate `409` conflict mapping for both users/accounts
2. Run full tests against `devflow_test`.
3. Then proceed to OAuth sign-in flow migration.
4. Next domain phases: votes -> questions/answers/tags.

