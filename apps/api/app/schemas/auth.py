from pydantic import BaseModel, EmailStr
from uuid import UUID

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    username: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int # seconds

class AuthUser(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    image: str | None = None
    username: str | None = None

class AuthResponse(BaseModel):
    tokens: TokenPair
    user: AuthUser

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int # seconds