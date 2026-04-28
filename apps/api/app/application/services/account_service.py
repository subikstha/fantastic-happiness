from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models.account import Account
from app.schemas.account import AccountCreate
from app.core.security import hash_password

class AccountConflictError(Exception):
    pass

class AccountService:
    @staticmethod
    async def get_account_by_provider(provider: str, provider_account_id: str, db: AsyncSession) -> Account | None:
        result = await db.execute(select(Account).where(Account.provider == provider, Account.provider_account_id == provider_account_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_credentials_account_by_email(email: str, db: AsyncSession):
        result = await db.execute(select(Account).where(Account.provider == "credentials", Account.provider_account_id == email))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_oauth_account(provider: str, provider_account_id: str, db: AsyncSession) -> Account | None:
        result = await db.execute(
            select(Account).where(
                Account.provider == provider,
                Account.provider_account_id == provider_account_id,
            )
        )
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
            password=hash_password(payload.password) if payload.password else None,
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account