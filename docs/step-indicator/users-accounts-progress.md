# Step Indicator: Users + Accounts Migration Progress

Use this checklist to track implementation progress for the next FastAPI migration slice.

## Phase Status

- Current phase: `Users + Accounts (Read + Create Endpoints)`
- Owner: `You`
- Status: `Completed`

---

## Checklist

### 1) API Schemas

- [x] Create `apps/api/app/schemas/user.py` (`UserRead`)
- [x] Create `apps/api/app/schemas/account.py` (`AccountRead`)
- [x] Confirm `model_config = {"from_attributes": True}` in both
- [x] Add create payload schemas (`UserCreate`, `AccountCreate`)

### 2) Users Endpoint

- [x] Create `apps/api/app/api/v1/endpoints/users.py`
- [x] Implement `GET /api/v1/users/{user_id}`
- [x] Return `404` when user not found
- [x] Implement `POST /api/v1/users` with `409` conflict mapping

### 3) Accounts Endpoint

- [x] Create `apps/api/app/api/v1/endpoints/accounts.py`
- [x] Implement `GET /api/v1/accounts/provider/{provider}/{provider_account_id}`
- [x] Return `404` when account not found
- [x] Implement `POST /api/v1/accounts` with uniqueness conflict handling

### 4) Router Integration

- [x] Register users router in `apps/api/app/api/v1/router.py`
- [x] Register accounts router in `apps/api/app/api/v1/router.py`

### 5) Verification

- [x] Confirm app boots without import/session errors
- [x] Validate endpoint paths in `/docs`
- [x] Manually test `users` endpoint
- [x] Manually test `accounts` endpoint
- [x] Add pytest coverage for users/accounts flows (`test_users.py`, `test_accounts.py`)

### 6) Integration Handoff

- [ ] Update web API client to use FastAPI for migrated calls
- [x] Keep non-migrated server actions untouched
- [x] Record findings/notes in docs

---

## Notes / Blockers

- Completed users/accounts CRUD slice needed for auth bootstrap.
- Password hashing now applied during account creation for credentials accounts.
- Next active slice is authentication hardening and OAuth migration.

