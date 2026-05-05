from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.question import QuestionCreate
from apps.api.app.api.deps.auth import get_current_user
from apps.api.app.application.services.user_service import UserService

from app.infrastructure.db.models.question import Question

class QuestionConflictError(Exception):
    pass

class QuestionService:
    @staticmethod
    async def create(payload: QuestionCreate, db: AsyncSession):
        current_user = await get_current_user(db=db)
        if current_user is None:
            raise QuestionConflictError('Unauthenticated')

        question = Question(
            title=payload.title,
            content=payload.content,
            author_id=current_user.id,
        )

        db.add(question)
        await db.commit()
        await db.refresh(question)
        return question