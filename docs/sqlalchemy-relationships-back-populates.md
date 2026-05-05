# SQLAlchemy relationships: `back_populates`, cascades, and `delete-orphan`

This note documents how bidirectional relationships are declared in this project’s FastAPI + SQLAlchemy 2.0 models, and what **`back_populates`**, **ORM `cascade`**, and **database `ON DELETE`** each do.

## What `back_populates` does

`back_populates` links **two ends of the same association** so SQLAlchemy keeps the object graph consistent in memory.

You declare **two** `relationship()` calls—one on each model—and each names the **attribute on the other model**:

```python
# Parent side (one user, many questions)
questions: Mapped[list["Question"]] = relationship(
    "Question",
    back_populates="author",
)

# Child side (each question belongs to one user)
author: Mapped["User"] = relationship(
    "User",
    back_populates="questions",
)
```

Rules:

- The string passed to `back_populates` must **exactly match** the Python attribute name on the other class (`"questions"` ↔ `questions`, `"author"` ↔ `author`).
- The **foreign key** normally lives on the **“many”** side (`Question.author_id` → `users.id`).

Compared to **`backref`**: `backref="questions"` on one side only would **create** the reverse attribute for you. `back_populates` is the **explicit two-sided** style; both are valid.

## Example from this repo (`User` ↔ `Question`)

**Parent (`users` table)** — collection of questions:

```python
# apps/api/app/infrastructure/db/models/user.py (excerpt)
questions: Mapped[list["Question"]] = relationship(
    "Question",
    back_populates="author",
    cascade="all, delete-orphan",
)
```

**Child (`question` table)** — single author + FK:

```python
# apps/api/app/infrastructure/db/models/question.py (excerpt)
author_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("users.id", ondelete="CASCADE"),
    nullable=False,
)
author: Mapped["User"] = relationship("User", back_populates="questions")
```

This pairing is **valid**: names match, and the FK targets the real table name **`users`**, not `user`.

## Avoiding import cycles (`TYPE_CHECKING`)

Cross-model type hints can create circular imports. Use **`from __future__ import annotations`** (on `User`) and import the other model only under **`TYPE_CHECKING`**, while `relationship()` uses **string** names like `"Question"` and `"User"`:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.infrastructure.db.models.question import Question

questions: Mapped[list["Question"]] = relationship(
    "Question",
    back_populates="author",
)
```

At runtime SQLAlchemy resolves `"Question"` by class name; no import of `Question` is required at module load time for the mapper to configure.

## Database `ON DELETE CASCADE` vs ORM `cascade`

These are **different layers**:

| Mechanism | Where | What it does |
|-----------|--------|----------------|
| **`ForeignKey(..., ondelete="CASCADE")`** | PostgreSQL (schema) | When a **row** in `users` is **deleted in the database**, dependent `question` rows with that `author_id` are **removed by the DB**. |
| **`relationship(..., cascade="...")`** | SQLAlchemy `Session` | Controls what happens to **loaded Python objects** when you **assign**, **remove**, or **`session.delete()`** parents/children in the same session. |

They often **complement** each other: the DB enforces referential cleanup; the ORM keeps in-memory instances and flush order sensible.

## `cascade="all, delete-orphan"` (on the parent collection)

On **`User.questions`** this project uses:

```python
cascade="all, delete-orphan"
```

- **`all`** (shorthand): includes behaviors such as **`save-update`**, **`merge`**, **`refresh-expire`**, **`expunge`**, and **`delete`**, so operations on a `User` can propagate to related `Question` instances in the session according to SQLAlchemy’s rules.
- **`delete-orphan`**: if a **`Question`** is **disassociated** from its parent in a way that makes it an “orphan” for this relationship (for example, removed from `user.questions` without being attached to another user correctly), SQLAlchemy may **mark that question for DELETE** on flush.

**Caution:** `delete-orphan` is powerful. It is appropriate for **owned** children (e.g. accounts that only exist in the context of a user). For **questions**, some teams prefer **not** to use `delete-orphan` so that removing an item from an in-memory list does not delete content unless you explicitly `session.delete(question)`. If behavior feels too aggressive, narrow the cascade (e.g. `save-update, merge` only) and rely on **`ondelete="CASCADE"`** only for “user account deleted → rows gone in DB.”

**Convention:** put rich cascades (including `delete-orphan`) on the **one** side of one-to-many (`User.questions`). The **many** side (`Question.author`) typically has **no** `delete-orphan` mirror.

## Quick validation checklist

1. **`back_populates`** strings match the **attribute names** on both models.
2. **FK** is on the **many** side and references the correct table (`users.id`).
3. **`relationship()`** uses string class names if needed to avoid import cycles.
4. **`TYPE_CHECKING`** imports for type hints only where needed.
5. Decide deliberately whether **`delete-orphan`** matches product rules for that child type.

## See also

- SQLAlchemy: [Relationships API](https://docs.sqlalchemy.org/en/20/orm/relationship_api.html) and [Cascades](https://docs.sqlalchemy.org/en/20/orm/cascades.html)
- Project: `apps/api/app/infrastructure/db/models/user.py`, `question.py`, `account.py`
