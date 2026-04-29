from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.application.services.account_service import AccountConflictError, AccountService
from app.application.services.user_service import UserConflictError, UserService
from app.core.security import verify_password, create_access_token
from app.application.services.refresh_token_service import RefreshTokenService
from app.schemas.account import AccountCreate
from app.schemas.user import UserCreate


class AuthService:
    @staticmethod
    async def login(email: str, password: str, db: AsyncSession):
        email = email.strip().lower()
        account = await AccountService.get_credentials_account_by_email(email=email, db=db)
        if not account or not account.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not verify_password(password, account.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        user = await UserService.get_user_by_id(user_id=account.user_id, db=db)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        access_token, expires_in = create_access_token(sub=str(user.id))
        refresh_token = await RefreshTokenService.create(user_id=user.id, db=db)

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
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
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

    @staticmethod
    async def sign_up_with_credentials(email: str, password: str, name: str, username: str, db: AsyncSession):
        email = email.strip().lower()
        username = username.strip()
        name = name.strip()

        # Create user + credentials account, then issue the same AuthResponse shape as `/auth/login`.
        user_payload = UserCreate(name=name, username=username, email=email)
        try:
            new_user = await UserService.create(payload=user_payload, db=db)
        except UserConflictError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

        account_payload = AccountCreate(
            user_id=new_user.id,
            name=name,
            image=None,
            provider="credentials",
            provider_account_id=email,  # must match `login` lookup key
            password=password,
        )

        try:
            await AccountService.create(payload=account_payload, db=db)
        except AccountConflictError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except ValueError:
            # Typically triggered by credentials password validation (e.g., bcrypt 72-byte limit).
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password")

        access_token, expires_in = create_access_token(sub=str(new_user.id))
        refresh_token = await RefreshTokenService.create(user_id=new_user.id, db=db)

        return {
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": expires_in,
            },
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "name": new_user.name,
                "image": new_user.image,
                "username": new_user.username,
            },
        }
        
        