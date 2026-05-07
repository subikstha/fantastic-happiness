

from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.question_service import QuestionConflictError, QuestionService
from app.infrastructure.db.session import get_db
from app.schemas.question import QuestionCreate, QuestionReadItem, QuestionRead, QuestionIncrementViewsItem
from app.api.deps.auth import get_current_user
from app.infrastructure.db.models import User
from uuid import UUID


router = APIRouter(prefix="/questions", tags=["questions"])

"""
NOTE:
Declare static routes before dynamic endpoints since /all can match the dynamic one
1. /all
2. /create
3. /{question_id}
"""

@router.get("/all", response_model=QuestionRead)
async def get_all(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    query: str | None = Query(None),
    filter: str | None = Query("newest")
    ):
    return await QuestionService.get_all(db=db, page=page, page_size=page_size, query=query, filter=filter)

@router.post("/create", response_model=QuestionReadItem, status_code=status.HTTP_201_CREATED)
async def create(payload: QuestionCreate, db: AsyncSession = Depends(get_db), current_user: User =Depends(get_current_user)):
    return await QuestionService.create(payload=payload, db=db, current_user=current_user)

@router.get("/{question_id}", response_model=QuestionReadItem)
async def get_question(question_id: UUID, db: AsyncSession = Depends(get_db)):
    try: 
        return await QuestionService.get_question(question_id=question_id, db=db)
    except QuestionConflictError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/{question_id}/increment-views", response_model=QuestionIncrementViewsItem)
async def increment_views(question_id: UUID, db: AsyncSession = Depends(get_db)):
    return await QuestionService.increment_views(question_id=question_id, db=db)


