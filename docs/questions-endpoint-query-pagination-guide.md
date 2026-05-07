# FastAPI Questions Query Params + Pagination Guide

This guide shows how to replicate the behavior from the current Next.js `getQuestions` server action (`page`, `pageSize`, `query`, `filter`) in FastAPI with SQLAlchemy.

It includes:

- endpoint query param handling
- service-layer skip/limit/filter/query logic
- relationship loading for `author` and `tags`
- `isNext` calculation

---

## 1) Endpoint: accept query params

Use FastAPI `Query` parameters and pass them directly to the service layer.

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.question_service import QuestionService
from app.infrastructure.db.session import get_db

router = APIRouter(prefix="/questions", tags=["questions"])

@router.get("")
async def get_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    query: str | None = Query(None),
    filter: str | None = Query("newest"),
    db: AsyncSession = Depends(get_db),
):
    return await QuestionService.get_all(
        db=db,
        page=page,
        page_size=page_size,
        query=query,
        filter=filter,
    )
```

### Why this shape

- `page` and `page_size` are validated at the HTTP boundary.
- `query` and `filter` stay optional.
- Endpoint remains thin and delegates business logic to service.

---

## 2) Service: skip, limit, filter, query

This is the SQLAlchemy equivalent of the current Mongoose flow:

- text search on title/content
- filter-specific constraints (`unanswered`)
- filter-specific sorting (`popular`, `newest`)
- pagination (`offset`/`limit`)
- count query for `isNext`

```python
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models.question import Question
from app.infrastructure.db.models.tag_question import TagQuestion


