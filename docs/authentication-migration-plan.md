# Authentication Migration Plan (NextAuth -> FastAPI)

## Goal

Migrate authentication and authorization ownership from Next.js/NextAuth to FastAPI while preserving existing user behavior and minimizing rework for upcoming domains (`questions`, `answers`, `votes`).

## Current Baseline

- Users/accounts models, endpoints, and service layer are present in FastAPI.
- Account uniqueness is aligned to `provider + provider_account_id`.
- Project architecture follows `Request -> Router -> Service -> DB`.
- Next.js currently performs auth orchestration via `apps/web/auth.ts` using:
  - credentials sign-in
  - Google/GitHub OAuth sign-in
  - account lookup to resolve user identity (`token.sub`)

## Decision

- Do not use NextAuth as the long-term auth backend after migration.
- Implement authentication as a FastAPI-owned concern.
- Keep Next.js as a client of FastAPI auth endpoints.

## Target Architecture

Separate responsibilities clearly:

1. Authentication
   - Verify credentials/OAuth identity
   - Issue access/refresh tokens
2. Identity Resolution
   - Convert token/session to `current_user`
3. Authorization
   - Enforce ownership/policy checks (`403` vs `401`)

## Recommended Implementation Stack

- OAuth/OIDC client: `Authlib`
- JWT signing/verification: `PyJWT` or `python-jose`
- Password hashing: `bcrypt` (or `argon2` if introduced consistently)
- Refresh tokens: DB-backed and hashed at rest

## API Contract (MVP)

Implement these under `/api/v1/auth`:

- `POST /login`
  - Credentials login
  - Returns access + refresh token pair and normalized user payload
- `POST /refresh`
  - Rotates refresh token, issues new token pair
- `POST /logout`
  - Invalidates refresh token/session
- `GET /me`
  - Returns authenticated user profile from token
- `GET /oauth/{provider}/start`
  - Starts OAuth flow (`provider` in `github|google`)
- `GET /oauth/{provider}/callback`
  - Handles provider callback, links/creates account, issues tokens

## Service-Level Refactor Needed First

Avoid overloaded account lookup methods. Prefer explicit service APIs:

- `get_credentials_account_by_email(email)`
- `get_oauth_account(provider, provider_account_id)`
- `create_credentials_account(...)`
- `create_oauth_account(...)`

This removes ambiguity between credentials identity and OAuth identity.

## Migration Phases

### Phase 0: Hardening Gate (Before Auth Build)

- Confirm users/accounts endpoints consistently map:
  - conflicts -> `409`
  - invalid payload -> `422`
  - missing entities -> `404`
- Ensure users/accounts tests are stable on `devflow_test`.
- Confirm clean DB migration flow: `alembic upgrade head`.

### Phase 1: Credentials Auth in FastAPI

- Implement login + token issue path.
- Add auth dependency (`get_current_user`) and protect `GET /auth/me`.
- Add tests:
  - success login
  - invalid password
  - unknown email
  - unauthorized `GET /auth/me`

### Phase 2: OAuth Sign-In in FastAPI

- Add provider start/callback endpoints using Authlib.
- In callback:
  1. verify provider response
  2. resolve account by (`provider`, `provider_account_id`)
  3. create/link user+account atomically when absent
  4. issue tokens
- Add tests:
  - first OAuth login creates linkage
  - repeat OAuth login reuses linkage
  - collision/edge case handling

### Phase 3: Authorization Baseline

- Introduce policy helpers for ownership checks used by future domains.
- Standardize:
  - `401` for unauthenticated
  - `403` for authenticated but forbidden
- Add at least one protected mutation test proving policy enforcement.

### Phase 4: Frontend Cutover

- Switch Next.js auth usage from NextAuth callback orchestration to FastAPI auth endpoints.
- Keep response shape compatible with frontend session needs (`id`, `email`, `name`, `image`, optional `username`).
- Remove legacy NextAuth-only assumptions incrementally.

## Security Baseline (Required)

