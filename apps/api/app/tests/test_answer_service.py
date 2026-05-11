import uuid

import pytest

from app.application.services.answer_service import AnswerConflictError, AnswerService
from app.infrastructure.db.models.answer import Answer
from app.infrastructure.db.models.question import Question
from app.infrastructure.db.models.user import User
from app.schemas.answer import AnswerCreate
from app.tests.conftest import TestingSessionLocal


@pytest.mark.asyncio
async def test_get_answers_pagination_is_next_and_popular_order():
    uid = uuid.uuid4()
    qid = uuid.uuid4()
    async with TestingSessionLocal() as db:
        user = User(
            id=uid,
            name="Tester",
            username=f"u_{uuid.uuid4().hex[:8]}",
            email=f"e_{uuid.uuid4().hex[:8]}@example.com",
        )
        question = Question(
            id=qid,
            title="Q",
            content="Body",
            author_id=uid,
        )
        db.add(user)
        db.add(question)
        await db.commit()

        for i in range(3):
            db.add(
                Answer(
                    content=f"Answer {i}",
                    question_id=qid,
                    author_id=uid,
                    upvotes=i,
                )
            )
        await db.commit()

        page1 = await AnswerService.get_answers(db, qid, page=1, page_size=2, filter="latest")
        assert page1["totalAnswers"] == 3
        assert len(page1["answers"]) == 2
        assert page1["isNext"] is True

        page2 = await AnswerService.get_answers(db, qid, page=2, page_size=2, filter="latest")
        assert len(page2["answers"]) == 1
        assert page2["isNext"] is False

        popular = await AnswerService.get_answers(
            db, qid, page=1, page_size=10, filter="popular"
        )
        assert popular["answers"][0]["upvotes"] == 2

        latest_explicit = await AnswerService.get_answers(
            db, qid, page=1, page_size=10, filter="latest"
        )
        default_filter = await AnswerService.get_answers(
            db, qid, page=1, page_size=10, filter=None
        )
        assert len(latest_explicit["answers"]) == 3
        assert [a["id"] for a in latest_explicit["answers"]] == [
            a["id"] for a in default_filter["answers"]
        ]


@pytest.mark.asyncio
async def test_create_increments_question_answers_count():
    uid = uuid.uuid4()
    qid = uuid.uuid4()
    async with TestingSessionLocal() as db:
        user = User(
            id=uid,
            name="Author",
            username=f"u_{uuid.uuid4().hex[:8]}",
            email=f"e_{uuid.uuid4().hex[:8]}@example.com",
        )
        question = Question(
            id=qid,
            title="Title",
            content="Body",
            author_id=uid,
            answers=0,
        )
        db.add(user)
        db.add(question)
        await db.commit()

        await AnswerService.create(
            AnswerCreate(question_id=qid, content="First reply"),
            db,
            user,
        )

        await db.refresh(question)
        assert question.answers == 1


@pytest.mark.asyncio
async def test_create_raises_when_question_missing():
    uid = uuid.uuid4()
    missing_qid = uuid.uuid4()
    async with TestingSessionLocal() as db:
        user = User(
            id=uid,
            name="Lonely",
            username=f"u_{uuid.uuid4().hex[:8]}",
            email=f"e_{uuid.uuid4().hex[:8]}@example.com",
        )
        db.add(user)
        await db.commit()

        with pytest.raises(AnswerConflictError, match="Question not found"):
            await AnswerService.create(
                AnswerCreate(question_id=missing_qid, content="orphan"),
                db,
                user,
            )


@pytest.mark.asyncio
async def test_get_answers_empty_question():
    async with TestingSessionLocal() as db:
        missing_q = uuid.uuid4()
        out = await AnswerService.get_answers(db, missing_q, page=1, page_size=10)
        assert out["answers"] == []
        assert out["totalAnswers"] == 0
        assert out["isNext"] is False
