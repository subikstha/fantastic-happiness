# FastAPI Migration Q&A Notes

This note captures the key architecture questions and answers from our discussion about migrating this Next.js full-stack project from server actions + MongoDB to FastAPI + PostgreSQL in a future-proof way.

## Q1) Should I use repository pattern for this case, or is there something better?

**Answer:**

Repository pattern is a strong fit for your case, but it should not be used alone.

Best approach:

- Use a **Clean/Hexagonal-lite** architecture.
- Keep this flow: `Endpoint -> Use Case -> Repository Port -> DB Adapter`.
- Repositories abstract persistence; use cases own business rules.

Why this is right for your migration:

- Your current logic is tightly coupled to Mongoose and Next server actions.
- Repository + use case boundaries let you migrate one module at a time.
- Later database changes only require adapter updates, not business logic rewrites.

Patterns that help most:

1. **Clean/Hexagonal-lite (recommended baseline)**
2. **Repository pattern (for data access abstraction)**
3. **Unit of Work (for transaction boundaries across multiple repositories)**
4. **CQRS-lite (optional for read-heavy listing/search endpoints)**
5. **Domain events (optional for async side effects like interactions/notifications)**

Patterns to avoid early:

- Full event sourcing (too much complexity for this stage)
- Overly generic base repositories that leak abstractions
- Heavy DDD ceremony before migration stabilizes

## Q2) Which module/service should I start with for incremental migration?

**Answer:**

Start with **Users + Accounts + auth-adjacent APIs**, then move to **Votes**, then migrate **Questions/Answers/Tags**.

Recommended order:

1. Foundation setup (FastAPI skeleton, Postgres, Alembic, ports, UoW)
2. Users + Accounts (already route-oriented and lower coupling)
3. OAuth sign-in backend flow
4. Votes module (good pilot for transactional use-case pattern)
5. Questions + Answers + Tags (highest complexity and coupling)
6. Interactions/recommendation logic and final cleanup

Why this order:

- Lowest risk first
- Early wins for auth-dependent flows
- Validates architecture before moving the hardest domain logic

## Q3) Show concrete architecture mapping for an existing flow (example: createVote)

**Answer:**

Move current vote behavior into:

- **FastAPI endpoint**: handles HTTP concerns only
- **Use case**: vote rules (toggle/switch/create)
- **Repositories**: DB operations only
- **Unit of Work**: transaction boundary
- **Interaction side effect**: inside transaction or via event (depending on consistency needs)

The use case should preserve current behavior:

- If same vote exists -> remove vote and decrement counter
- If opposite vote exists -> switch type and rebalance counters
- If no vote exists -> create vote and increment counter
- Record interaction
- Commit transaction atomically

## Q4) What monorepo folder structure should I follow?

**Answer:**

Use a structure inspired by FastAPI official "Bigger Applications" while adding clear domain boundaries:

```text
repo/
  apps/
    web/                        # Next.js app
    api/                        # FastAPI app
      app/
        main.py
        core/
        api/
          deps.py
          v1/
            router.py
            endpoints/
        domain/
        application/
          dto/
          use_cases/
          ports/
        infrastructure/
          db/
          repositories/
        schemas/
        tests/
      alembic/
      pyproject.toml
  packages/
    api-contract/               # generated OpenAPI TS client/types
```

## Q5) How to design database-agnostic layers so I can swap DBs later?

**Answer:**

Design by ports/adapters:

- Define repository interfaces in `application/ports`.
- Implement `postgres` adapters first.
- Keep business logic in use cases, not in repositories or endpoints.
- Inject adapters via FastAPI dependencies.
- Use Unit of Work to coordinate multi-repository transactions.

DB switch strategy later:

- Keep use cases unchanged.
- Add new adapter package (e.g., `infrastructure/repositories/mongo`).
- Swap binding via configuration.

## Q6) 6-week incremental migration plan

### Week 1 - Foundation

- FastAPI scaffold, Postgres, Alembic
- Router versioning, config, health endpoint
- Repository ports + Unit of Work
- Basic test pipeline

### Week 2 - Users + Accounts

- Migrate users/accounts endpoints to FastAPI
- Point Next `lib/api` calls for those modules to FastAPI
- Keep old handlers temporarily as fallback

### Week 3 - OAuth sign-in path

- Migrate oauth sign-in transactional flow
- Keep NextAuth in Next.js for now
- Ensure account/user upsert behavior parity

### Week 4 - Votes

- Migrate vote flow to endpoint + use case + UoW
- Validate toggle/switch/count consistency

### Week 5 - Questions/Answers/Tags

- Migrate core write flows first
- Then migrate list/search/filter/read endpoints
- Ensure many-to-many and cascade integrity in Postgres

### Week 6 - Cleanup and decommission

- Migrate remaining auxiliary actions
- Remove Mongo from active runtime path
- Performance tuning and hardening
- Remove legacy server action code after stable rollout window

## Q7) What feature flags should I use for safe rollout?

**Answer:**

Use module-level flags for instant rollback without large redeploy risk:

- `USE_FASTAPI_USERS`
- `USE_FASTAPI_ACCOUNTS`
- `USE_FASTAPI_OAUTH_SIGNIN`
- `USE_FASTAPI_VOTES`
- `USE_FASTAPI_QA`

## Q8) What should my immediate first sprint include?

**Answer:**

