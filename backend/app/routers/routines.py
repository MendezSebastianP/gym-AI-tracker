from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models.routine import Routine
from app.schemas import RoutineResponse, RoutineCreate, RoutineUpdate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/routines",
    tags=["routines"]
)

@router.get("", response_model=List[RoutineResponse])
def get_routines(
    include_archived: bool = Query(False, description="Include archived routines"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Routine).filter(Routine.user_id == current_user.id)
    if not include_archived:
        query = query.filter(Routine.archived_at == None)  # noqa: E711
    return query.all()

@router.post("", response_model=RoutineResponse)
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

@router.post("/{routine_id}/archive", response_model=RoutineResponse)
def archive_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-delete: move routine to archive. Will be permanently deleted after 10 days."""
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == current_user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    routine.archived_at = datetime.now(timezone.utc)
    routine.is_favorite = False  # Can't be favorite if archived
    db.commit()
    db.refresh(routine)
    return routine

@router.post("/{routine_id}/restore", response_model=RoutineResponse)
def restore_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore an archived routine."""
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == current_user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    routine.archived_at = None
    db.commit()
    db.refresh(routine)
    return routine

@router.delete("/{routine_id}")
def delete_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a routine. Unlinks any existing sessions so history is preserved."""
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == current_user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    from app.models.session import Session as DBSession
    db.query(DBSession).filter(DBSession.routine_id == routine_id).update({"routine_id": None})
    
    db.delete(routine)
    db.commit()
    return {"detail": "Routine deleted"}
