"""
NOTE:
Declare static routes before dynamic endpoints (e.g. /all before GET /{answer_id}).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.answer_service import AnswerConflictError, AnswerService
from app.api.deps.auth import get_current_user
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models import User
from app.schemas.answer import AnswerCreate, AnswerRead, AnswerReadItem

router = APIRouter(prefix="/answers", tags=["answers"])


@router.get("/all", response_model=AnswerRead)
async def get_answers_all(
    db: AsyncSession = Depends(get_db),
    question_id: UUID = Query(..., description="Question UUID to list answers for"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    filter: str | None = Query(None),
):
    return await AnswerService.get_answers(
        db=db,
        question_id=question_id,
        page=page,
        page_size=page_size,
        filter=filter,
    )


@router.post("", response_model=AnswerReadItem, status_code=status.HTTP_201_CREATED)
async def create_answer(
    payload: AnswerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await AnswerService.create(payload=payload, db=db, current_user=current_user)
    except AnswerConflictError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
