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

### Register integration status (implemented)

The register bridge is now implemented in the web layer with the adapter pattern above:

- `api.auth.register` calls FastAPI register (`/auth/register` under `FASTAPI_BASE_URL`) and returns `ActionResponse<FastApiAuthResponse>`.
- Success mapping: raw FastAPI `AuthResponse` (`tokens + user`) is wrapped as `{ success: true, data, status }`.
- Error mapping: non-2xx responses are wrapped as `{ success: false, error, status }`.

Related implementation files:

- `apps/web/lib/api.ts`
- `apps/web/lib/actions/auth.action.ts`
- `apps/web/lib/handlers/fetch.ts`

### Error handling behavior (implemented)

`fetchHandler` now parses FastAPI error payloads and preserves useful UI messages:

- If backend returns `{"detail": "Email already in use"}`, frontend error message becomes `Email already in use`.
- If backend returns validation errors (`detail` array, typical `422`), they are mapped into `error.details` field map.
- Fallback remains `HTTP Error: <status>` when response is not JSON.

This prevents generic registration failures and lets the UI show actionable errors for `409` conflict and `422` validation cases.

### Credentials sign-in ownership (implemented)

Credentials sign-in now has a single verification source:

- `apps/web/auth.ts` (`Credentials.authorize`) calls `api.auth.login(email, password)` to validate credentials against FastAPI.
- On success, `authorize` returns the normalized user object to NextAuth.
- `jwt` callback sets `token.sub` directly from `user.id` for credentials sign-ins, avoiding legacy account lookups.

`signInWithCredentials` in `apps/web/lib/actions/auth.action.ts` is now orchestration-only:

- validates input
- calls `signIn('credentials', { email, password, redirect: false })`
- returns normalized `ActionResponse`

This removes duplicate `/auth/login` calls and keeps sign-in responsibility centralized in NextAuth `authorize`.

### NextAuth `jwt` and `session` callbacks (why both are needed)

When using NextAuth JWT sessions, the identity usually flows through two steps:

1. Write canonical identity into the token (`jwt` callback).
2. Expose that identity on the app-facing session (`session` callback).

#### Current code shape

```ts
callbacks: {
  async session({ session, token }) {
    session.user.id = token.sub as string;
    return session;
  },
  async jwt({ token, account, user }) {
    if (user?.id) {
      token.sub = user.id;
    }

    if (account && account.type !== 'credentials') {
      const { data: existingAccount, success } =
        (await api.accounts.getByProvider(account.providerAccountId)) as ActionResponse<IAccountDoc>;

      if (!success || !existingAccount) return token;

      const userId = existingAccount.userId;
      if (userId) token.sub = userId.toString();
    }

    return token;
  },
}
```

#### What `jwt` callback is doing

- Runs during sign-in and later token/session checks.
- `token` is the persisted auth payload.
- `token.sub` is the standard JWT **subject** claim (the canonical user identity).
- On credentials sign-in, `user.id` is available from `authorize`, so `token.sub = user.id`.
- On OAuth sign-in, account linking resolves provider account to internal user id and sets `token.sub` to that id.

Result: both credentials and OAuth converge to one internal identity (`token.sub`).

#### What `session` callback is doing

- Shapes the session object returned by `auth()` / `useSession()`.
- Copies `token.sub` into `session.user.id` so app code has a stable internal user id.
- Without this copy, app code might only see name/email/image and lack the DB user id.

#### Why assign both?

- `token.sub = user.id` in `jwt` persists identity in the token layer.
- `session.user.id = token.sub` in `session` exposes that persisted identity in the session layer.

Together they make identity available consistently to UI/components/server actions.

### Access token refresh lifecycle (completed)

The credentials flow now includes token lifecycle handling in `auth.ts`:

- At sign-in, FastAPI returns `access_token`, `refresh_token`, and `expires_in`.
- NextAuth stores these token values in the JWT callback payload (server-side token state).
- The JWT callback should check whether the **access token** is expired.
  - If still valid, keep current token state.
  - If expired, call FastAPI `POST /auth/refresh` with the stored refresh token.
- On refresh success, update:
  - `accessToken`
  - `accessTokenExpiresAt` (absolute timestamp)
  - `refreshToken` (use rotated value if returned)
- On refresh failure (expired/invalid refresh token), mark an error on token/session and require re-authentication.

Important clarification:

- Access token refresh is triggered when the **access token expires**.
- If the **refresh token** is expired, refresh will fail; no new access token can be issued.

Security note:

- Keep `refreshToken` server-side in JWT state.
- Do not expose `refreshToken` on `session.user`; expose access token only if client-side API calls require it.

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
