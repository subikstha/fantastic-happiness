from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.account import Account
from infrastructure.db.session import get_db
from schemas.account import AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/provider/{provider}/{provider_account_id}", response_model=AccountRead)
async def get_account_by_provider(
    provider: str, provider_account_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(
            Account.provider == provider,
            Account.provider_account_id == provider_account_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account