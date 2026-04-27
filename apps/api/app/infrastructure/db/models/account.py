from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import UUID6

if TYPE_CHECKING:
    from app.infrastructure.db.models.user import User

import uuid # Python's UUID type. You use it for primary keys (uuid.uuid4()) generates a new random UUID.
from datetime import datetime # Type hint for timestamp columns (created_at, updated_at).

from sqlalchemy import DateTime, Integer, String, func, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base # Base: Shared declarative base. Every model subclasses it so all tables are registered on Base.metadata(used by alembic)

# Account -> Python class representing one row in the DB
class Account(Base):
    __tablename__ = "accounts" # Actual table name in PostgreSQL
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_account_provider"),
    )

    """ 
    Mapped[...]: SQLAlchemy 2.0 style typed attribute declaration. It ties the Python type to the DB column for editors and type checkers.
    mapped_column(...): Declares an actual column (name inferred from attribute unless you pass name=).
    relationship(...): Declares ORM navigation between models (not a separate column by itself; it uses foreign keys on the other table, e.g. Account.user_id).
    """
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="accounts")