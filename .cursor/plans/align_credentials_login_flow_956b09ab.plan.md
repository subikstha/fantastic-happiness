---
name: Align Credentials Login Flow
overview: Migrate the NextAuth credentials path to FastAPI and remove duplicated login checks from server actions so sign-in has a single source of truth.
todos:
  - id: switch-authorize-to-fastapi-login
    content: Replace credentials authorize logic in auth.ts with FastAPI login response mapping
    status: completed
  - id: clean-jwt-credentials-branch
    content: Update jwt callback to avoid legacy account lookup dependency for credentials sign-in
    status: completed
  - id: simplify-signin-server-action
    content: Remove duplicate api.auth.login precheck from signInWithCredentials and rely on signIn('credentials')
    status: completed
  - id: verify-auth-flow-manually
    content: Test sign-in/sign-up paths and confirm no duplicate login requests or regressions
    status: completed
  - id: document-final-ownership
    content: Update docs/nextauth-web-auth-flow.md to reflect final credentials sign-in responsibility
    status: completed
isProject: false
---

# Plan: Align NextAuth Credentials with FastAPI

## Goal

Make credentials login flow consistent by using FastAPI for credential verification inside NextAuth `authorize`, and simplifying server actions to avoid duplicate `/auth/login` calls.

## Files to update

- [apps/web/auth.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/auth.ts)
- [apps/web/lib/actions/auth.action.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/lib/actions/auth.action.ts)
- [apps/web/lib/api.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/lib/api.ts) (only if helper types/return shape need minor alignment)
- [docs/nextauth-web-auth-flow.md](/home/subikstha/projects/python/jsmasterypro_devflow/docs/nextauth-web-auth-flow.md) (document final sign-in responsibility)

## Implementation steps

1. Update credentials `authorize` in `auth.ts` to call FastAPI login via `api.auth.login(email, password)` and return user from that response.
  - Remove Mongo/account lookup + local `bcrypt.compare` flow from `authorize`.
  - Remove now-unused imports tied to old flow (`bcryptjs`, `IAccountDoc`, `IUserDoc`) if no longer needed.
2. Adjust `jwt` callback in `auth.ts` to avoid old account lookup dependency for credentials.
  - Set `token.sub` from `user.id` when credentials login succeeds.
  - Keep current OAuth handling logic, but avoid forcing credentials path through `api.accounts.getByProvider`.
3. Simplify `signInWithCredentials` in `auth.action.ts`.
  - Remove the pre-flight `api.auth.login` call.
  - Use `signIn('credentials', { email, password, redirect: false })` as the single sign-in trigger.
  - Return a normalized `ActionResponse` success/error payload without duplicate backend auth calls.
4. Keep `signUpWithCredentials` behavior as register-then-signIn.
  - Preserve `api.auth.register` + `signIn('credentials')` sequence.
  - Ensure error passthrough stays consistent with current `ActionResponse` contract.
5. Validate end-to-end behavior.
  - Sign-in success creates session.
  - Wrong password returns clean error once (no duplicate `/auth/login` calls).
  - Sign-up still creates account then signs in.

## Expected outcome

- Credentials auth has one verification source (FastAPI via NextAuth `authorize`).
- No duplicated login requests from server action + NextAuth.
- Cleaner `auth.ts` with reduced legacy Mongo coupling.
- Server action responses remain consistent with frontend `ActionResponse` handling.

