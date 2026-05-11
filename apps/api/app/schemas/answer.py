from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnswerCreate(BaseModel):
    question_id: UUID
    content: str

    model_config = {"from_attributes": True}


class AnswerAuthorRead(BaseModel):
    id: UUID
    name: str
    image: str | None = None

    model_config = {"from_attributes": True}


class AnswerReadItem(BaseModel):
    id: UUID = Field(serialization_alias="_id")
    author: AnswerAuthorRead
    question_id: UUID = Field(serialization_alias="question")
    content: str
    upvotes: int
    downvotes: int
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = {"from_attributes": True}


class AnswerRead(BaseModel):
    answers: list[AnswerReadItem]
    isNext: bool
    totalAnswers: int

    model_config = {"from_attributes": True}
