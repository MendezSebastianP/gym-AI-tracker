from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.routine import Routine
from app.schemas import RoutineResponse, RoutineCreate, RoutineUpdate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/routines",
    tags=["routines"]
)

@router.get("/", response_model=List[RoutineResponse])
def get_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Routine).filter(Routine.user_id == current_user.id).all()

@router.post("/", response_model=RoutineResponse)
def create_routine(
    routine: RoutineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_routine = Routine(**routine.model_dump(), user_id=current_user.id)
    db.add(db_routine)
    db.commit()
    db.refresh(db_routine)
    return db_routine

@router.get("/{routine_id}", response_model=RoutineResponse)
def get_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == current_user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine

@router.put("/{routine_id}", response_model=RoutineResponse)
def update_routine(
    routine_id: int,
    routine_update: RoutineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == current_user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    for key, value in routine_update.model_dump(exclude_unset=True).items():
        setattr(routine, key, value)
    
    # If became favorite, unset others
    if routine.is_favorite:
        db.query(Routine).filter(Routine.user_id == current_user.id, Routine.id != routine_id).update({"is_favorite": False})
    
    db.commit()
    db.refresh(routine)
    return routine
