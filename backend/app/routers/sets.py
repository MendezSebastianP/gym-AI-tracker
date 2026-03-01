from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.session import Session as SessionModel, Set as SetModel
from app.schemas import SetResponse, SetCreate, SetUpdate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/sets",
    tags=["sets"]
)

@router.post("", response_model=SetResponse)
def create_set(
    set_data: SetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # session_id is now part of SetCreate body
    session_id = set_data.session_id

    # Verify session ownership
    db_session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.user_id == current_user.id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    set_dict = set_data.model_dump()
    set_dict.pop("session_id")  # already used above; SetModel gets it explicitly
    db_set = SetModel(**set_dict, session_id=session_id)
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    return db_set

@router.put("/{set_id}", response_model=SetResponse)
def update_set(
    set_id: int,
    set_update: SetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Join with Session to check user_id
    db_set = db.query(SetModel).join(SessionModel).filter(SetModel.id == set_id, SessionModel.user_id == current_user.id).first()
    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found")

    for key, value in set_update.model_dump(exclude_unset=True).items():
        setattr(db_set, key, value)
    
    db.commit()
    db.refresh(db_set)
    return db_set

@router.delete("/{set_id}")
def delete_set(
    set_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_set = db.query(SetModel).join(SessionModel).filter(SetModel.id == set_id, SessionModel.user_id == current_user.id).first()
    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found")
    
    db.delete(db_set)
    db.commit()
    return {"ok": True}
