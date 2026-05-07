from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.answer import AnswerCreate, AnswerReadItem
from app.api.deps.auth import get_current_user
from app.infrastructure.db.session import get_db
from app.infrastructure.db.models import User
from app.application.services.answer_service import AnswerService

router = APIRouter(prefix="/answers", tags=["answers"])

@router.post("", response_model=AnswerReadItem, status_code=status.HTTP_201_CREATED)
async def create_answer(payload: AnswerCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await AnswerService.create(payload=payload, db=db, current_user=current_user)
