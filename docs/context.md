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
- Auth scaffolding started:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
  - auth dependency scaffold in place (`get_current_user`)
- Credentials account flow updated to hash passwords before persistence.
- Refresh-token persistence implemented:
  - `refresh_tokens` model added
  - Alembic migration added for `refresh_tokens` table
  - refresh token create/rotate/revoke service added
- Multiple migration/devlog docs added under `docs/`.

## Key fixes that were made

- `__table_args__` tuple issue fixed in `Account` model (single-item tuple needs trailing comma).
- Alembic placeholder URL (`driver://...`) replaced with real Postgres URL.
- Installed sync driver for Alembic (`psycopg`) while app runtime keeps async driver (`asyncpg`).
- Route prefix duplication issue explained and corrected pattern adopted.
- `account_service` duplicate check fixed to match DB unique constraint pair:
  - `provider + provider_account_id` (not independent OR checks).
- Added explicit account lookup methods for credentials and OAuth account identities.
- Added credentials-account validation:
  - password required for `provider="credentials"`
  - password byte-length guard for bcrypt (`<= 72` bytes)
- Fixed hashing compatibility issue by pinning `bcrypt` to `<5` in API dependencies.
- Added model exports for Alembic metadata discovery (`RefreshToken` import in models package).

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
- `app/tests/test_auth.py`
- Test collection from `apps/api` works.
- Full execution depends on test DB availability (`devflow_test` / `TEST_DATABASE_URL`).
- Auth tests added and passing:
  - login success
  - invalid credentials
  - `/auth/me` unauthorized + authorized flows
  - refresh success + rotation
  - refresh replay + expired token handling
- Latest full suite run: `12 passed`.

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

1. Proceed to OAuth sign-in flow migration (`/auth/oauth/{provider}/start|callback`):
   - provider start endpoint
   - callback endpoint and account-linking logic
   - OAuth test coverage for first sign-in and repeat sign-in
2. Decide refresh-token revoke policy contract:
   - strict `401` for unknown token, or idempotent logout `204`
   - keep service and endpoint behavior aligned to that choice
3. Next domain phases: votes -> questions/answers/tags.
#Docker command to enter interactive psql mode
#sudo docker exec -it devflow-postgres psql -U postgres -d devflow

