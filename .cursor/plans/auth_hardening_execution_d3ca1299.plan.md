---
name: Auth Hardening Execution
overview: Complete auth hardening, add auth test coverage, and verify with full test run against devflow_test. This plan targets the current FastAPI auth slice and updates docs after verification.
todos:
  - id: harden-auth-errors
    content: Normalize auth/refresh error details and refresh-token service imports/time handling
    status: completed
  - id: add-auth-tests
    content: Create app/tests/test_auth.py covering login, me, refresh rotation/replay/expiry paths
    status: completed
  - id: run-and-fix-tests
    content: Run targeted auth tests then full suite against devflow_test and fix failures
    status: completed
  - id: update-doc-status
    content: Mark completed tasks and next steps in context/authentication plan docs
    status: completed
isProject: false
---

# Auth Hardening and Test Completion Plan

## Scope

Implement the remaining tasks listed in [context.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/context.md):

- normalize production-safe auth error details
- align refresh-token service to generic `401` token errors and clean imports/types
- add `test_auth.py` coverage
- run full tests against `devflow_test`

## Implementation Steps

1. **Harden auth error semantics and service consistency**

- Update [auth_service.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/application/services/auth_service.py) to use consistent, production-safe auth errors (`Invalid credentials` / `Invalid token`) and keep token response shape stable.
- Update [refresh_token_service.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/application/services/refresh_token_service.py):
  - remove redundant/incorrect imports and normalize datetime/timezone usage
  - use explicit `is None` checks for token lookup
  - standardize refresh failure responses to generic `401` token errors
  - keep revoke behavior consistent with chosen API contract (strict `401` or idempotent success).
- Confirm [auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/api/v1/endpoints/auth.py) and [api/deps/auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/api/deps/auth.py) match these semantics (`/me` access token-only, decode failures -> `401`).

1. **Add auth test coverage for critical flows**

- Create [test_auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_auth.py) with cases for:
  - login success
  - invalid credentials
  - `/auth/me` unauthorized and authorized
  - refresh success + token rotation
  - refresh replay/expired token rejection
- Reuse existing test harness patterns from [conftest.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/conftest.py) and response contracts from [schemas/auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/schemas/auth.py).

1. **Verify and stabilize test suite**

- Run targeted auth tests first, then full suite (`uv run pytest -q`) from `apps/api` using `devflow_test`.
- Fix any contract mismatches (status codes, response models, token type casing) discovered during test run.

1. **Documentation sync after verification**

- Update [context.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/context.md) and [authentication-migration-plan.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/authentication-migration-plan.md) to mark completed items and set next immediate target to OAuth migration.

## Key Files

- [auth_service.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/application/services/auth_service.py)
- [refresh_token_service.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/application/services/refresh_token_service.py)
- [auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/api/v1/endpoints/auth.py)
- [api/deps/auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/api/deps/auth.py)
- [test_auth.py](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/app/tests/test_auth.py)
- [context.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/context.md)
- [authentication-migration-plan.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/authentication-migration-plan.md)

