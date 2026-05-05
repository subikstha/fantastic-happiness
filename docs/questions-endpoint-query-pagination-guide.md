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

## 3) Notes and recommendations

- Keep this logic in the service layer, not in endpoint handlers.
- If your frontend expects camelCase (`createdAt`) or `_id`, use Pydantic aliases in response schemas.
- If you add a `recommended` filter later, route it to a separate service method (similar to existing Next.js logic).
- Add a response schema (e.g., `QuestionListResponse`) for stronger response validation:
  - `questions: list[QuestionRead]`
  - `isNext: bool`

