from fastapi import APIRouter

from api.v1.endpoints import health
from api.v1.endpoints import users
from api.v1.endpoints import accounts

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(accounts.router, tags=["accounts"])
