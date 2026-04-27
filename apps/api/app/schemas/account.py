from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AccountRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    image: str | None = None
    provider: str
    provider_account_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}