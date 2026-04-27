# Pydantic API schemas for the user model
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr

class UserRead(BaseModel):
    id: UUID
    name: str
    username: str
    email: EmailStr
    bio: str | None = None
    image: str | None = None
    location: str | None = None
    portfolio: str | None = None
    reputation: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}