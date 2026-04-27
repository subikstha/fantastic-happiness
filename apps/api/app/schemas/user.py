# Pydantic API schemas for the user model
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255) # Field() adds metadata to the field, like min_length and max_length.
    username: str = Field(min_length=3, max_length=255)
    email: EmailStr
    bio: str | None = None
    image: str | None = None
    location: str | None = None
    portfolio: str | None = None

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