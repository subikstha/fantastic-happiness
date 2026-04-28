from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.session import get_db
from app.schemas.auth import LoginRequest, AuthResponse, RefreshTokenRequest, AuthUser
from app.application.services.auth_service import AuthService
from app.api.deps.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.login(email=payload.email, password=payload.password, db=db)

@router.post("/refresh", response_model=AuthResponse)
async def refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService.refresh(refresh_token=payload.refresh_token, db=db)

@router.get("/me", response_model=AuthUser)
async def me(current_user = Depends(get_current_user)):
    return current_user

@router.post("/logout", status_code=204)
async def logout(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    await AuthService.logout(refresh_token=payload.refresh_token, db=db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)