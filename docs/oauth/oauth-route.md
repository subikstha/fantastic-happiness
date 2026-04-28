## OAuth start flow breakdown (`/oauth/{provider}/start`)

```python
@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, request: Request):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid provider")
    client = oauth.create_client(provider)
    redirect_uri = str(request.url_for("oauth_callback", provider=provider))
    return await client.authorize_redirect(request, redirect_uri)
```

### 1) Receives provider in URL

- `/api/v1/auth/oauth/google/start`
- `/api/v1/auth/oauth/github/start`

### 2) Validates provider

- If provider is not `google` or `github`, endpoint returns `400 Invalid provider`.

### 3) Gets OAuth client

- `oauth.create_client(provider)` loads provider config from `app/core/oauth.py`.

### 4) Builds callback URL

- `request.url_for("oauth_callback", provider=provider)` generates callback URL that provider redirects to after consent.

### 5) Redirects browser to provider consent page

- `client.authorize_redirect(request, redirect_uri)` returns HTTP redirect to Google/GitHub authorization page.
- Browser leaves your app and lands on provider login/consent screen.

---

## OAuth callback flow breakdown (`/oauth/{provider}/callback`)

```python
@router.get("/oauth/{provider}/callback", name="oauth_callback", response_model=AuthResponse)
async def oauth_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=400, detail="Unsupported provider")
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    if provider == "google":
        profile = token.get("userinfo") or await client.userinfo(token=token)
        provider_account_id = profile["sub"]
        email = profile.get("email")
        name = profile.get("name") or email
        image = profile.get("picture")
        username = (email or provider_account_id).split("@")[0]
    else:
        resp = await client.get("user", token=token)
        gh = resp.json()
        provider_account_id = str(gh["id"])
        email = gh.get("email")  # may be None
        name = gh.get("name") or gh.get("login") or provider_account_id
        image = gh.get("avatar_url")
        username = gh.get("login") or provider_account_id
    return await AuthService.oauth_sign_in(
        provider=provider,
        provider_account_id=provider_account_id,
        email=email,
        name=name,
        image=image,
        username=username,
        db=db,
    )
```

### 1) Validate provider

- Only `google` and `github` are accepted.
- Any other value returns `400 Unsupported provider`.

### 2) Exchange authorization code for provider token

- `authorize_access_token(request)` reads callback query params (`code`, `state`) and exchanges them with the provider.

### 3) Fetch and normalize provider profile

Google branch:
- Gets OpenID Connect userinfo (`token["userinfo"]` or `client.userinfo(...)`).
- Uses `sub` as `provider_account_id` (stable provider identifier).
- Maps `email`, `name`, `image`, and derives `username`.

GitHub branch:
- Calls provider API `GET /user` with provider token.
- Uses GitHub numeric `id` as `provider_account_id`.
- Maps `email` (can be null), `name`, `avatar_url`, `login`.

### 4) Delegate to service layer (`AuthService.oauth_sign_in`)

- Endpoint sends normalized identity data to service layer.
- Service should:
  - find account by (`provider`, `provider_account_id`)
  - create/link user + account on first sign-in
  - issue API tokens and return `AuthResponse`

### Why this split is useful

- Endpoint handles provider-specific IO/parsing.
- Service owns business rules (linking, creation, token issuance).
- One callback flow supports both first-time and repeat OAuth sign-ins.
