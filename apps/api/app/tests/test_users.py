import uuid

async def test_create_user_success(client):
    payload = {
        "name": "Jane Doe",
        "username": f"jane_{uuid.uuid4().hex[:8]}",
        "email": f"jane_{uuid.uuid4().hex[:8]}@example.com",
        "password": "password123",
    }

    res = await client.post("/api/v1/users", json=payload)
    assert res.status_code == 201

    data = res.json()
    assert data["name"] == payload["name"]
    assert data["username"] == payload["username"]
    assert data["email"] == payload["email"]

async def test_create_user_duplicate_email_returns_409(client):
    email = f"jane_{uuid.uuid4().hex[:8]}@example.com"

    payload1 = {"name": "A", "username": f"user_{uuid.uuid4().hex[:8]}", "email": email}
    payload2 = {"name": "B", "username": f"user_{uuid.uuid4().hex[:8]}", "email": email}

    r1 = await client.post("/api/v1/users", json=payload1)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/users", json=payload2)
    assert r2.status_code == 409
    assert "Email" in r2.json()["detail"]

async def test_get_user_not_found_returns_404(client):
    missing_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/users/{missing_id}")
    assert res.status_code == 404