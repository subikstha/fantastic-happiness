from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class AnswerCreate(BaseModel):
    question_id: UUID
    content: str

    model_config = {"from_attributes": True}

class AnswerReadItem(BaseModel):
    id: UUID
    author_id: UUID
    question_id: UUID
    content: str
    upvotes: int
    downvotes: int
    createdAt: datetime

    model_config = {"from_attributes": True}

class AnswerRead(BaseModel):
    answers: list[AnswerReadItem]
    isNext: bool
    totalAnswers: int

    model_config = {"from_attributes": True}