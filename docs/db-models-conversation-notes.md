# Dev Notes: Creating `User` and `Account` DB Models (FastAPI + SQLAlchemy)

This note captures the key conversation points and mentoring guidance for creating PostgreSQL models in FastAPI, based on the current files:

- `apps/api/app/infrastructure/db/models/user.py`
- `apps/api/app/infrastructure/db/models/account.py`
- `apps/web/database/user.model.ts` (Mongo reference model)

---

## 1) Why we created these models first

The migration plan intentionally starts with `users` and `accounts` because:

- they are foundational for auth/session logic
- they have relatively simple relationships
- they let us validate Alembic + SQLAlchemy flow before moving to more complex entities (`questions`, `answers`, `votes`)

In short: lower risk, high leverage.

---

## 2) `Base` and `session` roles (core architecture)

### `base.py`

`Base` is the declarative root class all ORM models inherit from.

- it registers models into `Base.metadata`
- Alembic uses `Base.metadata` during autogenerate
- it defines **schema shape**, not runtime DB connections

### `session.py`

`session.py` defines runtime DB connectivity:

- async engine (`create_async_engine`)
- async session factory (`async_sessionmaker`)
- request-scoped dependency (`get_db`)

It defines **how app code talks to DB at runtime**, while `base.py` defines **what tables look like**.

---

## 3) `User` model design decisions (from Mongo -> Postgres)

The SQLAlchemy `User` model mirrors `apps/web/database/user.model.ts`:

- required: `name`, `username`, `email`
- optional: `bio`, `image`, `location`, `portfolio`
- counter/default: `reputation` default `0`
- timestamps: `created_at`, `updated_at`

### Why UUID primary keys

`id` uses PostgreSQL UUID + `uuid.uuid4`:

- stable identifier format for distributed systems
- avoids integer ID guessability
- maps cleanly to API usage

### Why `unique=True` + `index=True` on `username` and `email`

- `unique=True` enforces business constraints at DB level
- `index=True` improves lookup performance for auth/profile endpoints

### Why relationship to `Account`

`accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")`

- one user can have many accounts (oauth providers, credentials, etc.)
- bidirectional ORM navigation
- delete-orphan behavior keeps related rows tidy when managed through ORM

#### What `back_populates` is doing

`back_populates="user"` creates a **bidirectional** relationship between:

- `User.accounts` (this side)
- `Account.user` (the other side)

Once both sides are wired with matching `back_populates`, SQLAlchemy can keep the in-memory object graph consistent. For example, if you assign `account.user = user`, SQLAlchemy knows that `user.accounts` should include that account as well (and vice versa).

#### What `cascade="all, delete-orphan"` is doing

`cascade="all, delete-orphan"` controls what happens to related `Account` rows when you work with a `User` object through the ORM:

- `all`: when the ORM persists or deletes a `User`, it also applies the same “unit of work” operations to its related `accounts`.
- `delete-orphan`: if an `Account` is removed from the `User.accounts` collection (so it becomes an “orphan” with no parent user reference in the relationship), SQLAlchemy will issue a **DELETE** for that `Account` row.

This is different from the pure foreign-key behavior: even though your `Account.user_id` also has DB-level `ondelete="CASCADE"`, `delete-orphan` is an ORM-level safeguard that keeps the database tidy when relationships are modified in Python code.

---

## 4) `Account` model design decisions

The `Account` model captures provider-linked identities:

- FK: `user_id -> users.id`
- required provider fields: `provider`, `provider_account_id`
- optional credential fields: `password`, `image`
- timestamps

### Why this unique constraint matters

`UniqueConstraint("provider", "provider_account_id", name="uq_account_provider")`

- prevents duplicate oauth account links
- avoids subtle auth bugs where same provider identity maps to multiple rows

### Why `ondelete="CASCADE"` on `user_id`

If a user is deleted, related account records are automatically removed at DB level.

---

## 5) The `Account is not defined` error and fix

The issue happened in `user.py` on:

`accounts: Mapped[list["Account"]] = relationship("Account", ...)`

Runtime SQLAlchemy accepts string relationships, but type checkers can still complain.

### Correct fix pattern

Use forward references + type-check-only imports:

```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from infrastructure.db.models.account import Account
```

Do the symmetric pattern in `account.py` for `User`.

---

## 6) Current quality check notes

`user.py` is in good shape for initial migrations.

`account.py` currently works conceptually but still has cleanup opportunities:

- duplicated imports (`uuid`, `datetime`)
- unused imports (`Integer`, `UUID6`)
- tutorial-style inline comments that should be reduced in production model files

These do not always break runtime, but they increase noise and can trigger linting/type issues.

---

## 7) File placement guidance

Keep SQLAlchemy persistence files under:

- `apps/api/app/infrastructure/db/base.py`
- `apps/api/app/infrastructure/db/session.py`
- `apps/api/app/infrastructure/db/models/*.py`

Keep API DTO/request-response schemas separately under something like:

- `apps/api/app/schemas/`

This separation avoids mixing DB schema concerns with API payload validation concerns.

---

## 8) Next step after model creation

After final model cleanup:

1. wire Alembic `target_metadata = Base.metadata`
2. ensure model modules are imported in Alembic `env.py`
3. generate migration:
   - `uv run alembic revision --autogenerate -m "create users and accounts"`
4. apply migration:
   - `uv run alembic upgrade head`

Then verify `users` and `accounts` tables exist in PostgreSQL.

---

## 9) Practical mentorship summary

- start with stable foundations (`users`, `accounts`)
- keep relationships explicit and DB constraints strict
- treat lint/type errors early (especially forward refs and imports)
- keep model files clean and concise; move teaching notes to docs (like this file)
- migrate incrementally, validate at each stage

