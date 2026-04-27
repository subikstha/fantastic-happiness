from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.account import Account
from schemas.account import AccountCreate

class AccountConflictError(Exception):
    pass

class AccountService:
    @staticmethod
    async def get_account_by_provider(provider: str, provider_account_id: str, db: AsyncSession) -> Account | None:
        result = await db.execute(select(Account).where(Account.provider == provider, Account.provider_account_id == provider_account_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(payload: AccountCreate, db: AsyncSession) -> Account:
        # Check existing account
        existing = await db.execute(
            select(Account).where(
                Account.provider == payload.provider,
                Account.provider_account_id == payload.provider_account_id,
            )
        )
        conflict = existing.scalar_one_or_none()
        if conflict:
            raise AccountConflictError('Account already exists')
        account = Account(
            user_id=payload.user_id,
            name=payload.name,
            image=payload.image,
            provider=payload.provider,
            provider_account_id=payload.provider_account_id,
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account