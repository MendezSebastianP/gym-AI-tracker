from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models.routine import Routine
from app.schemas import RoutineResponse, RoutineCreate, RoutineUpdate
from app.dependencies import get_current_user
from app.models.user import User
from app.models.ai_usage_log import AIUsageLog
from sqlalchemy.sql import func
from app.onboarding import mark_onboarding_step

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
    routine_dict = routine.model_dump()
    ai_usage_id = routine_dict.pop('ai_usage_id', None)
    db_routine = Routine(**routine_dict, user_id=current_user.id)
    db.add(db_routine)
    db.commit()
    db.refresh(db_routine)

    # Always mark this step once the user has at least one routine.
    # This also repairs older accounts that had routines before onboarding tracking.
    mark_onboarding_step(current_user, "first_routine")
    db.commit()
    
    # Handle AI conversion tracking
    if hasattr(routine, 'ai_usage_id') and routine.ai_usage_id:
        log = db.query(AIUsageLog).filter_by(id=routine.ai_usage_id, user_id=current_user.id).first()
        if log and log.status == "generated":
            # calculate retention
            ai_exercises = []
            if log.suggested_routine and 'days' in log.suggested_routine:
                for day in log.suggested_routine['days']:
                    for ex in day.get('exercises', []):
                        eid = ex.get('exercise_id')
                        if eid:
                            ai_exercises.append(eid)
            
            saved_exercises = []
            if db_routine.days:
                for day in db_routine.days:
                    for ex in day.get('exercises', []):
                        eid = ex.get('exercise_id')
                        if eid:
                            saved_exercises.append(eid)
            
            if len(ai_exercises) > 0:
                kept = sum(1 for ex_id in saved_exercises if ex_id in ai_exercises)
                retention = (kept / len(ai_exercises)) * 100
                log.retention_percentage = round(retention, 2)
            else:
                log.retention_percentage = 0.0
                
            log.status = "saved"
            log.saved_routine_id = db_routine.id
            log.saved_at = func.now()
            db.commit()

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
