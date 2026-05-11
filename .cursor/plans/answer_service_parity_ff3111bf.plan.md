---
name: Answer service parity
overview: Match `getAnswers` behavior from [`answer.action.ts`](apps/web/lib/actions/answer.action.ts) inside [`AnswerService.get_answers`](apps/api/app/application/services/answer_service.py), and increment the denormalized `questions.answers` counter when creating an answer in the same DB transaction.
todos:
  - id: get-answers-parity
    content: Align get_answers popular sort to upvotes.desc() only; optionally explicit latest branch
    status: completed
  - id: increment-question-answers
    content: "In AnswerService.create: load Question, increment answers, single commit; raise if question missing"
    status: completed
  - id: tests-parity-count
    content: Update/add tests for popular order and question.answers after create
    status: completed
isProject: false
---

# Parity: `getAnswers` logic + question answer count on create

## Reference: Next `getAnswers`

From `[apps/web/lib/actions/answer.action.ts](apps/web/lib/actions/answer.action.ts)` (lines 111–142):

- **Pagination:** `skip = (Number(page) - 1) * pageSize`, `limit = pageSize` (maps to API `page` / `page_size` already).
- **Filter → sort:**
  - `latest` → `createdAt: -1` (newest first)
  - `oldest` → `createdAt: 1`
  - `popular` → `**upvotes: -1` only** (no secondary key in Mongoose)
  - **default** (missing / other) → same as latest: `createdAt: -1`
- **Total:** `countDocuments({ question: questionId })` → API already uses `func.count()` on `Answer.question_id == question_id`.
- `**isNext`:** `totalAnswers > answers.length + skip` → equivalent to API `total > skip + len(items)` when `items` is the current page length.

## Gap vs current `[AnswerService.get_answers](apps/api/app/application/services/answer_service.py)`


| Area                     | Mongoose                | Current API                                             | Change                                                                                                            |
| ------------------------ | ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `latest`                 | explicit branch         | default branch handles empty + unknown                  | Optionally add explicit `if f == "latest":` mirroring `question.py` style; behavior already matches.              |
| `popular`                | **only** `upvotes` desc | `upvotes.desc()` **then** `created_at.desc()` tie-break | Remove tie-break so ordering matches Mongoose (stable order may differ for equal upvotes; acceptable for parity). |
| default / unknown filter | `createdAt: -1`         | `created_at.desc()`                                     | Already aligned.                                                                                                  |


No change needed to response shape beyond what you already return; optional: normalize `filter` so only the four cases above are documented (same strings as web: `latest`, `oldest`, `popular`).

## Increment `questions.answers` on create

`[Question](apps/api/app/infrastructure/db/models/question.py)` has denormalized `answers: Mapped[int]` (line 27). `[AnswerService.create](apps/api/app/application/services/answer_service.py)` inserts an `Answer` but never updates this column, so list UIs that read `Question.answers` stay stale.

**Implementation (in `create`):**

1. Import `Question` from `app.infrastructure.db.models.question` (or package `models` if that is your pattern).
2. In the **same** `AsyncSession` before `commit`:
  - `select(Question).where(Question.id == payload.question_id)` → `scalar_one_or_none()`.
  - If `None`, raise a clear domain error (e.g. extend `AnswerConflictError` or `HTTPException` at endpoint layer after service raises)—same as FK would eventually enforce, but fail fast with a readable message.
  - Else `question.answers += 1` (or use `UPDATE ... SET answers = answers + 1` if you prefer avoiding a race; single-transaction increment on loaded row is enough for typical dev parity with Mongoose).
3. `db.add(answer)` then bump question (or flush order: add answer, load question, bump, `await db.commit()`), then `await db.refresh(answer)` as today.

**Transaction:** keep a single `commit()` so answer insert and counter bump succeed or roll back together.

**Tests:** extend `[apps/api/app/tests/test_answer_service.py](apps/api/app/tests/test_answer_service.py)` (or endpoint tests) to assert after `create`, `Question.answers` equals prior + 1. Existing `get_answers` popular-order test may need expectation update if it assumed tie-break ordering.

## Out of scope (optional follow-up)

- **Delete:** Web `[deleteAnswer](apps/web/lib/actions/answer.action.ts)` decrements question count; API has no delete endpoint yet—when added, decrement `Question.answers` in the same transaction as answer delete (and consider `max(0, ...)`).
- **Web migration** off Mongoose for `getAnswers`—separate task once API is source of truth.

## Verification

- Unit/service tests: `popular` sort with equal upvotes matches “upvotes only” ordering policy.
- After create: `question.answers` incremented in DB for the parent question row.

