from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy import update

from app.core.security import hash_refresh_token
from app.infrastructure.db.models.refresh_token import RefreshToken
from app.tests.conftest import TestingSessionLocal


async def _create_credentials_user_and_account(client):
    password = "Password123!"
    payload = {
        "name": "Auth User",
        "username": f"auth_{uuid.uuid4().hex[:8]}",
        "email": f"auth_{uuid.uuid4().hex[:8]}@example.com",
    }
    user_res = await client.post("/api/v1/users", json=payload)
    assert user_res.status_code == 201
    user = user_res.json()

    account_payload = {
        "user_id": user["id"],
        "name": user["name"],
        "image": None,
        "provider": "credentials",
        "provider_account_id": user["email"],
        "password": password,
    }
    account_res = await client.post("/api/v1/accounts", json=account_payload)
    assert account_res.status_code == 201
    return user, password


async def test_login_success_returns_tokens_and_user(client):
    user, password = await _create_credentials_user_and_account(client)
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": password},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["email"] == user["email"]
    assert data["tokens"]["access_token"]
    assert data["tokens"]["refresh_token"]
    assert data["tokens"]["token_type"].lower() == "bearer"


async def test_login_invalid_credentials_returns_401(client):
    user, _password = await _create_credentials_user_and_account(client)
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "wrong-password"},
    )
    assert res.status_code == 401
    assert "Invalid credentials" in res.json()["detail"]


async def test_me_requires_auth_returns_401(client):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401


async def test_me_with_valid_access_token_returns_200(client):
    user, password = await _create_credentials_user_and_account(client)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": password},
    )
    token = login_res.json()["tokens"]["access_token"]

    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["email"] == user["email"]


async def test_refresh_success_rotates_token_and_old_token_replay_fails(client):
    user, password = await _create_credentials_user_and_account(client)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": password},
    )
    old_refresh = login_res.json()["tokens"]["refresh_token"]

    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert refresh_res.status_code == 200
    new_refresh = refresh_res.json()["tokens"]["refresh_token"]
    assert new_refresh != old_refresh

    replay_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert replay_res.status_code == 401


async def test_refresh_expired_token_returns_401(client):
    user, password = await _create_credentials_user_and_account(client)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": password},
    )
    refresh_token = login_res.json()["tokens"]["refresh_token"]
    token_hash = hash_refresh_token(refresh_token)

    async with TestingSessionLocal() as session:
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        await session.commit()

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 401
