---
name: Fix Bcrypt Version Mismatch
overview: Stabilize the API auth hashing stack by ensuring the runtime environment actually uses the pinned bcrypt version compatible with passlib, then verify with targeted checks.
todos:
  - id: verify-active-api-runtime
    content: Confirm API process uses apps/api/.venv and check installed bcrypt/passlib versions
    status: completed
  - id: resync-api-dependencies
    content: Resync/reinstall dependencies so runtime matches bcrypt<5 lock resolution
    status: completed
  - id: run-hash-smoke-check
    content: Execute a direct passlib+bcrypt hash/verify smoke test in API interpreter
    status: completed
  - id: retest-register-flow
    content: Retest register endpoint and confirm no bcrypt traceback appears
    status: completed
  - id: document-fix-and-prevention
    content: Add concise troubleshooting note in docs about the mismatch and fix steps
    status: completed
isProject: false
---

# Fix Bcrypt/Passlib Mismatch Plan

## Goal

Resolve the runtime error `module 'bcrypt' has no attribute '__about__'` by aligning the installed API environment with the project’s pinned dependency set and adding repeatable verification.

## What we know

- `apps/api/pyproject.toml` already pins `bcrypt<5` and `passlib[bcrypt]>=1.7.4`.
- `apps/api/uv.lock` resolves `bcrypt` to `4.3.0`.
- The traceback indicates the running environment is not using that resolved set (likely stale venv / mixed install path).

## Plan

1. **Confirm active API runtime context**
  - Verify which Python/venv is being used to run FastAPI (`apps/api/.venv` expected).
  - Check currently installed `bcrypt` and `passlib` versions in that active interpreter.
2. **Resync dependencies from project lock**
  - Run dependency sync from `apps/api` so `.venv` matches `pyproject.toml` + `uv.lock`.
  - If mismatch persists, explicitly reinstall `bcrypt<5` and keep `passlib[bcrypt]` aligned.
3. **Validate hashing path directly**
  - Run a minimal import/hash smoke check with the same interpreter used by FastAPI:
    - import `passlib` and `bcrypt`
    - execute one password hash/verify cycle.
4. **Validate endpoint behavior**
  - Retry `POST /api/v1/auth/register` from frontend/server-action flow.
  - Confirm no bcrypt traceback appears and that expected API response/error contract is returned.
5. **Add prevention notes in docs**
  - Update an auth migration/doc note to capture root cause and fix commands (`uv sync` in `apps/api`, verify versions), so environment drift doesn’t reoccur.

## Files likely touched

- [apps/api/pyproject.toml](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/pyproject.toml) (only if pin adjustments are still needed)
- [apps/api/uv.lock](/home/subikstha/projects/python/jsmasterypro_devflow/apps/api/uv.lock) (only if lock refresh is required)
- [docs/authentication-migration-plan.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/authentication-migration-plan.md) or [docs/context.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/context.md) for a short troubleshooting note

## Success criteria

- FastAPI process runs without bcrypt/passlib traceback.
- Runtime reports `bcrypt` 4.x (not 5.x) in `apps/api` venv.
- Register endpoint works (or returns expected business errors like 409) without low-level hashing import failures.

