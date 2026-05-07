from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.answer import AnswerCreate, AnswerRead, AnswerReadItem
from app.infrastructure.db.models import User

class AnswerConflictError(Exception):
    pass

class AnswerService:
    # TODO: need methods for creating and reading answers
    @staticmethod
    async def create(payload: AnswerCreate, db: AsyncSession, current_user: User):
        # TODO: Implement logic here
        return True