- Short access token TTL (example: 10-15 minutes).
- Refresh token rotation with reuse detection.
- Hash refresh tokens in DB (never store plain token).
- Validate OAuth `state` (and PKCE where applicable).
- Rate limit login endpoint.
- Log auth events (login success/failure, refresh, logout).

## Authorization Guidance for Upcoming Domains

Before building `questions`/`answers` write endpoints:

- Ensure `current_user` injection is stable.
- Add ownership checks in service layer (not only in router).
- Keep domain policy functions explicit (for readability and reuse).

## Definition of Done for Auth Migration

Auth migration is considered complete when:

1. Credentials login, OAuth login, refresh, logout, and `/auth/me` are implemented in FastAPI.
2. Token lifecycle and account linking tests pass reliably.
3. Authorization baseline (`401`/`403` + ownership checks) is enforced.
4. Next.js consumes FastAPI auth endpoints without relying on NextAuth callback-side effects.

## Immediate Next Actions

1. Run hardening gate for users/accounts tests and error mapping.
2. Implement credentials auth endpoints and token service.
3. Add OAuth provider callback flow and account-linking logic.
4. Add policy helper primitives before starting protected domain mutations.

## Progress Snapshot (Current)

### Completed

- Auth router is wired into API v1 routing.
- Credentials login endpoint is implemented (`POST /api/v1/auth/login`).
- Current-user dependency scaffold exists and `/api/v1/auth/me` route is present.
- Credentials account lookup helper is implemented in account service.
- Password hashing is applied for credentials account creation.
- `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` routes are wired.
- `AuthService.refresh(...)` and `AuthService.logout(...)` are implemented.
- Refresh token service scaffold is implemented (create/rotate/revoke).
- Refresh token DB model is implemented and exported for Alembic discovery.
- Migration added to create `refresh_tokens` table (`5a7e1576c016_add_refresh_token.py`).
- Credentials input validation includes:
  - password required for `provider="credentials"`
  - bcrypt byte-length guard (`<= 72` bytes)
- Dependency compatibility fix applied: `bcrypt` pinned below `5`.

### Still Pending To Finish Phase 1

- Add robust invalid-token handling path in `get_current_user` (map decode failures to `401`).
- Add `app/tests/test_auth.py` coverage for login + `/auth/me` scenarios.
- Add refresh token tests (rotate success, replay/reuse rejection, expiry rejection).
- Remove sensitive login debug logging and return production-safe auth error details.
- Normalize `refresh_token_service.py` imports/types and timezone usage for correctness/readability.
- Clean migration chain hygiene (remove/squash the empty `e33c2d015199_add_refresh_tokens.py` revision if not needed).

## Implementation Guide (Code Samples)

The snippets below are intentionally minimal and aligned with the current codebase layout.

### 1) Install auth dependencies

Run from `apps/api`:

```bash
uv add authlib "python-jose[cryptography]" "passlib[bcrypt]"
```

### 2) Add auth schemas

Suggested file: `apps/api/app/schemas/auth.py`

```python
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthUser(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    image: str | None = None
    username: str | None = None


class AuthResponse(BaseModel):
    tokens: TokenPair
    user: AuthUser
```

### 3) Add JWT + password helpers

Suggested file: `apps/api/app/core/security.py`

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(sub: str) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": sub, "type": "access", "exp": expires_at}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, int(expires_delta.total_seconds())


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
```

### 4) Split account lookup methods (credentials vs OAuth)

Update `AccountService` with explicit APIs:

```python
@staticmethod
async def get_credentials_account_by_email(
    email: str, db: AsyncSession
) -> Account | None:
    result = await db.execute(
        select(Account).where(
            Account.provider == "credentials",
            Account.provider_account_id == email,
        )
    )
    return result.scalar_one_or_none()


@staticmethod
async def get_oauth_account(
    provider: str, provider_account_id: str, db: AsyncSession
) -> Account | None:
    result = await db.execute(
        select(Account).where(
            Account.provider == provider,
            Account.provider_account_id == provider_account_id,
        )
    )
    return result.scalar_one_or_none()