Start with:

1. FastAPI scaffold + Postgres + Alembic
2. Implement three critical endpoints:
   - `users.getById`
   - `users.getByEmail`
   - `accounts.getByProvider`
3. Point NextAuth dependency paths to these FastAPI endpoints
4. Add parity tests for credential and oauth lookup flows

This gives low-risk separation early while establishing the architecture for all later migrations.

## Q9) If I use `uv`, do I still need a virtual environment?

**Answer:**

Yes, still use a virtual environment for project isolation. The key point is:

- `uv` can **create and manage** the virtual environment for you automatically.
- You do not need to manually run `python -m venv` first if you are using `uv` workflows.

In your terminal logs, `uv` created `.venv` automatically. The warning happened because your shell was activated in `.env`, while `uv` was using `.venv`.

Recommended for consistency:

- Keep only one environment for `apps/api` (prefer `.venv` with `uv`).
- Activate `.venv` when running commands manually, or run through `uv run ...`.
- Avoid mixing `.env` and `.venv` in the same project.

## Q10) I already ran `pip install fastapi[standard]`. Is that a problem if I now use `uv`?

**Answer:**

Not a problem. But from now on, use one dependency manager consistently.

Best practice:

- If project uses `uv init` + `pyproject.toml`, then use `uv add ...` for dependencies.
- Do not keep switching between `pip install` and `uv add` randomly.

If you already installed with `pip`, you can still continue with `uv`; just make sure `pyproject.toml` and lockfile are your source of truth going forward.

## Q11) I created a basic `main.py`. What is the next step in migration?

**Answer:**

After creating:

```python
from fastapi import FastAPI

app = FastAPI()
```

the next steps should be:

1. Add a health route (`GET /health`) to verify app wiring.
2. Create app structure folders (`app/api/v1/endpoints`, `app/core`, `app/schemas`, `app/infrastructure`, `app/application`).
3. Add `config.py` using `pydantic-settings` to load env values.
4. Set up database session module (SQLAlchemy async engine + session maker).
5. Initialize Alembic and create first migration.
6. Implement first low-risk module (`users/accounts`) before moving to votes/questions.

## Q12) What is `config.py` in FastAPI projects?

**Answer:**

`config.py` is the centralized configuration module for your backend.

It typically:

- reads environment variables (`DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`, etc.)
- validates them
- provides typed settings object to the app

Why it matters:

- One source of truth for configuration
- Avoids hardcoding values across modules
- Makes dev/staging/prod configuration predictable

Typical location in your structure:

- `apps/api/app/core/config.py`

Typical usage pattern:

- Define a `Settings` class (with `pydantic-settings`)
- Instantiate once (e.g., `settings = Settings()`)
- Import `settings` wherever needed (DB, auth, logging, CORS setup)

## Q13) Why does `uv run fastapi dev ...` fail with `No such file or directory (os error 2)`?

**Answer:**

This usually happens when the virtual environment scripts have stale interpreter paths after folders were moved.

In your case, the `.venv/bin/fastapi` and `.venv/bin/uvicorn` scripts existed, but their first line (`#!...`) pointed to an old Python path that no longer existed after moving files.

What that means:

- The executable is present
- But its shebang points to a deleted/moved interpreter path
- So OS cannot spawn it and throws `No such file or directory`

Fix:

1. Remove the broken virtual environment in the current project root.
2. Recreate/sync the environment using `uv` so scripts get regenerated with correct paths.
3. Run the app again.

Example flow:

```bash
rm -rf .venv
uv sync
uv run fastapi dev main.py
```

Or:

```bash
uv run uvicorn main:app --reload
```

Best practice to avoid this issue:

- Keep `pyproject.toml` and `.venv` at one stable project root (recommended: `apps/api`)
- Keep app code under `apps/api/app`
- Run commands from the same project root consistently

## Q14) Review of current `config.py` and what to improve next

**Answer:**

Your current `config.py` structure is strong and follows good FastAPI practice:

- Uses `BaseSettings` and `SettingsConfigDict` correctly
- Centralized typed settings object
- Uses `@lru_cache` for singleton-like settings loading
- Includes useful CORS parsing via `field_validator`

Main correction needed:

- `DATABASE_URL` should be `str`, not `AnyHttpUrl`

Reason:

- SQLAlchemy DSNs like `postgresql+asyncpg://user:pass@host:5432/dbname` are database URLs, not plain HTTP URLs.
- Typing it as `AnyHttpUrl` can lead to validation mismatch or unnecessary constraints.

Recommended change:

```python
DATABASE_URL: str
```

Optional enhancement:

- Expand environment values to include `development`:

```python
ENVIRONMENT: Literal["local", "development", "staging", "production"] = "local"
```

## Q15) Immediate next tasks after `config.py`

**Answer:**

After fixing `DATABASE_URL` typing, continue with these tasks in order:

1. Wire `settings` into `main.py` (`title`, API prefix, CORS)
2. Implement `app/api/v1/router.py` and include `health` endpoint router
3. Implement `app/api/v1/endpoints/health.py` (`GET /health`)
4. Implement `app/infrastructure/db/session.py` using async SQLAlchemy engine + session maker
5. Validate startup and route loading (`uv run ...`)
6. Then proceed to first real migrated module (`users/accounts` read endpoints)

This sequence keeps migration low-risk while establishing a clean backend foundation.

