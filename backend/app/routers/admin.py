from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.ai_usage_log import AIUsageLog
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.exercise import Exercise
from app.schemas import ExerciseCreate, ExerciseResponse, ExerciseUpdateAdmin

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/ai/report")
def get_ai_usage_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a financial and conversion report for AI usage.
    In a real production app, this would be locked to Admin users only.
    """
    # Calculate total costs
    total_cost = db.query(func.sum(AIUsageLog.cost_usd)).scalar() or 0.0
    total_tokens = db.query(func.sum(AIUsageLog.total_tokens)).scalar() or 0
    
    # Calculate generations vs saves
    total_generations = db.query(AIUsageLog).count()
    total_saves = db.query(AIUsageLog).filter(AIUsageLog.status == "saved").count()
    conversion_rate = (total_saves / total_generations * 100) if total_generations > 0 else 0.0
    
    # Calculate average retention
    avg_retention = db.query(func.avg(AIUsageLog.retention_percentage)).filter(AIUsageLog.status == "saved").scalar() or 0.0
    
    # Top users by generation count
    top_users_query = (
        db.query(
            User.email,
            func.count(AIUsageLog.id).label("generations"),
            func.sum(AIUsageLog.cost_usd).label("total_cost")
        )
        .join(User, AIUsageLog.user_id == User.id)
        .group_by(User.email)
        .order_by(func.count(AIUsageLog.id).desc())
        .limit(5)
        .all()
    )
    
    top_users = [
        {"email": u[0], "generations": u[1], "total_cost": round(u[2], 4)}
        for u in top_users_query
    ]
    
    return {
        "financials": {
            "total_cost_usd": round(total_cost, 4),
            "total_tokens": total_tokens
        },
        "conversion": {
            "total_generations": total_generations,
            "total_saved": total_saves,
            "conversion_rate_percentage": round(conversion_rate, 2),
            "average_retention_percentage": round(avg_retention, 2)
        },
        "top_users": top_users
    }

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a list of all registered users with their basic stats.
    Requires admin privileges.
    """
    users = db.query(User).order_by(User.id.desc()).all()
    
    result = []
    for u in users:
        # Get count of sessions for this user to show activity level
        session_count = db.query(SessionModel).filter(SessionModel.user_id == u.id).count()
        
        result.append({
            "id": u.id,
            "email": u.email,
            "is_active": u.is_active,
            "is_demo": u.is_demo,
            "level": u.level,
            "session_count": session_count,
        })
        
    return result

@router.post("/exercises", response_model=ExerciseResponse)
def create_global_exercise(
    exercise: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new global exercise (Admin only)"""
    new_ex = Exercise(**exercise.model_dump(), source="global")
    db.add(new_ex)
    db.commit()
    db.refresh(new_ex)
    return new_ex

@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
def update_global_exercise(
    exercise_id: int,
    exercise_update: ExerciseUpdateAdmin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a global exercise (Admin only)"""
    db_ex = db.query(Exercise).filter(Exercise.id == exercise_id, Exercise.source == "global").first()
    if not db_ex:
        raise HTTPException(status_code=404, detail="Global exercise not found")
        
    update_data = exercise_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ex, key, value)
        
    db.commit()
    db.refresh(db_ex)
    return db_ex

@router.delete("/exercises/{exercise_id}")
def delete_global_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a global exercise (Admin only)"""
    db_ex = db.query(Exercise).filter(Exercise.id == exercise_id, Exercise.source == "global").first()
    if not db_ex:
        raise HTTPException(status_code=404, detail="Global exercise not found")
        
    db.delete(db_ex)
    db.commit()
    return {"message": "Exercise deleted successfully"}