```

### 5) Add auth service (credentials flow first)

Suggested file: `apps/api/app/application/services/auth_service.py`

```python
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.account_service import AccountService
from app.application.services.user_service import UserService
from app.core.security import create_access_token, verify_password


class AuthService:
    @staticmethod
    async def login(email: str, password: str, db: AsyncSession) -> dict:
        account = await AccountService.get_credentials_account_by_email(
            email=email, db=db
        )
        if not account or not account.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if not verify_password(password, account.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user = await UserService.get_user_by_id(user_id=account.user_id, db=db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        access_token, expires_in = create_access_token(sub=str(user.id))

        # TODO: replace placeholder with DB-backed refresh token service.
        refresh_token = "TODO_REFRESH_TOKEN"

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username,
            },
        }
```

### 6) Add auth endpoints

Suggested file: `apps/api/app/api/v1/endpoints/auth.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.auth_service import AuthService
from app.infrastructure.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(email=payload.email, password=payload.password, db=db)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    # TODO: implement refresh token rotation logic.
    return await AuthService.refresh(refresh_token=payload.refresh_token, db=db)
```

Register it in `apps/api/app/api/v1/router.py`:

```python
from app.api.v1.endpoints import auth

api_router.include_router(auth.router, tags=["auth"])
```

### 7) Add current-user dependency and `/auth/me`

Suggested file: `apps/api/app/api/deps/auth.py`

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.user_service import UserService
from app.core.security import decode_token
from app.infrastructure.db.session import get_db

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = await UserService.get_user_by_id(payload["sub"], db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user
```

Then in `auth.py`:

```python
from app.api.deps.auth import get_current_user


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return current_user
```

### 8) OAuth callback integration shape (Authlib)

The callback path should:

1. Verify provider response and fetch profile from provider.
2. Resolve account by (`provider`, `provider_account_id`).
3. Create/link user + account when absent.
4. Issue tokens using the same token service as credentials.

Core linkage pattern:

```python
provider_account_id = (
    profile["sub"] if provider == "google" else str(profile["id"])
)

account = await AccountService.get_oauth_account(
    provider=provider,
    provider_account_id=provider_account_id,
    db=db,
)

if account is None:
    # create user + oauth account in one transaction
    ...
```

### 9) Test coverage to add immediately

Suggested file: `apps/api/app/tests/test_auth.py`

```python
async def test_login_invalid_credentials_returns_401(client):
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong"},
    )
    assert res.status_code == 401


async def test_me_requires_auth(client):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
```

After credentials flow is done, add:

- login success returns token pair + user payload
- `/auth/me` with valid bearer token returns current user
- refresh rotation test (old refresh token rejected)
- OAuth first sign-in creates linkage, repeat sign-in reuses linkage

### 10) Suggested implementation order

1. Service refactor for explicit account lookups.
2. Credentials login + `/auth/me`.
3. Refresh token persistence + rotation.
4. OAuth start/callback with account linking.
5. Authorization policy helpers before protected write routes.

## Refresh Token Implementation (DB-backed + Rotation)

This section adds an implementation-oriented blueprint for `POST /api/v1/auth/refresh`.

### 1) DB model: `refresh_tokens` table

Suggested file: `apps/api/app/infrastructure/db/models/refresh_token.py`

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Token ownership
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Token family to support reuse detection (rotate = extend the family, revoke = revoke family)
    family_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        index=True,
        nullable=False,
    )

    # Unique per refresh token (also stored in JWT as `jti`)
    jti: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    # Hash refresh token at rest (do NOT store raw refresh token)
    # Use SHA-256 (or similar) so lookups are fast and comparison is deterministic.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Rotation / invalidation state
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_refresh_tokens_user_family", "user_id", "family_id"),
    )
```

### 2) Security helpers: create + decode refresh tokens

Extend `apps/api/app/core/security.py` with:

```python
import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from app.core.config import settings


def create_refresh_token(*, sub: str, family_id: str, jti: str) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": sub,
        "type": "refresh",
        "family_id": family_id,
        "jti": jti,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, int(expires_delta.total_seconds())


def decode_token(token: str) -> dict:
    # reuse your existing decode_token; it already returns JWT claims
    ...
