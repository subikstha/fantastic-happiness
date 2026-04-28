import datetime
import uuid
from hmac import new
from time import timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import generate_refresh_token, hash_refresh_token, get_refresh_token_expiry
from app.infrastructure.db.models.refresh_token import RefreshToken
from fastapi import HTTPException, status
from sqlalchemy import select


class RefreshTokenService:
    @staticmethod
    async def create(user_id, db: AsyncSession) -> str:
        raw_token = generate_refresh_token()
        hashed_token = hash_refresh_token(raw_token)

        refresh_token = RefreshToken(
            user_id=user_id,
            token_hash=hashed_token,
            expires_at=get_refresh_token_expiry()
        )

        db.add(refresh_token)
        await db.commit()
        return raw_token
        
    @staticmethod
    async def rotate(raw_token: str, db: AsyncSession) -> tuple[uuid.UUID, str]:
        token_hash = hash_refresh_token(raw_token)

        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored = result.scalar_one_or_none()

        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        if stored.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token revoked"
            )

        if stored.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expired"
            )

        stored.revoked_at = datetime.now(timezone.utc)

        new_raw_token = generate_refresh_token()
        new_hashed_token = hash_refresh_token(new_raw_token)

        replacement = RefreshToken(
            user_id=stored.user_id,
            token_hash=new_hashed_token,
            expires_at=get_refresh_token_expiry()
        )

        db.add(replacement)
        await db.commit()
        return stored.user_id, new_raw_token

    async def revoke(raw_token: str, db: AsyncSession) -> None:
        token_hash = hash_refresh_token(raw_token)

        result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        stored = result.scalar_one_or_none()

        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        stored.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        return None