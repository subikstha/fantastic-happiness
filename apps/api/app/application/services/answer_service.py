from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.schemas.answer import AnswerCreate
from app.infrastructure.db.models import User
from app.infrastructure.db.models.answer import Answer
from app.infrastructure.db.models.question import Question


class AnswerConflictError(Exception):
    pass


class AnswerService:
    @staticmethod
    async def create(payload: AnswerCreate, db: AsyncSession, current_user: User):
        stmt = select(Question).where(Question.id == payload.question_id)
        question = (await db.execute(stmt)).scalar_one_or_none()
        if question is None:
            raise AnswerConflictError("Question not found")

        answer = Answer(
            content=payload.content,
            question_id=payload.question_id,
            author_id=current_user.id,
        )
        db.add(answer)
        question.answers += 1
        await db.commit()
        await db.refresh(answer)

        return {
            "id": answer.id,
            "content": answer.content,
            "question_id": answer.question_id,
            "author": {
                "id": current_user.id,
                "name": current_user.name,
                "image": current_user.image,
            },
            "upvotes": answer.upvotes,
            "downvotes": answer.downvotes,
            "created_at": answer.created_at,
        }

    @staticmethod
    async def get_answers(
        db: AsyncSession,
        question_id: UUID,
        page: int = 1,
        page_size: int = 10,
        filter: str | None = None,
    ) -> dict:
        skip = (page - 1) * page_size
        limit = page_size

        base_stmt = select(Answer).where(Answer.question_id == question_id)

        f = (filter or "").strip().lower()
        if f == "oldest":
            order_by = [Answer.created_at.asc()]
        elif f == "popular":
            order_by = [Answer.upvotes.desc()]
        elif f == "latest":
            order_by = [Answer.created_at.desc()]
        else:
            order_by = [Answer.created_at.desc()]

        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            base_stmt.options(selectinload(Answer.author))
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(data_stmt)
        answers = result.scalars().all()

        items = [
            {
                "id": a.id,
                "content": a.content,
                "question_id": a.question_id,
                "author": {
                    "id": a.author.id,
                    "name": a.author.name,
                    "image": a.author.image,
                },
                "upvotes": a.upvotes,
                "downvotes": a.downvotes,
                "created_at": a.created_at,
            }
            for a in answers
        ]
        return {
            "answers": items,
            "isNext": total > (skip + len(items)),
            "totalAnswers": total,
        }
