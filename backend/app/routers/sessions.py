from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.session import Session as SessionModel, Set as SetModel
from app.schemas import SessionResponse, SessionCreate, SessionUpdate, SetResponse
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/sessions",
    tags=["sessions"]
)

@router.get("", response_model=List[SessionResponse])
def get_sessions(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(SessionModel).filter(SessionModel.user_id == current_user.id)\
        .order_by(SessionModel.started_at.desc()).offset(skip).limit(limit).all()
    return sessions

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(SessionModel).filter(SessionModel.id == session_id, SessionModel.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.post("", response_model=SessionResponse)
def create_session(
    session: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_data = session.model_dump()
    # If routine_id is provided but the routine doesn't exist for this user,
    # set it to None to avoid FK constraint errors (e.g. from client sync with local IDs)
    if session_data.get("routine_id"):
        from app.models.routine import Routine
        routine = db.query(Routine).filter(
            Routine.id == session_data["routine_id"],
            Routine.user_id == current_user.id
        ).first()
        if not routine:
            session_data["routine_id"] = None
    db_session = SessionModel(**session_data, user_id=current_user.id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.put("/{session_id}")
def update_session(
    session_id: int,
    session_update: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = db.query(SessionModel).filter(SessionModel.id == session_id, SessionModel.user_id == current_user.id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    was_completed = db_session.completed_at is not None
    
    for key, value in session_update.model_dump(exclude_unset=True).items():
        setattr(db_session, key, value)
    
    db.commit()
    db.refresh(db_session)

    response = SessionResponse.model_validate(db_session).model_dump()

    # Trigger gamification when session is marked complete for the first time
    if not was_completed and db_session.completed_at is not None:
        from app.gamification import award_session_xp
        gamification_result = award_session_xp(db, current_user, session_id)
        response["gamification"] = gamification_result

    return response

@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(db_session)
    db.commit()
    return {"ok": True}


@router.get("/demo/history")
def get_demo_sessions(
    skip: int = 0,
    limit: int = 300,
    db: Session = Depends(get_db),
):
    """Return completed sessions for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.is_demo == True).first()
    if not demo_user:
        return []
        
    from app.models.routine import Routine
    sessions = db.query(SessionModel, Routine).outerjoin(
        Routine, SessionModel.routine_id == Routine.id
    ).filter(
        SessionModel.user_id == demo_user.id,
        SessionModel.completed_at.isnot(None)
    ).order_by(SessionModel.started_at.desc()).offset(skip).limit(limit).all()

    result = []
    for s, r in sessions:
        sets = db.query(SetModel).filter(SetModel.session_id == s.id).all()
        day_name = "Unknown"
        routine_name = r.name if r else "Unknown Routine"
        if r and r.days and len(r.days) > s.day_index:
            day_name = r.days[s.day_index].get("day_name", "Unknown")

        result.append({
            "id": s.id,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "routine_id": s.routine_id,
            "routine_name": routine_name,
            "day_name": day_name,
            "day_index": s.day_index,
            "set_count": len(sets),
        })
    return result
