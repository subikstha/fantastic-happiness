from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, model_validator

class AccountCreate(BaseModel):
    user_id: UUID
    name: str
    image: str | None = None
    provider: str
    provider_account_id: str
    password: str | None = None

    @model_validator(mode="after")
    def validate_credentials_password(self):
        if self.provider == "credentials":
            if not self.password:
                raise ValueError("password is required for credentials accounts")
            if len(self.password.encode("utf-8")) > 72:
                raise ValueError("password cannot be longer than 72 bytes for bcrypt")
        return self

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