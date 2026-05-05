from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.question import QuestionCreate, QuestionRead

from app.infrastructure.db.models.question import Question
from app.infrastructure.db.models import User
from app.infrastructure.db.models.tag import Tag
from app.infrastructure.db.models.tag_question import TagQuestion

class QuestionConflictError(Exception):
    pass

class QuestionService:
    @staticmethod
    async def create(payload: QuestionCreate, db: AsyncSession, current_user: User):
        question = Question(
            title=payload.title,
            content=payload.content,
            author_id=current_user.id,
        )

        db.add(question)
        await db.flush() # question.id is available immediately after this flush()

        question_id = question.id
        # Loop through the tags and create a tag if it does not exist and then create a tag question relationship
        for raw_tag in payload.tags:
            tag_name = raw_tag.strip() # Remove any leading or trailing whitespace
            if not tag_name:
                continue

            result = await db.execute(select(Tag).where(func.lower(Tag.name) == tag_name.lower()))
            tag = result.scalar_one_or_none()

            if tag is None:
                tag=Tag(name=tag_name, questions=1)
                db.add(tag)
                await db.flush()
            else:
                tag.questions += 1

            tag_question = TagQuestion(question_id=question_id, tag_id=tag.id)
            db.add(tag_question)

        await db.commit()
        await db.refresh(question)
        return question

    @staticmethod
    async def get_all(db: AsyncSession) -> list[QuestionRead]:
        
        # TODO: need to add pagination and filtering and also get all the associated tags and author for each question
        stmt = select(Question).options(selectinload(Question.author), selectinload(Question.tag_questions).selectinload(TagQuestion.tag))
        result = await db.execute(stmt)
        questions = result.scalars().all() # gets Question ORM rows from SQLAlchemy result
        return [
            {
                "id": q.id,
                "title": q.title,
                "content": q.content,
                "author": q.author,
                "tags": [tq.tag for tq in q.tag_questions],
                "created_at": q.created_at,
                "answers": q.answers,
                "views": q.views,
                "upvotes": q.upvotes,
                "downvotes": q.downvotes,
            }
            for q in questions # iterates each Question and build a new QuestionRead object for each
        ]