# OAuth start fails without `SessionMiddleware`

When using Authlib’s Starlette/FastAPI client (`authorize_redirect` on `/auth/oauth/{provider}/start`), the app may crash with an assertion if server-side sessions are not enabled.

## Symptom

Hitting **`GET /api/v1/auth/oauth/{provider}/start`** (or your mounted equivalent) raises:

```text
AssertionError: SessionMiddleware must be installed to access request.session
```

Typical stack trace (abbreviated):

```text
File ".../auth.py", line ..., in oauth_start
  return await client.authorize_redirect(request, redirect_uri)
File ".../authlib/integrations/starlette_client/apps.py", in authorize_redirect
  await self.save_authorize_data(request, redirect_uri=redirect_uri, **rv)
File ".../authlib/integrations/starlette_client/apps.py", in save_authorize_data
  await self.framework.set_state_data(request.session, state, kwargs)
File ".../starlette/requests.py", line ..., in session
  assert "session" in self.scope, "SessionMiddleware must be installed to access request.session"
```

## Cause

OAuth 2 / OIDC authorization flows use a **`state`** parameter to mitigate CSRF and to correlate the redirect back to the correct in-flight request. Authlib’s Starlette integration persists that state (and related authorize metadata) using **`request.session`**.

In Starlette, **`request.session` exists only when `SessionMiddleware` is installed** on the application. If it is missing, any code path that touches `request.session` triggers the assertion above.

So the failure is not specific to Google or GitHub; it is **any** `authorize_redirect` that uses the default session-backed storage.

## Python dependency: `itsdangerous`

Starlette’s **`SessionMiddleware`** signs the session cookie using **`itsdangerous`**. That package is **not** always pulled in by a minimal FastAPI install, so importing `SessionMiddleware` can fail with:

```text
ModuleNotFoundError: No module named 'itsdangerous'
```

**Fix:** declare it in the API project (this repo already lists it in **`apps/api/pyproject.toml`**). If you set up a fresh environment:

```bash
cd apps/api && uv add itsdangerous
```

Without this module installed, the app will crash on startup as soon as `main.py` imports `SessionMiddleware`, before any OAuth request runs.

## Relation to the rest of the stack

- **FastAPI** builds on **Starlette**; middleware is added on the same app instance.
- **CORS** alone does not provide sessions; **`SessionMiddleware`** must be added explicitly (with a signing secret) if you rely on Authlib’s default behavior.

## Fix (conceptual)

1. Register Starlette’s **`SessionMiddleware`** on the FastAPI app with a strong **`secret_key`** (commonly from settings / environment, separate from other secrets in production).
2. Use appropriate cookie options for your environment (for example `same_site`, and `https_only` when serving over HTTPS).
3. Remember that the OAuth **`state`** is tied to the **session cookie**: the client that opens `/start` must accept and send cookies on the subsequent callback (normal browser flow; some API clients need extra care).

For route-level details of start/callback, see **`docs/oauth/oauth-route.md`**.

## Related code (reference)

- OAuth start uses `client.authorize_redirect` → session storage inside Authlib.
- App middleware is typically configured in **`apps/api/app/main.py`** (ensure `SessionMiddleware` is present if you use this Authlib integration).
