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
- Credentials input validation includes:
  - password required for `provider="credentials"`
  - bcrypt byte-length guard (`<= 72` bytes)
- Dependency compatibility fix applied: `bcrypt` pinned below `5`.

### Still Pending To Finish Phase 1

- Implement `AuthService.refresh(...)` and complete `/api/v1/auth/refresh`.
- Replace placeholder refresh token value in login response.
- Add robust invalid-token handling path in `get_current_user` (map decode failures to `401`).
- Add `app/tests/test_auth.py` coverage for login + `/auth/me` scenarios.
- Remove sensitive login debug logging and return production-safe auth error details.

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
