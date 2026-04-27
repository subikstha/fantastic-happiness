from fastapi import APIRouter

from app.api.v1.endpoints import accounts
from app.api.v1.endpoints import health
from app.api.v1.endpoints import users

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(accounts.router, tags=["accounts"])
