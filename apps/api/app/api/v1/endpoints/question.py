

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.question_service import QuestionService
from app.infrastructure.db.session import get_db
from app.schemas.question import QuestionCreate, QuestionRead
from app.api.deps.auth import get_current_user
from app.infrastructure.db.models import User


router = APIRouter(prefix="/questions", tags=["questions"])

@router.post("/create", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
async def create(payload: QuestionCreate, db: AsyncSession = Depends(get_db), current_user: User =Depends(get_current_user)):
    return await QuestionService.create(payload=payload, db=db, current_user=current_user)

@router.get("/all", response_model=list[QuestionRead])
async def get_all(db: AsyncSession = Depends(get_db)):
    return await QuestionService.get_all(db=db)