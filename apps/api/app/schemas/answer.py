from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class AnswerCreate(BaseModel):
    question_id: UUID
    content: str

    model_config = {"from_attributes": True}

class AnswerReadItem(BaseModel):
    id: UUID = Field(serialization_alias="_id")
    author_id: UUID = Field(serialization_alias="author")
    question_id: UUID = Field(serialization_alias="question")
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