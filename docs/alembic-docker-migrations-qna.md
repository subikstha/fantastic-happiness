# Alembic + Docker PostgreSQL: Q&A and Troubleshooting Notes

This note captures the recent questions and answers around:

- running PostgreSQL in Docker
- generating and applying Alembic migrations
- checking created tables in `psql`
- understanding common migration errors

---

## 1) Do I need to start PostgreSQL Docker before Alembic?

**Short answer:** yes, for your current migration flow.

### Why

- `alembic revision --autogenerate` compares SQLAlchemy metadata with the current DB state and needs a DB connection.
- `alembic upgrade head` actually executes SQL against the DB, so it also needs a running DB.

### Commands

From repo root:

```bash
docker-compose up -d
```

Then check:

```bash
docker-compose ps
docker-compose exec postgres pg_isready -U postgres -d devflow
```

---

## 2) Why did `docker compose up -d` fail with `unknown shorthand flag: 'd'`?

This means Docker Compose v2 plugin is not available in your environment, so `docker compose` is not recognized as expected.

### Use this instead

```bash
docker-compose up -d
```

If your machine later supports Compose v2 plugin, `docker compose up -d` will work too.

---

## 3) Alembic error: `__table_args__ value must be a tuple, dict, or None`

### Cause

In `account.py`, `__table_args__` was likely written as a parenthesized value, not a tuple.

Wrong:

```python
__table_args__ = (
    UniqueConstraint("provider", "provider_account_id", name="uq_account_provider")
)
```

Correct (notice trailing comma):

```python
__table_args__ = (
    UniqueConstraint("provider", "provider_account_id", name="uq_account_provider"),
)
```

---

## 4) Alembic error: `NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:driver`

### Cause

`alembic.ini` still had placeholder URL:

```ini
sqlalchemy.url = driver://user:pass@localhost/dbname
```

### Fix

Use a real Postgres URL for migrations:

```ini
sqlalchemy.url = postgresql+psycopg://postgres:postgres@localhost:5432/devflow
```

---

## 5) Alembic error: `ModuleNotFoundError: No module named 'psycopg'`

### Cause

You configured Alembic to use `postgresql+psycopg://...` but the `psycopg` package was not installed.

### Fix

From the folder containing `pyproject.toml` (your current API project root):

```bash
uv add psycopg
```

Alternative:

- use `psycopg2-binary`
- and set URL to `postgresql+psycopg2://...`

---

## 6) I ran `alembic revision --autogenerate`, but `\d users` says relation not found

This is expected if you only generated the migration file and did not apply it.

### Important distinction

- `revision --autogenerate`: **creates migration script file**
- `upgrade head`: **applies migration to database**

So after generation, run:

```bash
uv run alembic upgrade head
```

Then check in `psql`.

---

## 7) How to enter interactive `psql` and verify tables

From repo root:

```bash
docker-compose exec postgres psql -U postgres -d devflow
```

Inside `psql`:

```sql
\dt
\d users
\d accounts
```

Extra diagnostics:

```sql
SELECT current_database(), current_schema();
SHOW search_path;
```

If tables still do not appear, verify Alembic target DB URL matches the DB you opened in `psql`.

---

## 8) Recommended step-by-step workflow (final)

1. Start DB:
   - `docker-compose up -d`
2. Confirm readiness:
   - `docker-compose exec postgres pg_isready -U postgres -d devflow`
3. Ensure `alembic.ini` has valid URL.
4. Ensure driver dependency is installed (`psycopg` or `psycopg2-binary`).
5. Generate migration:
   - `uv run alembic revision --autogenerate -m "create users and accounts"`
6. Apply migration:
   - `uv run alembic upgrade head`
7. Verify in `psql`:
   - `\dt`, `\d users`, `\d accounts`

---

## 9) Key takeaway

Most confusion came from mixing up:

- migration generation vs migration application
- runtime async DB driver (`asyncpg`) vs Alembic sync driver (`psycopg/psycopg2`)
- Docker command variant (`docker compose` vs `docker-compose`)

Once these are aligned, migrations run reliably.

