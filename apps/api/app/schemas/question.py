from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

class QuestionCreate(BaseModel):
    title: str
    content: str
    tags: list[str]

class QuestionRead(BaseModel):
    id: UUID
    title: str
    content: str
    author_id: UUID

    model_config = {"from_attributes": True}