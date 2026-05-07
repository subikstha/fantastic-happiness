from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.question import QuestionCreate, QuestionRead, QuestionReadItem

from app.infrastructure.db.models.question import Question
from app.infrastructure.db.models import User
from uuid import UUID
from app.infrastructure.db.models.tag import Tag
from app.infrastructure.db.models.tag_question import TagQuestion

class QuestionConflictError(Exception):
    pass

class QuestionService:

    @staticmethod
    async def get_question(question_id: UUID, db: AsyncSession) -> QuestionReadItem:
        stmt = select(Question).where(Question.id == question_id).options(
            selectinload(Question.author),
            selectinload(Question.tag_questions).selectinload(TagQuestion.tag)
        )
        question = (await db.execute(stmt)).scalar_one_or_none() # If scalar_one() is used, it will raise an error if no question is found, the next line will not be executed
        if question is None:
            raise QuestionConflictError("Question not found")
        return {
            "id": question.id,
            "title": question.title,
            "content": question.content,
            "author": question.author,
            "tags": [tq.tag for tq in question.tag_questions],
            "created_at": question.created_at,
            "answers": question.answers,
            "views": question.views,
            "upvotes": question.upvotes,
            "downvotes": question.downvotes,
        }


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

        stmt = (
            select(Question)
            .where(Question.id == question.id)
            .options(
                selectinload(Question.author),
                selectinload(Question.tag_questions).selectinload(TagQuestion.tag)
            )
        )
        created = (await db.execute(stmt)).scalar_one()
        return  {
                "id": created.id,
                "title": created.title,
                "content": created.content,
                "author": created.author,
                "tags": [tq.tag for tq in created.tag_questions],
                "created_at": created.created_at,
                "answers": created.answers,
                "views": created.views,
                "upvotes": created.upvotes,
                "downvotes": created.downvotes,
            }
           
           
    @staticmethod
    async def get_all(db: AsyncSession, page: int = 1, page_size: int = 10, query: str | None = None, filter: str | None = None) -> QuestionRead:
        skip = (page -1) * page_size
        limit = page_size

        conditions = []

        #Query search on title/content - case insensitive
        if query: 
            q = f"%{query.strip()}%"
            conditions.append(
                or_(Question.title.ilike(q), Question.content.ilike(q))
            )

        if filter == "unanswered":
            conditions.append(Question.answers == 0)

        # Filter specific sorting
        if filter == "newest":
            order_by =[Question.created_at.desc()]
        elif filter == "popular":
            order_by = [Question.upvotes.desc()]
        else:
            order_by = [Question.created_at.desc()]
        
        base_stmt = select(Question)
        if conditions:
            base_stmt = base_stmt.where(*conditions)

        # Count for pagination metadata
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (base_stmt
            .options(selectinload(Question.author), selectinload(Question.tag_questions).selectinload(TagQuestion.tag))
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(data_stmt)
        questions = result.scalars().all() # gets Question ORM rows from SQLAlchemy result

        items = [
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
        return {
            "questions": items,
            "isNext": total > (skip + len(items))
        }

    @staticmethod
    async def increment_views(question_id: UUID, db: AsyncSession):
        stmt = select(Question).where(Question.id == question_id)
        question = (await db.execute(stmt)).scalar_one_or_none()
        if question is None:
            raise QuestionConflictError("Question not found")
        question.views += 1
        await db.commit()
        await db.refresh(question)
        return {
            "views": question.views,
        }