from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

class QuestionCreate(BaseModel):
    title: str
    content: str
    tags: list[str]