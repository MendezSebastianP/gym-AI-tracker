from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.exercise import Exercise
from app.schemas import ExerciseResponse, ExerciseCreate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/exercises",
    tags=["exercises"]
)

@router.get("", response_model=List[ExerciseResponse])
def get_exercises(
    search: Optional[str] = None,
    muscle: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Exercise).filter(
        (Exercise.user_id == current_user.id) | (Exercise.user_id == None)
    )
    
    if search:
        query = query.filter(Exercise.name.ilike(f"%{search}%"))
    if muscle:
        query = query.filter(Exercise.muscle == muscle)
        
    return query.all()

@router.post("", response_model=ExerciseResponse)
def create_exercise(
    exercise: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_exercise = Exercise(**exercise.model_dump(), user_id=current_user.id, source="custom")
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return db_exercise