class QuestionService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 10,
        query: str | None = None,
        filter: str | None = "newest",
    ):
        skip = (page - 1) * page_size
        limit = page_size

        conditions = []

        # Query search on title/content (case-insensitive)
        if query:
            q = f"%{query.strip()}%"
            conditions.append(
                or_(
                    Question.title.ilike(q),
                    Question.content.ilike(q),
                )
            )

        # Filter-specific constraints
        if filter == "unanswered":
            conditions.append(Question.answers == 0)

        # Filter-specific sorting
        if filter == "popular":
            order_by = [Question.upvotes.desc()]
        else:  # newest + unanswered default
            order_by = [Question.created_at.desc()]

        base_stmt = select(Question)
        if conditions:
            base_stmt = base_stmt.where(*conditions)

        # Count for pagination metadata
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        # Fetch paginated rows with related author/tags
        data_stmt = (
            base_stmt
            .options(
                selectinload(Question.author),
                selectinload(Question.tag_questions).selectinload(TagQuestion.tag),
            )
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        questions = (await db.execute(data_stmt)).scalars().all()

        # Shape output to match frontend contract
        items = [
            {
                "id": q.id,
                "title": q.title,
                "content": q.content,
                "author": q.author,
                "tags": [tq.tag for tq in q.tag_questions],
                "created_at": q.created_at,
                "upvotes": q.upvotes,
                "downvotes": q.downvotes,
                "answers": q.answers,
                "views": q.views,
            }
            for q in questions
        ]

        return {
            "questions": items,
            "isNext": total > (skip + len(items)),
        }
```

---

## 2a) QuestionService: detailed explanations

### Why `conditions = []`

`conditions` is a **list of SQLAlchemy boolean expressions** (column comparisons, `or_()`, etc.) that will all be combined in the final `WHERE` clause.

Starting with an empty list lets you **add filters only when needed**:

- If the user passes no `query` and no special `filter`, the list stays empty and you do not add a `WHERE` clause at all (all rows match).
- If the user passes a search string, you append one expression.
- If the user picks `unanswered`, you append another.

This pattern avoids a long chain of `if/else` that builds different `select()` statements from scratch for every combination of optional filters.

### Why `q` is an f-string (`f"%{query.strip()}%"`)

SQL `ILIKE` (and `LIKE`) use **pattern** strings, not plain substring checks:

- `%` means “any characters before/after.”
- Wrapping the user’s text as `%{query}%` means “match if title or content **contains** this substring (case-insensitive).”

`query.strip()` removes accidental leading/trailing spaces so `"  react  "` does not become a different pattern than `"react"`.

**Security note:** You are not interpolating raw user text into SQL as string concatenation in the query itself; you bind the pattern as a parameter through SQLAlchemy’s `ilike(q)`. The f-string only builds the Python string that becomes the bound value.

### Why `conditions.append(...)`

Each `append` adds **one more requirement** that must be true for a row to be included.

SQLAlchemy’s `where(*conditions)` combines them with **AND** by default when you pass multiple expressions. So:

- Search + `unanswered` means: *(title/content matches pattern) **AND** (answers == 0)*.

Using `append` keeps each concern separate and readable instead of nesting many `if` blocks inside a single giant `where(...)`.

### `order_by`: why not `conditions.append`, and why `[Question.upvotes.desc()]`

**`conditions` is only for the `WHERE` clause** (which rows to include). **Sorting** is a different part of the SQL statement: `ORDER BY`.

- Putting an `order_by` expression into `conditions` would be wrong: you would be filtering rows by a sort key, not ordering them.
- So sort criteria live in a separate variable: `order_by = [...]`.

Using a **list** for `order_by` (even with one element) is a common habit because:

- You might later add a tie-breaker (e.g. `created_at.desc()` after `upvotes.desc()`).
- You can pass the same shape to `.order_by(*order_by)` as you do for `where(*conditions)`.

For `filter == "popular"`, `[Question.upvotes.desc()]` means **highest upvotes first**. For other filters, `[Question.created_at.desc()]` means **newest first**.

### Why `base_stmt = base_stmt.where(*conditions)` uses `*`

In Python, `*` **unpacks** a sequence into separate positional arguments.

- `conditions` might be `[expr1, expr2]`.
- `base_stmt.where(*conditions)` is equivalent to `base_stmt.where(expr1, expr2)`.

SQLAlchemy treats multiple arguments to `where()` as **AND**ed together. Without `*`, you would pass a single list object, which is not a valid SQL expression.

The code guards with `if conditions:` so you never call `where()` with nothing useful when there are no filters.

### Count query: `count_stmt` and `scalar_one()` (lines 110–111)

```python
count_stmt = select(func.count()).select_from(base_stmt.subquery())
total = (await db.execute(count_stmt)).scalar_one()
```

**What this does**

- `base_stmt` is `SELECT ... FROM questions WHERE ...` (same filters as the list endpoint, but **no** `order_by`, `offset`, or `limit` yet). You need the **total number of matching rows** for pagination metadata (`isNext`, “page X of Y”), not just the rows on the current page.

- `base_stmt.subquery()` turns that statement into a **subquery** (an inline “virtual table” in SQL). Every row in that subquery is one question that passed your filters.

- `select(func.count()).select_from(...)` builds `SELECT count(*) FROM (subquery)`. So you count **only** filtered rows. If you counted from `Question` directly without reusing `base_stmt`, you could accidentally ignore `query` / `unanswered` and get the wrong total.

**Why `()` appears in these lines**

- **`func.count()`** — In SQLAlchemy, `count` is a function object; calling it with **`()`** means “aggregate with no explicit column,” which compiles like counting rows (similar to `COUNT(*)` in SQL). You need the call so the expression is a real aggregate, not the bare function.

- **`(await db.execute(count_stmt))`** — **Parentheses are required for operator precedence.** You want to `await` the coroutine `db.execute(count_stmt)` first, then call `.scalar_one()` on the **Result** object. Without parentheses, Python would parse something like `await db.execute(count_stmt.scalar_one())`, which is wrong. So: await → get result → then `scalar_one()`.

- **`.scalar_one()`** — **`()`** means “call this method.” It returns the **single** scalar value in the first column of the first row (here, the integer count). It also asserts there is exactly one row (and one column), which is what you expect from `SELECT count(...)`. Alternatives like `.scalar()` exist when zero or one row is possible; `scalar_one()` is stricter and fails fast if the query shape is wrong.

### The `data_stmt` block (relationship loading, order, pagination)

**Why the whole chain is wrapped in `(` `)`**

The opening `(` after `=` starts a **parenthesized expression**. In Python, newlines inside parentheses are ignored, so you can break the method chain across lines without `\` or extra commas. It is only for **readability**; it does not change SQL. The assignment is still one expression: `base_stmt.options(...).order_by(...).offset(...).limit(...)`.

```python
data_stmt = (
    base_stmt
    .options(
        selectinload(Question.author),
        selectinload(Question.tag_questions).selectinload(TagQuestion.tag),
    )
    .order_by(*order_by)
    .offset(skip)
    .limit(limit)
)
```

- **`base_stmt`** is still `select(Question)` plus any `WHERE` from `conditions`. Reusing it keeps **the same filter** for both the count query and the data query.

- **`.options(selectinload(...))`** tells SQLAlchemy how to load related rows so you do not get **N+1 queries** when you access `question.author` or `question.tag_questions` / `tag` in Python.  
  - `selectinload(Question.author)` runs a second query that loads all authors for the questions in this page in one batch.  
  - `selectinload(Question.tag_questions).selectinload(TagQuestion.tag)` loads tag link rows, then their `Tag` rows, again in batched queries instead of one query per question.

- **`.order_by(*order_by)`** applies the sort list (popular vs newest) defined earlier. `*` unpacks the list the same way as for `where`.

- **`.offset(skip)`** skips the first `(page - 1) * page_size` rows so page 2 starts after page 1.

- **`.limit(limit)`** returns at most `page_size` rows.

Together, this statement is: **filtered questions, sorted, with relationships eager-loaded, for one page of results**.

---

## 3) Notes and recommendations

- Keep this logic in the service layer, not in endpoint handlers.
- If your frontend expects camelCase (`createdAt`) or `_id`, use Pydantic aliases in response schemas.
- If you add a `recommended` filter later, route it to a separate service method (similar to existing Next.js logic).
- Add a response schema (e.g., `QuestionListResponse`) for stronger response validation:
  - `questions: list[QuestionRead]`
  - `isNext: bool`

