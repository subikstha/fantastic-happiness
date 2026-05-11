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
- **Questions (FastAPI):** list (`GET /questions/all`), create (`POST /questions/create`), detail (`GET /questions/{id}`), increment views — see `apps/api/app/application/services/question_service.py` and `apps/api/app/api/v1/endpoints/question.py`.
- **Answers (FastAPI):** create (`POST /api/v1/answers`) with JWT; list by question (`GET /api/v1/answers/all?question_id=...`) with pagination and filters (`latest` / `oldest` / `popular`, aligned with Next `getAnswers`); `AnswerService` increments denormalized `questions.answers` on create; tests under `app/tests/test_answer_service.py` and `test_answer_endpoint.py`. Devlog: `docs/devlog-answers-api-parity.md`.

## Next Tasks
1. **Wire Next.js to FastAPI for answers:** add `api.answers.getAll` (or equivalent) in `apps/web/lib/api.ts` calling `GET .../answers/all`; switch `getAnswers` in `apps/web/lib/actions/answer.action.ts` off Mongoose to the FastAPI response shape; align `answers.create` URL (`/answers`) and JSON body (`question_id` vs `questionId`) with the API contract.
2. **Read paths / single source of truth:** ensure question list/detail UIs use FastAPI where Postgres is authoritative; retire or gate parallel Mongo reads per screen to avoid split-brain IDs (UUID vs ObjectId).
3. **Domain after answers read path:** answer delete in FastAPI (decrement `questions.answers`), votes, tags — same Router → Service → DB pattern.

## Upcoming features (backlog — not scheduled)

AI, quality, and discovery ideas (rule-based checks, **Ollama/local LLM**, duplicates, tags, moderation, semantic search) are captured here:

- [`docs/upcoming-features-ai-quality.md`](upcoming-features-ai-quality.md) — compact tiered backlog.
- [`docs/ai-nlp-future-integrations.md`](ai-nlp-future-integrations.md) — longer product goals and rollout notes.

**Direct messaging and in-app notifications** (data model, REST → SSE → WebSockets rollout, API sketch, safety):

- [`docs/upcoming-features-messaging-notifications.md`](upcoming-features-messaging-notifications.md)

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
- **Questions (FastAPI):** `GET /questions/all`, `POST /questions/create`, `GET /questions/{question_id}`, `POST /questions/{question_id}/increment-views` — SQLAlchemy + Pydantic; see `question_service.py` / `endpoints/question.py`.
- **Answers (FastAPI):** `POST /answers` (JWT), `GET /answers/all` with `question_id`, `page`, `page_size`, `filter`; `AnswerService.get_answers` matches Next `getAnswers` sort rules; `create` increments `questions.answers` and 404s if the question row is missing (avoids silent empty lists when the wrong store or wrong UUID is used — see `docs/devlog-answers-api-parity.md`).

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
- `app/tests/test_answer_service.py`, `app/tests/test_answer_endpoint.py` (answers list/create parity and HTTP smoke for `GET /answers/all`).
- Test collection from `apps/api` works.
- Full execution depends on test DB availability (`devflow_test` / `TEST_DATABASE_URL`).
- Auth tests added and passing:
  - login success
  - invalid credentials
  - `/auth/me` unauthorized + authorized flows
  - refresh success + rotation
  - refresh replay + expired token handling
- Latest full suite run (when DB available): previously `12 passed`; additional answer tests require Postgres (`TEST_DATABASE_URL`).

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
- `docs/devlog-answers-api-parity.md` (answers API, empty-list causes, verification)
- `docs/upcoming-features-ai-quality.md` (AI / quality backlog — not implemented)
- `docs/upcoming-features-messaging-notifications.md` (DMs + in-app notifications backlog — not implemented)
- `docs/ai-nlp-future-integrations.md` (AI/NLP goals and rollout — reference)

## Recommended immediate next steps

1. **Answers from the web app:** implement **Next Tasks** item 1 — FastAPI-backed `getAnswers` + aligned `answers.create` client so the UI reads the same Postgres rows Swagger tests against.
2. **Questions read path in Next:** confirm ask-question and home/detail flows use FastAPI list/detail where intended; document any screens still on Mongo until migrated.
3. **Follow-on API:** answer delete + counter decrement, votes, tags (see **Next Tasks** item 3).

Auth polish and OAuth are listed under **Authentication — deferred (do later)** above.
#Docker command to enter interactive psql mode
#sudo docker exec -it devflow-postgres psql -U postgres -d devflow

