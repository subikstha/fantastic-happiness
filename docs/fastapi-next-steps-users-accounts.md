# FastAPI Migration: Next Steps (Users + Accounts Slice)

This document captures the immediate next implementation tasks after completing DB connection + Alembic migrations.

## Goal of this phase

Deliver the first vertical slice on FastAPI using PostgreSQL:

1. API schemas (Pydantic)
2. Read endpoints for `users` and `accounts`
3. Router integration
4. Verification and handoff to web integration

---

## Step 1: Add Pydantic API schemas

Create API-layer schemas (separate from SQLAlchemy models):

- `apps/api/app/schemas/user.py`
- `apps/api/app/schemas/account.py`

### Required schema outputs

- `UserRead`
- `AccountRead`

Use `model_config = {"from_attributes": True}` for ORM response serialization.

### Example (`UserRead`)

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: UUID
    name: str
    username: str
    email: EmailStr
    bio: str | None = None
    image: str | None = None
    location: str | None = None
    portfolio: str | None = None
    reputation: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

### Line-by-line explanation (`UserRead`)

- `from datetime import datetime` and `from uuid import UUID`: imports types used by response fields.
- `from pydantic import BaseModel, EmailStr`: `BaseModel` defines API schema, `EmailStr` validates email format.
- `class UserRead(BaseModel)`: response DTO returned by endpoints.
- `id: UUID`: user ID is serialized as UUID string in JSON.
- `name`, `username`, `email`: required user identity fields.
- `bio`, `image`, `location`, `portfolio`: optional profile fields (`None` allowed).
- `reputation: int`: numeric score field.
- `created_at`, `updated_at`: timestamps from DB row.
- `model_config = {"from_attributes": True}`: allows Pydantic to serialize directly from ORM model instances (not just dicts).

---

## Step 2: Add Users read endpoint

Create:

- `apps/api/app/api/v1/endpoints/users.py`

### Endpoint

- `GET /api/v1/users/{user_id}`

### Behavior

- Fetch user by UUID
- Return `404` if not found
- Return `UserRead` on success

### Example

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.user import User
from infrastructure.db.session import get_db
from schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
```

### Line-by-line explanation (`users.py`)

- `from uuid import UUID`: validates path parameter as UUID.
- `APIRouter, Depends, HTTPException, status`: router creation, dependency injection, and HTTP error handling utilities.
- `select` and `AsyncSession`: SQLAlchemy async query API.
- `from infrastructure.db.models.user import User`: ORM table model.
- `from infrastructure.db.session import get_db`: request-scoped DB session dependency.
- `from schemas.user import UserRead`: controls response shape and serialization.
- `router = APIRouter(prefix="/users", tags=["users"])`: all routes in this module are under `/users`, grouped in docs.
- `@router.get("/{user_id}", response_model=UserRead)`: GET endpoint with typed response model.
- `db: AsyncSession = Depends(get_db)`: FastAPI injects DB session per request.
- `await db.execute(select(User).where(User.id == user_id))`: runs SQL query to fetch a matching user row.
- `result.scalar_one_or_none()`: returns one `User` object or `None`; raises if multiple rows unexpectedly match.
- `if not user: raise HTTPException(404, ...)`: returns clear not-found API response.
- `return user`: FastAPI serializes ORM object into `UserRead`.

---

## Step 3: Add Accounts read endpoint

Create:

- `apps/api/app/api/v1/endpoints/accounts.py`

### Endpoint

- `GET /api/v1/accounts/provider/{provider}/{provider_account_id}`

### Behavior

- Lookup account by provider pair
- Return `404` when absent
- Return `AccountRead` on success

### Example

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.account import Account
from infrastructure.db.session import get_db
from schemas.account import AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/provider/{provider}/{provider_account_id}", response_model=AccountRead)
async def get_account_by_provider(
    provider: str,
    provider_account_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(
            Account.provider == provider,
            Account.provider_account_id == provider_account_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account
```

### Line-by-line explanation (`accounts.py`)

- `APIRouter, Depends, HTTPException, status`: same endpoint plumbing as users endpoint.
- `select` + `AsyncSession`: async DB query execution.
- `Account` model import: ORM mapping for `accounts` table.
- `get_db`: provides DB session lifecycle.
- `AccountRead`: typed response payload model.
- `router = APIRouter(prefix="/accounts", tags=["accounts"])`: route grouping and OpenAPI tagging.
- `@router.get("/provider/{provider}/{provider_account_id}", ...)`: lookup account by provider identity pair.
- Function arguments `provider` and `provider_account_id`: extracted from URL path.
- `select(Account).where(...)`: SQL filter on both provider columns.
- `scalar_one_or_none()`: returns one account or `None`.
- `raise HTTPException(404, ...)`: consistent not-found behavior.
- `return account`: response serialized by `AccountRead`.

---

## Step 4: Register routers in v1 API router

Update:

- `apps/api/app/api/v1/router.py`

Include both routers:

- `users.router`
- `accounts.router`

---

## Step 5: Validate endpoints

Run app and verify:

- `GET /api/v1/health`
- `GET /api/v1/users/{id}`
- `GET /api/v1/accounts/provider/{provider}/{provider_account_id}`

Use Swagger docs (`/docs`) to verify response models and status codes.

---

## Step 6: Web integration (incremental)

After API validation, update only these web client calls first:

- `users.getById`
- `users.getByEmail` (when implemented)
- `accounts.getByProvider`

Keep remaining server actions untouched until this slice is stable.

---

## Deliverable criteria for this phase

- Schemas created and used in responses
- Read endpoints live and returning expected status codes
- v1 router wired
- Basic endpoint tests/manual checks passed
- Web app can resolve user/account lookup against FastAPI for migrated calls

