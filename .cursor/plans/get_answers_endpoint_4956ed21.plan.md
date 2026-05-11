---
name: GET answers endpoint
overview: Add a public GET handler on the answers router that accepts `question_id` plus pagination/sort query params, delegates to `AnswerService.get_answers`, and returns `AnswerRead`—mirroring how questions expose `GET /questions/all`.
todos:
  - id: endpoint-get-all
    content: Add GET /all on answer router with Query(question_id, page, page_size, filter), response_model=AnswerRead, call AnswerService.get_answers
    status: completed
  - id: test-http
    content: Add pytest hitting GET /api/v1/answers/all with seeded data (when TEST_DATABASE_URL available)
    status: completed
isProject: false
---

# Add GET endpoint for paginated answers

## Context

- `[AnswerService.get_answers](apps/api/app/application/services/answer_service.py)` already returns a dict shaped like `[AnswerRead](apps/api/app/schemas/answer.py)`: `answers`, `isNext`, `totalAnswers`.
- `[answer.py](apps/api/app/api/v1/endpoints/answer.py)` currently only defines `POST ""` (create). No list route yet.
- Reference style: `[question.py](apps/api/app/api/v1/endpoints/question.py)` uses `GET /all` with `Query` params, no auth, `response_model=QuestionRead`.

## Route design

Add `**GET /answers/all**` (under the existing `prefix="/answers"`, so full path matches the questions convention: `/questions/all` vs `/answers/all`).

**Query parameters** (align with service and web `getAnswers` filters):


| Param         | Type   | Default  | Notes                                             |
| ------------- | ------ | -------- | ------------------------------------------------- |
| `question_id` | `UUID` | required | `Query(..., description="...")`                   |
| `page`        | `int`  | `1`      | `Query(1, ge=1)`                                  |
| `page_size`   | `int`  | `10`     | `Query(10, ge=1, le=100)` (same cap as questions) |
| `filter`      | `str   | None`    | `None` or `"latest"`                              |


Handler body:

```python
return await AnswerService.get_answers(
    db=db,
    question_id=question_id,
    page=page,
    page_size=page_size,
    filter=filter,
)
```

## File changes

1. `**[apps/api/app/api/v1/endpoints/answer.py](apps/api/app/api/v1/endpoints/answer.py)**`
  - Import `Query` from FastAPI and `UUID` from `uuid`.
  - Import `AnswerRead` from `app.schemas.answer`.
  - Add a short module comment (like `question.py`): if you later add dynamic routes such as `GET /{answer_id}`, keep **static paths like `/all` above** dynamic ones.
  - Register `**@router.get("/all", response_model=AnswerRead)`** **before** any future `/{id}` routes (today only `POST ""` exists, so order is already safe once `/all` is added above the post if you reorder, or keep `GET /all` then `POST ""`—both are static).
  - **No auth dependency** for read listing (same as `GET /questions/all`), unless you explicitly want private questions later.
2. **Tests (recommended)**
  In `[apps/api/app/tests/](apps/api/app/tests/)`, add an HTTP-level test (httpx `AsyncClient`) hitting `GET /api/v1/answers/all?question_id=...` after seeding user/question/answers in the test DB, asserting status `200` and JSON keys `answers`, `isNext`, `totalAnswers`. Reuse patterns from `[test_answer_service.py](apps/api/app/tests/test_answer_service.py)` / `[test_users.py](apps/api/app/tests/test_users.py)` (requires Postgres for existing test harness).

## Optional follow-up (not required for this task)

- Add `api.answers.getAll(...)` in `[apps/web/lib/api.ts](apps/web/lib/api.ts)` and switch `[getAnswers](apps/web/lib/actions/answer.action.ts)` to FastAPI when you are ready to drop Mongoose for reads.

