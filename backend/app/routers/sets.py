from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
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


def _find_existing_normal_set(db: Session, session_id: int, exercise_id: int, set_number: int) -> SetModel | None:
    """Return the existing normal set with this slot (if any) — used by the
    create endpoint to upsert instead of duplicating when the client retries."""
    return (
        db.query(SetModel)
        .filter(
            SetModel.session_id == session_id,
            SetModel.exercise_id == exercise_id,
            SetModel.set_number == set_number,
            func.coalesce(SetModel.set_type, 'normal') == 'normal',
        )
        .first()
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

    # Dedupe for normal sets: if a row with the same
    # (session_id, exercise_id, set_number) already exists, return it
    # WITHOUT overwriting. Updates must go through PUT explicitly.
    #
    # Why no overwrite: when an offline-first client has an empty local
    # cache (e.g. iOS Dexie eviction), opening an old completed session
    # used to trigger a prefill that POSTed sets matching existing slots
    # but with CURRENT routine values, silently overwriting history.
    # POST is "create if missing"; PUT is "update". Keep them honest.
    if (set_dict.get("set_type") or "normal") == "normal":
        existing = _find_existing_normal_set(
            db, session_id, set_dict["exercise_id"], set_dict["set_number"]
        )
        if existing:
            return existing

    db_set = SetModel(**set_dict, session_id=session_id)
    db.add(db_set)
    try:
        db.commit()
    except IntegrityError:
        # Unique partial index caught a race we didn't catch above —
        # roll back and return the existing row unchanged.
        db.rollback()
        existing = _find_existing_normal_set(
            db, session_id, set_dict["exercise_id"], set_dict["set_number"]
        )
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Set conflict")
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
