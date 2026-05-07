from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

class QuestionCreate(BaseModel):
    title: str
    content: str
    tags: list[str]

# This is for the nested author information when reading the question and the model_config allows Pydantic to read these from the ORM Question.author # relationship objects directly
class QuestionAuthorRead(BaseModel):
    id: UUID
    name: str
    image: str | None = None

    model_config = {"from_attributes": True}

class QuestionTagRead(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class QuestionReadItem(BaseModel):
    id: UUID = Field(serialization_alias="_id")
    title: str
    content: str
    author: QuestionAuthorRead
    tags: list[QuestionTagRead]
    created_at: datetime = Field(serialization_alias="createdAt")
    upvotes: int
    downvotes: int
    answers: int
    views: int

    model_config = {"from_attributes": True}

class QuestionIncrementViewsItem(BaseModel):
    views: int

    model_config = {"from_attributes": True}

class QuestionRead(BaseModel):
    questions: list[QuestionReadItem]
    isNext: bool