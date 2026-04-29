# NextAuth flow in `apps/web` (and FastAPI credentials migration)

This document describes how authentication is wired in the Next.js app (`apps/web/auth.ts`), how it relates to `lib/api.ts`, and how credential login can be replaced by the FastAPI `/auth/login` flow without changing OAuth behavior in the same step.

## How `apps/web/auth.ts` works today

### Providers

NextAuth is configured with:

- GitHub
- Google
- A **Credentials** provider

### Credentials provider (`authorize`)

1. Validates input with `SignInSchema`.
2. Loads the account via **`api.accounts.getByProvider(email)`** — this calls the **Next.js API** (see `NEXT_PUBLIC_API_BASE_URL` in `lib/api.ts`, which defaults to `http://localhost:3000/api`).
3. Loads the user with **`api.users.getById`**.
4. Verifies the password **in Node** with **`bcrypt.compare`** against `existingAccount.password`.

Credential sign-in is therefore: **Next.js route handlers + account/user fetches + local bcrypt**. It does **not** call FastAPI.

### JWT callback

After sign-in, the callback calls `api.accounts.getByProvider(...)` and sets `token.sub` to the linked `userId` so the session user id matches the application database.

### OAuth `signIn` callback

For non-credentials providers, it calls **`api.auth.oAuthSignIn`** on the Next API to create or link the OAuth account.

For **credentials**, `signIn` returns `true` immediately because account linking and password verification already happened inside `authorize`.

## Replacing credentials with FastAPI login

You can keep NextAuth for session UX and replace only the credentials path so it delegates to FastAPI.

### Response contract decision (FastAPI vs Next.js shape)

During migration, keep response responsibilities separated:

- **FastAPI API responses** should stay domain-oriented and HTTP-native (for auth: `AuthResponse` = `tokens + user`, plus proper HTTP status codes and error `detail`).
- **Next.js Server Actions responses** should stay UI-oriented (`ActionResponse<T>` with `success`, `data`, `error`, `status`).

This means Server Actions are the adapter layer:

1. Call FastAPI.
2. On success (`2xx`), map FastAPI JSON to `ActionResponse<T>` success shape.
3. On failure (`4xx/5xx`), map backend error payload (for example `detail`) into `ActionResponse<T>` error shape.

Why this decision:

- avoids coupling FastAPI contracts to one frontend's internal response wrapper
- keeps FastAPI reusable for other clients (CLI/mobile/other web apps)
- gives the Next.js UI a single predictable `ActionResponse` contract across actions

### Conceptual change

Stop doing “fetch account + bcrypt in Next” and instead **POST to FastAPI** (for example `POST /api/v1/auth/login` with `{ email, password }`), then use the JSON response (`tokens` + `user`) to drive NextAuth.

### Typical implementation shape

1. **`authorize`**
   - Call FastAPI login (server-side from NextAuth; CORS is not required for this hop).
   - On `401` or failure, return `null`.
   - On success, return a user object NextAuth expects, for example `{ id, name, email, image }` (use string ids if your session types expect strings).

2. **Access and refresh tokens**
   - FastAPI returns an access token and a rotating refresh token.
   - NextAuth’s Credentials flow does not store these automatically.
   - Usually: in the **`jwt` callback**, on first sign-in when `user` is present, copy `access_token` / `refresh_token` onto the token payload; in the **`session` callback**, expose what the client needs (often the access token for `Authorization: Bearer` calls to FastAPI).
   - Extend TypeScript types (`Session`, `JWT`) if you add custom fields.

3. **JWT callback and `token.sub`**
   - If `authorize` already returns the canonical **user id** from FastAPI, you can set `token.sub` from that user object and reduce or remove the extra `getByProvider` round-trip for credential sign-ins. Keep OAuth-specific logic aligned with however you migrate OAuth next.

4. **Base URL**
   - Point auth requests at **FastAPI** (for example `http://localhost:8000`) unless Next.js proxies `/api/v1`. Prefer a dedicated setting (for example `FASTAPI_URL`) so credential login does not accidentally hit `localhost:3000/api`.

5. **Browser vs server**
   - `authorize` runs on the **server** in NextAuth, so the login request to FastAPI is server-to-server. If you later call FastAPI login from the browser directly, CORS and cookie rules apply.

6. **OAuth**
   - The same `auth.ts` file may still use **`api.auth.oAuthSignIn`** on the Next API for GitHub/Google until you switch the frontend to FastAPI’s OAuth routes and adjust redirects and callbacks.

### Summary table

| Piece | Current behavior | After switching credentials to FastAPI |
|--------|------------------|----------------------------------------|
| Password verification | `bcrypt.compare` in Next `authorize` | FastAPI `/auth/login` |
| User / account loading | `api.accounts` / `api.users` (Next API) | User (and tokens) from FastAPI response |
| Calling protected FastAPI routes | Depends on existing app pattern | Typically `Authorization: Bearer <access_token>` from session (or your chosen token storage pattern) |

## Related files

- `apps/web/auth.ts` — NextAuth configuration
- `apps/web/lib/api.ts` — `API_BASE_URL` and REST helpers used by auth callbacks
- `docs/authentication-migration-plan.md` — broader FastAPI auth migration plan
- `docs/oauth/oauth-route.md` — FastAPI OAuth start/callback routes
