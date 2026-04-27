from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.account_service import AccountConflictError, AccountService
from app.infrastructure.db.session import get_db
from app.schemas.account import AccountCreate, AccountRead

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("/provider/{provider}/{provider_account_id}", response_model=AccountRead)
async def get_account_by_provider(
    provider: str, provider_account_id: str, db: AsyncSession = Depends(get_db)
):
    account = await AccountService.get_account_by_provider(provider, provider_account_id, db)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account

@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await AccountService.create(payload=payload, db=db)
    except AccountConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc)
        ) from exc