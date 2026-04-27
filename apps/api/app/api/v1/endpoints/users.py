from uuid import UUID # Imports Python’s UUID type. Used to validate user_id path param as a proper UUID automatically.

"""
APIRouter: lets you group related endpoints (users here).
Depends: FastAPI dependency injection (used for DB session).
HTTPException: used to return proper API errors (like 404).
status: named HTTP status codes (status.HTTP_404_NOT_FOUND).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession # Async DB session type for SQLAlchemy.

from app.application.services.user_service import UserConflictError, UserService
from app.infrastructure.db.session import get_db # Imports dependency function that yields an AsyncSession. FastAPI injects this per request
from app.schemas.user import UserRead, UserCreate # Pydantic response schema for output serialization. Prevents returning raw ORM internals and enforces response shape


"""
Creates router group for user endpoints
prefix="/users" means all routes in this file start with /users.
tags=["users"] groups endpoints in Swagger UI docs.
"""
router = APIRouter(prefix="/users", tags=["users"]) 

@router.get("/{user_id}", response_model=UserRead) # Defines HTTP GET /users/{user_id} route (plus whatever API version prefix is applied in main router). #response_model=UserRead means response is validated/serialized as UserRead.
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    # Endpoint delegates data access/business rules to service layer.
    # Response serialization is still handled at endpoint boundary by response_model=UserRead.
    user = await UserService.get_user_by_id(user_id=user_id, db=db)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await UserService.create(payload=payload, db=db)
    except UserConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc)
        ) from exc