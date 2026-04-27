# Users Service/Endpoint Convention Cleanup

This note documents the completed cleanup where:

- `user_service` now returns ORM `User` objects consistently
- `users` endpoint keeps schema serialization at the API boundary via `response_model`

This aligns with a clean layering rule:

- **Service layer** -> business logic + DB operations (ORM objects)
- **Endpoint layer** -> HTTP concerns + response schema serialization

---

## What changed

### `apps/api/app/application/services/user_service.py`

- Return types changed from `UserRead` to `User`
- Removed `UserRead.model_validate(user)` from service return path
- Service now returns ORM `User` directly

### `apps/api/app/api/v1/endpoints/users.py`

- Endpoint now calls `UserService.get_user_by_id(...)`
- Endpoint keeps `response_model=UserRead` so FastAPI handles serialization
- 404 behavior remains unchanged

---

## Final code (service)

File: `apps/api/app/application/services/user_service.py`

```python
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.user import User
from schemas.user import UserCreate

"""
UserConflictError is a custom exception type
- It lets your service signal a specific business error: “user already exists / conflict”.
- In your endpoint layer, you can catch this exact exception and return HTTP 409 Conflict.
- Better than raising generic Exception, because generic exceptions don’t tell API layer what kind of failure happened.
- service raises UserConflictError
- endpoint translates it to API response (409, clear message)
"""
class UserConflictError(Exception):
    pass # pass indicates to not do anything here, still we can raise it if we want to and add richer behavior like error code, metadata etc

class UserService:
    @staticmethod
    async def get_user_by_id(user_id, db: AsyncSession) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(payload: UserCreate, db: AsyncSession) -> User:
        # Check existing user
        existing = await db.execute(select(User).where(or_(User.email == payload.email, User.username == payload.username)))

        conflict = existing.scalar_one_or_none()
        if conflict:
            if conflict.email == payload.email:
                raise UserConflictError('Email already in use')
            raise UserConflictError('Username already in use')

        user = User(
            name=payload.name,
            username=payload.username,
            email=payload.email,
            bio=payload.bio,
            image=payload.image,
            location=payload.location,
            portfolio=payload.portfolio,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
        # Service layer returns ORM objects (User).
        # Endpoint layer handles response serialization via `response_model`.
        # UserRead is a Pydantic schema (DTO).
        # user is a SQLAlchemy ORM instance
        # UserRead.model_validate(user) converts/validates the ORM object into a UserRead object
        """
        This ensures
        - The returned user data matches the API schema strictly
        - Filters out fields not present in UserRead
        - Gives typed response object from service layer
        """
```

### Service code explanation

- `select` + `AsyncSession`: async SQLAlchemy query execution primitives.
- `User` model import: service works at ORM layer, not Pydantic response layer.
- `UserCreate`: request payload contract used to create new user rows.
- `UserConflictError`: domain-level exception for unique-field conflicts.
- `get_user_by_id(...)-> User | None`: returns ORM object or `None`; no API schema coupling.
- `create(...)-> User`: validates uniqueness, inserts row, commits, refreshes, returns ORM instance.
- `scalar_one_or_none()`:
  - returns one result if found
  - `None` if no rows
  - raises if multiple rows (good for expecting uniqueness)

---

## Final code (endpoint)

File: `apps/api/app/api/v1/endpoints/users.py`

```python
from uuid import UUID # Imports Python’s UUID type. Used to validate user_id path param as a proper UUID automatically.

"""
APIRouter: lets you group related endpoints (users here).
Depends: FastAPI dependency injection (used for DB session).
HTTPException: used to return proper API errors (like 404).
status: named HTTP status codes (status.HTTP_404_NOT_FOUND).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession # Async DB session type for SQLAlchemy.

from application.services.user_service import UserService
from infrastructure.db.session import get_db # Imports dependency function that yields an AsyncSession. FastAPI injects this per request
from schemas.user import UserRead # Pydantic response schema for output serialization. Prevents returning raw ORM internals and enforces response shape


"""
Creates router group for user endpoints
prefix="/users" means all routes in this file start with /users.
tags=["users"] groups endpoints in Swagger UI docs.
"""
router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserRead) # Defines HTTP GET /users/{user_id} route (plus whatever API version prefix is applied in main router). #response_model=UserRead means response is validated/serialized as UserRead.
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    # Endpoint delegates data access/business rules to service layer.
    # Response serialization is still handled at endpoint boundary by response_model=UserRead.
    user = await UserService.get_user_by_id(user_id=user_id, db=db)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
```

### Endpoint code explanation

- Endpoint receives typed inputs (`UUID`, `AsyncSession` dependency).
- Endpoint delegates to `UserService` instead of embedding query logic.
- Endpoint owns HTTP behavior (`404` response using `HTTPException`).
- Endpoint defines `response_model=UserRead`; FastAPI converts ORM `User` -> API schema.
- This keeps serialization concerns at the transport boundary, which is cleaner for long-term maintenance.

---

## Why this convention is better

1. **Cleaner boundaries**
   - Service is reusable by REST handlers, background jobs, or CLI tasks.
2. **Less coupling**
   - Service is not tied to Pydantic response DTOs.
3. **Consistent architecture**
   - Endpoint layer handles HTTP + schema representation.
4. **Easier testing**
   - Service tests can assert ORM/domain behavior without API serialization concerns.

---

## Practical rule to follow for future endpoints

- Service returns ORM/domain object.
- Endpoint declares `response_model` and returns service result.
- Endpoint maps service exceptions to HTTP status codes.

