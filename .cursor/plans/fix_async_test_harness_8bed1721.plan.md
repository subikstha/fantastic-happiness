---
name: Fix Async Test Harness
overview: Stabilize async FastAPI integration tests by eliminating shared-session concurrency and aligning pytest-asyncio fixture lifecycle with SQLAlchemy async session best practices.
todos:
  - id: refactor-fixtures
    content: Refactor conftest to use per-request AsyncSession in dependency override and explicit session cleanup.
    status: completed
  - id: add-isolation
    content: Add function-scoped DB cleanup fixture for deterministic test isolation.
    status: completed
  - id: verify-targeted
    content: Run targeted users/accounts tests to confirm concurrency error is gone.
    status: completed
  - id: verify-full-suite
    content: Run full pytest suite and confirm all tests pass without async warnings.
    status: completed
isProject: false
---

# Fix Async Test Harness for API Tests

## Goal

Get `uv run pytest -q` passing reliably by fixing async test fixture/session lifecycle issues that trigger `asyncpg InterfaceError: another operation is in progress`.

## Root Cause Hypothesis

The current test harness reuses one `AsyncSession` instance through dependency override for a full test, while request handling and cleanup can overlap on the same connection in async context. This is brittle with `pytest-asyncio` + SQLAlchemy asyncpg and can produce in-progress-operation errors.

## Implementation Plan

- Refactor test DB fixtures in `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/conftest.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/conftest.py)`:
  - Keep session-scoped schema bootstrap/teardown (`prepare_database`).
  - Replace shared `db_session` override model with per-request session creation in `override_get_db` (fresh `AsyncSession` yield each request).
  - Ensure explicit cleanup (`await session.close()`) in override path to prevent connection reuse leaks.
- Harden async fixture semantics:
  - Keep `pytest_asyncio` fixtures for all async fixtures.
  - Keep test functions async-compatible with current `asyncio_mode = "auto"` in `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/pyproject.toml](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/pyproject.toml)`.
- Add deterministic isolation between tests:
  - Add a function-scoped cleanup fixture (truncate relevant tables or recreate schema between tests) to avoid cross-test contamination and hidden transaction states.
  - Prefer ordered truncate by FK dependency (e.g., `accounts` then `users`) if using raw SQL cleanup.
- Verify incrementally:
  - Run a single failing test first (`test_create_user_success`) to validate session lifecycle fix.
  - Run one accounts test involving sequential requests.
  - Run full test suite.

## Validation Checklist

- No `pytest` async fixture warnings.
- No `InterfaceError: another operation is in progress`.
- All tests in `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_users.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_users.py)` pass.
- All tests in `[/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_accounts.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_accounts.py)` pass.
- Full `uv run pytest -q` passes locally.

## Fallback (if issue persists)

- Switch from schema-once + per-test cleanup to create/drop schema per test module for stronger isolation.
- Add SQLAlchemy engine tuning in tests (`poolclass=NullPool`) to eliminate pool-level reuse while debugging concurrency.
- Run with `-vv -s --maxfail=1` and inspect the first failing request path to identify any accidental concurrent use of the same session object.

