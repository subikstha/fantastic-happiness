import uuid

import pytest

from app.infrastructure.db.models.answer import Answer
from app.infrastructure.db.models.question import Question
from app.infrastructure.db.models.user import User
from app.tests.conftest import TestingSessionLocal


@pytest.mark.asyncio
async def test_get_answers_all_http(client):
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
        db.add(
            Answer(
                content="One answer",
                question_id=qid,
                author_id=uid,
            )
        )
        await db.commit()

    res = await client.get(
        "/api/v1/answers/all",
        params={"question_id": str(qid), "page": 1, "page_size": 10},
    )
    assert res.status_code == 200
    data = res.json()
    assert "answers" in data
    assert "isNext" in data
    assert "totalAnswers" in data
    assert data["totalAnswers"] == 1
    assert len(data["answers"]) == 1
