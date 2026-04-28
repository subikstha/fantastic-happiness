import uuid # Python's UUID type. You use it for primary keys (uuid.uuid4()) generates a new random UUID.
from datetime import datetime

from sqlalchemy import DateTime, Integer, ForeignKey, func, String
from sqlalchemy.dialects.postgresql import UUID # UUID type for PostgreSQL. Tells PostgreSQL how to store the column
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    """
    Mapped[uuid.UUID]: SQLAlchemy 2.0 style typed attribute declaration. It ties the Python type to the DB column for editors and type checkers.
    id: Mapped[uuid.UUID] -> This attribute is mapped to a database column and its Python type is uuid.UUID 
    without typing (old style) -> id: Column(UUID) -> This has no type safety
    id: Mapped[uuid.UUID] = mapped_column(...) -> With this typing, IDE knows it is a UUID, type checkers(mypy, pyright) works , and is safer refactoring


    mapped_column(...) -> Defines a DB column and integrates with Mapped[] typing system, and is part of SQLAlchemy 2.o modern API

    id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), 
    primary_key=True, 
    default=uuid.uuid4
) -> Here 
    Mapped[uuid.UUID] -> This is the Python type that is mapped to the database column
    mapped_column(...) -> This is the function that defines the database column
    UUID(as_uuid=True) -> This is the function that tells SQLAlchemy to store the UUID as a PostgreSQL UUID type
    primary_key=True -> This is the function that tells SQLAlchemy to make this column the primary key
    default=uuid.uuid4 -> This is the function that tells SQLAlchemy to generate a new random UUID for the primary key when creating a new record
    """
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), # Tells SQLAlchemy to store the UUID as a PostgreSQL UUID type
        primary_key=True, 
        default=uuid.uuid4 # Generates a new random UUID for the primary key when creating a new record
        )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )