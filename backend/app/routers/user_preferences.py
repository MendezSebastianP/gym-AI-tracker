from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference
from pydantic import BaseModel
from typing import Optional, List, Any
from app.onboarding import apply_questionnaire_level

router = APIRouter(prefix="/api/preferences", tags=["preferences"])

class UserPreferenceUpdate(BaseModel):
    primary_goal: Optional[str] = None
    split_preference: Optional[str] = None
    strength_logic: Optional[str] = None
    cardio_preference: Optional[str] = None
    experience_level: Optional[str] = None
    available_equipment: Optional[List[str]] = None
    training_days: Optional[int] = None
    session_duration: Optional[str] = None
    sleep_quality: Optional[str] = None
    active_job: Optional[str] = None
    progression_pace: Optional[str] = None
    has_injuries: Optional[str] = None
    injured_areas: Optional[List[str]] = None
    other_information: Optional[str] = None
    context_level: Optional[int] = None

@router.get("")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        return {}
    
    return {
        "primary_goal": pref.primary_goal,
        "split_preference": pref.split_preference,
        "strength_logic": pref.strength_logic,
        "cardio_preference": pref.cardio_preference,
        "experience_level": pref.experience_level,
        "available_equipment": pref.available_equipment,
        "training_days": pref.training_days,
        "session_duration": pref.session_duration,
        "sleep_quality": pref.sleep_quality,
        "active_job": pref.active_job,
        "progression_pace": pref.progression_pace,
        "has_injuries": pref.has_injuries,
        "injured_areas": pref.injured_areas,
        "other_information": pref.other_information,
        "context_level": pref.context_level,
    }

@router.put("")
def update_preferences(
    prefs: UserPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
    
    update_data = prefs.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)

    if prefs.context_level is not None:
        apply_questionnaire_level(current_user, prefs.context_level)
        
    db.commit()
    db.refresh(pref)
    return {"message": "Preferences updated successfully"}
