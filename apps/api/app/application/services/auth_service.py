import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.application.services.account_service import AccountService
from app.application.services.user_service import UserService
from app.core.security import verify_password, create_access_token
from app.application.services.refresh_token_service import RefreshTokenService

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    async def login(email: str, password: str, db: AsyncSession):
        account = await AccountService.get_credentials_account_by_email(email=email, db=db)
        if not account:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials for no account")
        if not account.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials for no account password")

        if not verify_password(password, account.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials for failed password verification")
        user = await UserService.get_user_by_id(user_id=account.user_id, db=db)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials for no user")

        access_token, expires_in = create_access_token(sub=str(user.id))
        # TODO: issue refresh token from DB-backed refresh-token service
        refresh_token = RefreshTokenService.create(user_id=user.id, db=db)

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username
            }
        }

    @staticmethod
    async def refresh(refresh_token: str, db: AsyncSession):
        user_id, new_refresh_token = await RefreshTokenService.rotate(raw_token=refresh_token, db=db)

        user = await UserService.get_user_by_id(user_id=user_id, db=db)

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        access_token, expires_in = create_access_token(sub=str(user.id))

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "image": user.image,
                "username": user.username,
            },
        }
    
    @staticmethod
    async def logout(refresh_token: str, db: AsyncSession):
        await RefreshTokenService.revoke(raw_token=refresh_token, db=db)
        return None
