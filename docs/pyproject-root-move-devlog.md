# Devlog: Moved Python Project Root to `apps/api`

This note records the completed task of moving the Python project root from `apps/api/app` to `apps/api`.

## Why this change was made

- Avoid cwd-dependent import issues during tests.
- Standardize `uv`, Alembic, and pytest commands from one root.
- Keep Python tooling files (`pyproject.toml`, lockfile, venv) at project root instead of inside source package.

## What was changed

### Project root files

- Moved/created:
  - `apps/api/pyproject.toml`
  - `apps/api/uv.lock`
- Removed old app-level files:
  - `apps/api/app/pyproject.toml`
  - `apps/api/app/uv.lock`

### Virtual environment

- New venv root: `apps/api/.venv`
- Removed old venv: `apps/api/app/.venv`

### Alembic

- Added root config:
  - `apps/api/alembic.ini`
- Removed old config:
  - `apps/api/app/alembic.ini`
- Kept migration scripts in:
  - `apps/api/app/alembic/`

### Imports and package layout

- Standardized imports to `app.*` across API code.
- Added package marker:
  - `apps/api/app/__init__.py`

### Tests

- Updated test app import to package style:
  - `from app.main import app`
- Added pytest config in `apps/api/pyproject.toml`:
  - `pythonpath = ["."]`
  - `testpaths = ["app/tests"]`

### VS Code interpreter

- Updated root setting in `.vscode/settings.json`:
  - `"python.defaultInterpreterPath": "${workspaceFolder}/apps/api/.venv/bin/python"`

## New standard commands (run from `apps/api`)

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

## Validation summary

- FastAPI app imports successfully from `apps/api` root.
- Alembic resolves head from new root config.
- Pytest collects tests from `app/tests` using root config.

