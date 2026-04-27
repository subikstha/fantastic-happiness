from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.db.models.user import User
from schemas.user import UserCreate

"""
UserConflictError is a custom exception type
- It lets your service signal a specific business error: “user already exists / conflict”.
- In your endpoint layer, you can catch this exact exception and return HTTP 409 Conflict.
- Better than raising generic Exception, because generic exceptions don’t tell API layer what kind of failure happened.
- service raises UserConflictError
- endpoint translates it to API response (409, clear message)
"""
class UserConflictError(Exception):
    pass # pass indicates to not do anything here, still we can raise it if we want to and add richer behavior like error code, metadata etc

class UserService:
    @staticmethod
    async def get_user_by_id(user_id, db: AsyncSession) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(payload: UserCreate, db: AsyncSession) -> User:
        # Check existing user
        existing = await db.execute(select(User).where(or_(User.email == payload.email, User.username == payload.username)))

        conflict = existing.scalar_one_or_none()
        if conflict:
            if conflict.email == payload.email:
                raise UserConflictError('Email already in use')
            raise UserConflictError('Username already in use')

        user = User(
            name=payload.name,
            username=payload.username,
            email=payload.email,
            bio=payload.bio,
            image=payload.image,
            location=payload.location,
            portfolio=payload.portfolio,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
        # Service layer returns ORM objects (User).
        # Endpoint layer handles response serialization via `response_model`.
        # UserRead is a Pydantic schema (DTO).
        # user is a SQLAlchemy ORM instance
        # UserRead.model_validate(user) converts/validates the ORM object into a UserRead object 
        """
        This ensures
        - The returned user data matches the API schema strictly
        - Filters out fields not present in UserRead
        - Gives typed response object from service layer
        """