```

You’ll also need config values:
- `REFRESH_TOKEN_EXPIRE_MINUTES`

### 3) Hashing refresh tokens at rest

Suggested helper (for deterministic DB lookup):

```python
import hashlib

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()
```

Use `sha256_hex(raw_refresh_token)` to populate `RefreshToken.token_hash`.

### 4) Service logic: issue + rotate refresh tokens

Suggested files:
- `apps/api/app/application/services/refresh_token_service.py`
- add methods to `AuthService`

Core rotation algorithm (high level):
1. Decode refresh JWT (`type=refresh`, extract `sub`, `family_id`, `jti`)
2. Hash the *received* refresh token and find the DB row by `token_hash`
3. If expired or revoked: treat as reuse attempt
4. If valid:
   - revoke current token row
   - create a new refresh token row in the same family
   - issue new access token

Pseudo-implementation:

```python
from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.security import create_access_token, create_refresh_token, decode_token
from app.infrastructure.db.models.refresh_token import RefreshToken

from app.application.services.user_service import UserService


def sha256_hex(s: str) -> str:
    import hashlib
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class RefreshTokenService:
    @staticmethod
    async def rotate(*, refresh_token: str, db: AsyncSession) -> dict:
        # 1) Validate JWT + claims
        try:
            claims = decode_token(refresh_token)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        if claims.get("type") != "refresh" or not claims.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        user_id = claims["sub"]
        family_id = claims["family_id"]
        jti = claims["jti"]

        # 2) Lookup by hashed token
        token_hash = sha256_hex(refresh_token)
        row = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

        if row is None:
            # token not recognized => invalid
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        now = datetime.now(timezone.utc)
        if row.revoked_at is not None or row.expires_at <= now:
            # Reuse detection: revoke the entire family
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == family_id)
                .values(revoked_at=now)
            )
            await db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

        # 3) Rotate: revoke current token, insert replacement
        new_jti = uuid.uuid4().hex
        raw_new_refresh, new_expires_in = create_refresh_token(
            sub=str(user_id),
            family_id=str(family_id),
            jti=new_jti,
        )
        new_hash = sha256_hex(raw_new_refresh)
        new_expires_at = now + timedelta(seconds=new_expires_in)

        row.revoked_at = now
        row.replaced_by_jti = new_jti

        new_row = RefreshToken(
            user_id=row.user_id,
            family_id=row.family_id,
            jti=new_jti,
            token_hash=new_hash,
            expires_at=new_expires_at,
        )

        db.add(new_row)
        await db.commit()

        # 4) Issue new access token + user profile
        access_token, expires_in = create_access_token(sub=str(row.user_id))
        user = await UserService.get_user_by_id(user_id=row.user_id, db=db)

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": raw_new_refresh,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username,
            },
        }
```

### 5) Endpoint wiring: `POST /auth/refresh`

Suggested endpoint behavior (`apps/api/app/api/v1/endpoints/auth.py`):

```python
@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh(refresh_token=payload.refresh_token, db=db)
```

And in `AuthService`:

```python
class AuthService:
    @staticmethod
    async def refresh(refresh_token: str, db: AsyncSession) -> dict:
        return await RefreshTokenService.rotate(refresh_token=refresh_token, db=db)
```

### 6) Tests to add (Phase 1.5)

Minimum test cases:
- refresh succeeds for valid token -> returns new `access_token` + new `refresh_token`
- old refresh token is rejected after rotation (replay detection)
- expired refresh token rejected

If you add `family_id` reuse detection:
- reuse after revocation revokes entire family (and subsequent tokens fail)

## Auth Hardening Code Samples (Step 1-4)

These samples align with the current codebase and address the active runtime error:

- `ResponseValidationError: refresh_token expected string, got coroutine`
- `RuntimeWarning: coroutine RefreshTokenService.create was never awaited`

### Step 1: Harden `AuthService` and await refresh token creation

File: `apps/api/app/application/services/auth_service.py`

```python
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.account_service import AccountService
from app.application.services.refresh_token_service import RefreshTokenService
from app.application.services.user_service import UserService
from app.core.security import create_access_token, verify_password


