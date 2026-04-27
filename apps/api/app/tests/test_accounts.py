# apps/api/app/tests/test_accounts.py
import uuid


async def _create_user(client):
    payload = {
        "name": "Account Owner",
        "username": f"owner_{uuid.uuid4().hex[:8]}",
        "email": f"owner_{uuid.uuid4().hex[:8]}@example.com",
    }
    res = await client.post("/api/v1/users", json=payload)
    assert res.status_code == 201
    return res.json()


async def test_create_account_success(client):
    user = await _create_user(client)

    payload = {
        "user_id": user["id"],
        "name": user["name"],
        "image": None,
        "provider": "github",
        "provider_account_id": f"gh_{uuid.uuid4().hex[:10]}",
    }

    res = await client.post("/api/v1/accounts", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["provider"] == "github"
    assert data["provider_account_id"] == payload["provider_account_id"]


async def test_create_account_duplicate_provider_pair_returns_409(client):
    user = await _create_user(client)
    provider_account_id = f"google_{uuid.uuid4().hex[:10]}"

    payload = {
        "user_id": user["id"],
        "name": user["name"],
        "provider": "google",
        "provider_account_id": provider_account_id,
        "image": None,
    }

    r1 = await client.post("/api/v1/accounts", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/accounts", json=payload)
    assert r2.status_code == 409


async def test_get_account_by_provider_not_found_returns_404(client):
    res = await client.get("/api/v1/accounts/provider/github/not_found_123")
    assert res.status_code == 404