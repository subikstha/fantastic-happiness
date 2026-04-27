# Step Indicator: Users + Accounts Migration Progress

Use this checklist to track implementation progress for the next FastAPI migration slice.

## Phase Status

- Current phase: `Users + Accounts (Read Endpoints)`
- Owner: `You`
- Status: `In Progress`

---

## Checklist

### 1) API Schemas

- [ ] Create `apps/api/app/schemas/user.py` (`UserRead`)
- [ ] Create `apps/api/app/schemas/account.py` (`AccountRead`)
- [ ] Confirm `model_config = {"from_attributes": True}` in both

### 2) Users Endpoint

- [ ] Create `apps/api/app/api/v1/endpoints/users.py`
- [ ] Implement `GET /api/v1/users/{user_id}`
- [ ] Return `404` when user not found

### 3) Accounts Endpoint

- [ ] Create `apps/api/app/api/v1/endpoints/accounts.py`
- [ ] Implement `GET /api/v1/accounts/provider/{provider}/{provider_account_id}`
- [ ] Return `404` when account not found

### 4) Router Integration

- [ ] Register users router in `apps/api/app/api/v1/router.py`
- [ ] Register accounts router in `apps/api/app/api/v1/router.py`

### 5) Verification

- [ ] Confirm app boots without import/session errors
- [ ] Validate endpoint paths in `/docs`
- [ ] Manually test `users` endpoint
- [ ] Manually test `accounts` endpoint

### 6) Integration Handoff

- [ ] Update web API client to use FastAPI for migrated calls
- [ ] Keep non-migrated server actions untouched
- [ ] Record findings/notes in docs

---

## Notes / Blockers

- Add notes here as you progress (errors, resolutions, decisions).

