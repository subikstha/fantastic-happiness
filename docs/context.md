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
1. **Post questions (logged-in users):** end-to-end flow so an authenticated user can create a question against FastAPI (protected `POST` with JWT, Next.js ask-question UI + server action or client wiring, env `FASTAPI_BASE_URL`, migration for `questions` / tags if not applied). Verify list/detail pages can show the new post or document follow-up if reads still use Mongo.
2. Domain after that: question listing/detail from FastAPI, answers, votes, tags.

## Authentication — deferred (do later)

- **OAuth (Google/GitHub):** provider consoles, redirect URIs, finish `/auth/oauth/...` flow; `SessionMiddleware` and cookie behavior — see `docs/oauth/oauth-route.md`, `docs/oauth/session-middleware-requirement.md`.
- **Refresh token UX:** silent refresh before API calls when access token is near expiry; surface `RefreshAccessTokenError` in the UI.
- **Shared FastAPI client:** one helper for `Authorization: Bearer` and refresh (replace ad-hoc `fetch` in NextAuth refresh with the same pattern as `api.auth.*`).
- **Logout / revoke contract:** align unknown refresh token behavior (`401` vs idempotent `204`); call FastAPI logout with refresh token on sign-out when applicable.
- **Hardening:** production CORS, cookie/`same_site`/`secure`, validate server-only `FASTAPI_BASE_URL` per environment.
- **Optional:** extend integration/E2E tests for authenticated flows.

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
- Eliminated passlib startup traceback (`module 'bcrypt' has no attribute '__about__'`) by pinning API runtime to `bcrypt==4.0.1` and resyncing `apps/api/.venv` with `uv sync`.
  - Quick verification command:
    - `uv run python -c "import bcrypt, passlib; print(bcrypt.__version__, passlib.__version__)"`
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
- `docs/nextauth-web-auth-flow.md` (NextAuth ↔ FastAPI credentials)
- `docs/oauth/oauth-route.md`, `docs/oauth/session-middleware-requirement.md` (for when OAuth work resumes)

## Recommended immediate next steps

1. **Logged-in user can post a question** (see **Next Tasks** at top): FastAPI `POST /api/v1/questions` with Bearer token, Next.js ask flow, DB migration, and basic verification (session carries `accessToken`; `FASTAPI_BASE_URL` includes `/api/v1`).
2. **Read path for questions:** `GET` list/detail from FastAPI so new posts appear without depending on Mongo for that slice.
3. Further domain: answers, votes, tags — migrate or retire parallel Mongo usage per feature.

Auth polish and OAuth are listed under **Authentication — deferred (do later)** above.
#Docker command to enter interactive psql mode
#sudo docker exec -it devflow-postgres psql -U postgres -d devflow

