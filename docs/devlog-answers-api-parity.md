# Devlog: FastAPI answers — list endpoint, Mongoose parity, and empty `answers` list

Newest context first. This records completed work in `apps/api` around answers: `GET /answers/all`, `AnswerService.get_answers` / `create`, denormalized `questions.answers`, tests, and **why callers sometimes saw an empty `answers` array** and how that was addressed.

---

## 2026-05-11 — Answers API parity and troubleshooting the empty list

### What we completed

1. **`AnswerService.get_answers`** ([`apps/api/app/application/services/answer_service.py`](../apps/api/app/application/services/answer_service.py))  
   - Matches Next [`getAnswers`](../apps/web/lib/actions/answer.action.ts) sort semantics: `latest` and default → newest first by `created_at`; `oldest` → ascending; `popular` → **`upvotes` descending only** (no secondary sort, per Mongoose).  
   - Pagination and `isNext` / `totalAnswers` unchanged in meaning (`totalAnswers` is a full count for that `question_id`; `isNext` matches `total > skip + len(page)`).

2. **`AnswerService.create`**  
   - Loads the parent **`Question`** by `payload.question_id`. If missing, raises `AnswerConflictError("Question not found")` before insert (endpoint maps this to **404**).  
   - Increments denormalized **`question.answers`** by 1 in the **same transaction** as inserting the `Answer` row, so question cards and list UIs that read `Question.answers` stay in sync with Postgres.

3. **`GET /api/v1/answers/all`** ([`apps/api/app/api/v1/endpoints/answer.py`](../apps/api/app/api/v1/endpoints/answer.py))  
   - Public query params: `question_id` (required UUID), `page`, `page_size`, `filter`.  
   - Static route `/all` is declared before any future dynamic `/{id}` routes to avoid Starlette routing pitfalls (same pattern as questions).

4. **Tests** ([`apps/api/app/tests/test_answer_service.py`](../apps/api/app/tests/test_answer_service.py), [`test_answer_endpoint.py`](../apps/api/app/tests/test_answer_endpoint.py))  
   - Service tests for pagination, `latest` vs default filter, `popular`, create counter bump, missing-question error.  
   - HTTP smoke test for `GET /answers/all` (requires `TEST_DATABASE_URL` / Postgres).

5. **ORM / migrations (earlier in same effort)**  
   - `Answer` model includes `created_at` / `updated_at` for meaningful `latest` / `oldest` ordering; Alembic migration adds those columns if not already applied.

---

### Why an empty `answers` list happened (root causes)

The API was behaving correctly once inputs and data stores were aligned. Typical causes:

| Cause | Explanation |
|--------|----------------|
| **Postgres had no rows for that `question_id`** | `get_answers` filters strictly on `Answer.question_id == question_id`. If answers only existed in **MongoDB** (legacy `getAnswers` / Mongoose) and not in Postgres, the FastAPI response was legitimately `answers: []` and `totalAnswers: 0`. |
| **Wrong UUID on `GET`** | Using a different id than the Postgres question primary key (e.g. answer id, or a Mongo-only id) yields no matching `answers` rows. |
| **Swagger / client mismatch** | Create body must use **`question_id`** (and path `POST /api/v1/answers`). The Next client historically used **`questionId`** and **`/answers/create`**; mis-copied payloads or wrong paths meant no successful insert into Postgres, so subsequent `GET` stayed empty. |
| **Pagination** | `totalAnswers > 0` but `answers: []` on a **high `page`** value means “empty page,” not “no data globally.” |

---

### How the problem was solved (what we changed vs what we documented)

**Code / behavior**

- **Single source of truth in Postgres:** Listing is implemented only against SQLAlchemy `Answer` rows tied to `question_id`. That removes ambiguity once clients call this API with the same UUIDs used at create time.  
- **Create path updates the question:** Incrementing `questions.answers` avoids “I posted an answer but the question still shows 0 replies” when the UI reads the denormalized column.  
- **Explicit 404 when the question does not exist:** Fails fast instead of relying on a deferred FK error after a confusing partial state.  
- **Parity with `getAnswers` sorting:** Reduces surprises when the web app is later switched from Mongoose reads to this endpoint.

**Operational / integration**

- Callers should pass **`question_id`** on `GET /answers/all` equal to the **`question_id` sent in the create body** (or the `question` field in the create response, depending on serialization).  
- Ensure **`alembic upgrade head`** so `answers` has timestamp columns used for ordering.  
- When comparing with the old stack, remember **Mongo vs Postgres** until `getAnswers` in Next is migrated to FastAPI.

---

### How to verify

```bash
cd apps/api
uv run alembic upgrade head
uv run pytest app/tests/test_answer_service.py app/tests/test_answer_endpoint.py -v
```

Manual Swagger flow:

1. Authorize, `POST /api/v1/answers` with `{"question_id": "<existing-question-uuid>", "content": "..."}` → **201**.  
2. `GET /api/v1/answers/all?question_id=<same-uuid>&page=1&page_size=10` → non-empty `answers` when `totalAnswers >= 1`.  
3. In SQL: `SELECT answers FROM questions WHERE id = '<uuid>';` increments after each successful create.

---

### Files touched (primary)

- [`apps/api/app/application/services/answer_service.py`](../apps/api/app/application/services/answer_service.py)  
- [`apps/api/app/api/v1/endpoints/answer.py`](../apps/api/app/api/v1/endpoints/answer.py)  
- [`apps/api/app/schemas/answer.py`](../apps/api/app/schemas/answer.py) (read models / create shape as evolved)  
- [`apps/api/app/infrastructure/db/models/answer.py`](../apps/api/app/infrastructure/db/models/answer.py)  
- [`apps/api/app/tests/test_answer_service.py`](../apps/api/app/tests/test_answer_service.py)  
- [`apps/api/app/tests/test_answer_endpoint.py`](../apps/api/app/tests/test_answer_endpoint.py)  

Optional follow-up (not required for the empty-list fix): align [`apps/web/lib/api.ts`](../apps/web/lib/api.ts) `answers.create` path and JSON keys with the FastAPI contract so the browser and Swagger stay consistent.
