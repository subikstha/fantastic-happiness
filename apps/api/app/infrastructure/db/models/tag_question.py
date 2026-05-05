import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, Integer, String, func, ForeignKey, Text, ARRAY, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base

if TYPE_CHECKING:
    from app.infrastructure.db.models.tag import Tag
    from app.infrastructure.db.models.question import Question

class TagQuestion(Base):
    __tablename__ = "tag_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id"),
        nullable=False,
        index=True,
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id"),
        nullable=False,
        index=True,
    )

    tag: Mapped["Tag"] = relationship("Tag", back_populates="tag_questions")
    question: Mapped["Question"] = relationship("Question", back_populates="tag_questions")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tag_id", "question_id", name="uq_tag_question_tag_id_question_id"),
    )