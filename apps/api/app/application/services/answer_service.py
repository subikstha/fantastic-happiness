from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.answer import AnswerCreate, AnswerRead, AnswerReadItem
from app.infrastructure.db.models import User
from app.infrastructure.db.models.answer import Answer

class AnswerConflictError(Exception):
    pass

class AnswerService:
    # TODO: need methods for creating and reading answers
    @staticmethod
    async def create(payload: AnswerCreate, db: AsyncSession, current_user: User):
        # TODO: Implement logic here
        answer = Answer(
            content=payload.content,
            question_id=payload.question_id,
            author_id=current_user.id
        )
        db.add(answer) # Tells SQLAlchemy to track this object and prepare it to be inserted into the db
        db.commit() # This sends the SQL query to the DB and permanently saves the transaction
        db.refresh(answer) # After commiting, this reloads the object from the DB and updates the python object with new DB state

        return {
            "id": answer.id,
            "content": answer.content,
            "question_id": answer.question_id,
            "author_id": answer.author_id,
            "created_at": answer.created_at,
            "updated_at": answer.updated_at
        }