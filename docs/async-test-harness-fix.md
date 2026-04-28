# Async Test Harness Fix (FastAPI + pytest-asyncio)

This document captures the exact steps used to fix failing API tests caused by async fixture/session lifecycle issues.

## Problem Observed

Running:

```bash
uv run pytest -q
```

Initially produced errors like:

- `pytest.PytestRemovedIn9Warning` for async fixtures not handled in strict-style flow
- `asyncpg.exceptions.InvalidCatalogNameError: database "devflow_test" does not exist`
- `asyncpg InterfaceError: cannot perform operation: another operation is in progress`
- `RuntimeError: got Future ... attached to a different loop`

## Root Causes

1. **Async fixture handling mismatch** with newer `pytest` + `pytest-asyncio`.
2. **Missing test database** (`devflow_test`) in local Postgres.
3. **Connection/session lifecycle conflict** in tests:
   - one shared DB session reused across requests
   - asyncpg pooled connections reused across loop boundaries

---

## What Was Changed

## 1) Configure pytest-asyncio loop behavior

Updated [`apps/api/pyproject.toml`](../apps/api/pyproject.toml):

- keep `asyncio_mode = "auto"`
- set:
  - `asyncio_default_fixture_loop_scope = "session"`
  - `asyncio_default_test_loop_scope = "function"`

### Why

- `prepare_database` is session-scoped, so fixture loop scope must support session lifespan.
- tests run function-scoped loops for isolation and to avoid cross-test loop leakage.

---

## 2) Refactor test fixtures to avoid shared request session

Updated [`apps/api/app/tests/conftest.py`](../apps/api/app/tests/conftest.py):

- keep session-scoped `prepare_database` schema bootstrap/teardown
- remove shared `db_session` fixture usage from API dependency override
- make `override_get_db` create a **fresh `AsyncSession` per request**
- explicitly close each session in `finally: await session.close()`

### Why

- a shared async session across multiple request calls can overlap asyncpg operations.
- per-request session mirrors production request lifecycle and prevents concurrent session misuse.

---

## 3) Add deterministic DB cleanup between tests

Updated [`apps/api/app/tests/conftest.py`](../apps/api/app/tests/conftest.py):

- add function-scoped `autouse` cleanup fixture:
  - `TRUNCATE TABLE accounts, users RESTART IDENTITY CASCADE`

### Why

- guarantees test isolation
- removes cross-test data coupling
- prevents hidden state from causing false positives/negatives

---

## 4) Disable pooling in tests to prevent cross-loop connection reuse

Updated [`apps/api/app/tests/conftest.py`](../apps/api/app/tests/conftest.py):

- create test engine with:
  - `poolclass=NullPool`

### Why

- avoids asyncpg connection reuse across event loops
- eliminates the `"Future attached to a different loop"` class of failures
- keeps test runtime deterministic while debugging concurrency-sensitive setup

---

## 5) Ensure test DB exists

The tests default to:

- `TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/devflow_test`

Create once in your Postgres container if missing:

```bash
docker exec -it devflow-postgres psql -U postgres -c "CREATE DATABASE devflow_test;"
```

### Why

- schema bootstrap cannot run if the database itself is absent.

---

## Verification Steps Used

From `apps/api`:

1. `uv run pytest app/tests/test_users.py::test_create_user_success -vv --maxfail=1`
2. `uv run pytest app/tests/test_accounts.py::test_create_account_success -vv --maxfail=1`
3. `uv run pytest -q`

Final result:

- `6 passed in 2.14s`

---

## Final State

- no async fixture deprecation/setup failures
- no `another operation is in progress` asyncpg errors
- no event-loop mismatch errors
- full API test suite passes reliably
