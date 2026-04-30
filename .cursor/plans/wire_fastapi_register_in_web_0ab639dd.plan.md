---
name: Wire FastAPI Register in Web
overview: Adapt Next.js server-action auth registration to consume FastAPI /auth/register while preserving the frontend ActionResponse contract and surfacing backend error details.
todos:
  - id: align-register-api-contract
    content: Update api.auth.register URL + return contract to match FastAPI register and frontend ActionResponse expectations
    status: completed
  - id: improve-fetch-error-mapping
    content: Parse FastAPI error detail in fetch handler and map status/message/details consistently
    status: completed
  - id: fix-signup-server-action
    content: Update signUpWithCredentials to handle ActionResponse contract correctly and remove generic throw path
    status: completed
  - id: validate-types-and-flows
    content: Confirm FastApiAuthResponse typing and verify success/409/422 scenarios from frontend
    status: completed
isProject: false
---

# FastAPI Register Integration Plan

## Goal

Use FastAPI `POST /api/v1/auth/register` from the Next.js sign-up server action, while keeping FastAPI responses domain-native (`tokens + user`) and adapting them into frontend `ActionResponse<T>` consistently.

## Files to update

- [apps/web/lib/api.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/lib/api.ts)
- [apps/web/lib/handlers/fetch.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/lib/handlers/fetch.ts)
- [apps/web/lib/actions/auth.action.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/lib/actions/auth.action.ts)
- [apps/web/types/api.d.ts](/home/subikstha/projects/python/jsmasterypro_devflow/apps/web/types/api.d.ts) (confirm/extend `FastApiAuthResponse` only if needed)

## Implementation steps

1. Normalize the register API boundary in `api.ts`.
  - Ensure register points to FastAPI v1 path correctly (base URL strategy + `/auth/register` path composition).
  - Make `api.auth.register` return an `ActionResponse<FastApiAuthResponse>` (or consistently throw on error and adapt in server action; pick one pattern and use it consistently).
2. Fix `fetchHandler` error parsing so FastAPI errors are meaningful.
  - On non-OK responses, parse JSON error body and map FastAPI `detail` into message/details.
  - Preserve status code and shape compatible with existing `handleError` + `RequestError` flow.
  - Avoid unsafe casts that treat raw FastAPI success JSON as already-wrapped `ActionResponse`.
3. Correct sign-up server action flow in `auth.action.ts`.
  - Replace truthy check (`if (!registerResponse)`) with explicit contract check (`success` handling).
  - Return failure response directly (with status/message) instead of throwing generic `Failed to register user`.
  - Return success with `data` from FastAPI auth payload for downstream use.
4. Verify typing alignment.
  - Ensure `FastApiAuthResponse` matches backend `AuthResponse` (`tokens`, `user`) and is used as the `data` payload type.
  - Ensure function signatures in `api.ts` and `auth.action.ts` match actual runtime behavior.
5. Validate behavior manually.
  - Success case: new user returns success response with tokens/user.
  - Conflict case: duplicate email/username returns `success: false` with status `409` and readable message.
  - Validation case: malformed payload returns `success: false` with status `422` and details.

## Expected outcome

- Sign-up from Next.js uses FastAPI register endpoint reliably.
- Frontend receives stable `ActionResponse` shape.
- Error messaging in UI reflects backend reason (not generic HTTP code only).