class AuthService:
    @staticmethod
    async def login(email: str, password: str, db: AsyncSession):
        email = email.strip().lower()

        account = await AccountService.get_credentials_account_by_email(email=email, db=db)
        if not account or not account.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not verify_password(password, account.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user = await UserService.get_user_by_id(user_id=account.user_id, db=db)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        access_token, expires_in = create_access_token(sub=str(user.id))
        refresh_token = await RefreshTokenService.create(user_id=user.id, db=db)

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username,
            },
        }

    @staticmethod
    async def refresh(refresh_token: str, db: AsyncSession):
        user_id, new_refresh_token = await RefreshTokenService.rotate(raw_token=refresh_token, db=db)
        user = await UserService.get_user_by_id(user_id=user_id, db=db)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        access_token, expires_in = create_access_token(sub=str(user.id))
        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username,
            },
        }

    @staticmethod
    async def logout(refresh_token: str, db: AsyncSession):
        await RefreshTokenService.revoke(raw_token=refresh_token, db=db)
        return None
```

Why:
- Fixes coroutine-not-awaited bug by adding `await`.
- Ensures `refresh_token` in response is a string, not coroutine object.
- Keeps auth failure details generic and safer.

### Step 2: Harden token dependency (`get_current_user`)

File: `apps/api/app/api/deps/auth.py`

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.user_service import UserService
from app.core.security import decode_token
from app.infrastructure.db.session import get_db

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await UserService.get_user_by_id(payload["sub"], db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return user
```

Why:
- Converts decode failures into controlled `401` responses.
- Prevents refresh tokens from being accepted as access tokens.

### Step 3: Clean `RefreshTokenService` imports/time handling

File: `apps/api/app/application/services/refresh_token_service.py`

```python
import datetime
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    generate_refresh_token,
    get_refresh_token_expiry,
    hash_refresh_token,
)
from app.infrastructure.db.models.refresh_token import RefreshToken


class RefreshTokenService:
    @staticmethod
    async def create(user_id: uuid.UUID, db: AsyncSession) -> str:
        raw_token = generate_refresh_token()
        refresh = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=get_refresh_token_expiry(),
        )
        db.add(refresh)
        await db.commit()
        return raw_token

    @staticmethod
    async def rotate(raw_token: str, db: AsyncSession) -> tuple[uuid.UUID, str]:
        token_hash = hash_refresh_token(raw_token)
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored = result.scalar_one_or_none()
        if stored is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        now = datetime.datetime.now(datetime.timezone.utc)
        if stored.revoked_at is not None or stored.expires_at <= now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        stored.revoked_at = now
        new_raw = generate_refresh_token()
        replacement = RefreshToken(
            user_id=stored.user_id,
            token_hash=hash_refresh_token(new_raw),
            expires_at=get_refresh_token_expiry(),
        )
        db.add(replacement)
        await db.commit()
        return stored.user_id, new_raw

    @staticmethod
    async def revoke(raw_token: str, db: AsyncSession) -> None:
        token_hash = hash_refresh_token(raw_token)
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored = result.scalar_one_or_none()
        if stored is None:
            return

        stored.revoked_at = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()
```

Why:
- Removes incorrect imports and uses timezone-aware UTC consistently.
- Keeps refresh failures deterministic and mapped to `401`.

### Step 4: Endpoint contract cleanup

File: `apps/api/app/api/v1/endpoints/auth.py`

```python
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user
from app.application.services.auth_service import AuthService
from app.infrastructure.db.session import get_db
from app.schemas.auth import AuthResponse, AuthUser, LoginRequest, RefreshTokenRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(email=payload.email, password=payload.password, db=db)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh(refresh_token=payload.refresh_token, db=db)


@router.get("/me", response_model=AuthUser)
async def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    await AuthService.logout(refresh_token=payload.refresh_token, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Why:
- Keeps response contracts explicit and consistent for frontend integration.
- Ensures logout has a clear no-body `204` response.
