from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.session import Session as SessionModel, Set as SetModel
from app.dependencies import get_current_user
from app.models.user import User
from sqlalchemy import func, desc
from typing import List, Dict, Any
from datetime import datetime, timedelta, date

router = APIRouter(
    prefix="/stats",
    tags=["stats"]
)

@router.get("/weekly")
def get_weekly_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Total Sessions
    total_sessions = db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None)
    ).count()

    # 2. Total Volume (Lifetime)
    # Join sessions and sets to ensure we only count sets from completed sessions of this user
    # Volume = sum(weight_kg * reps) where weight_kg > 0
    total_volume_query = db.query(func.sum(SetModel.weight_kg * SetModel.reps)).join(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None),
        SetModel.weight_kg > 0,
        SetModel.reps > 0
    )
    total_volume = total_volume_query.scalar() or 0

    # 3. Fetch session dates for charting and streaks
    # Get all completed session dates, ordered by date desc
    sessions_dates = db.query(SessionModel.completed_at).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None)
    ).order_by(desc(SessionModel.completed_at)).all()
    
    # Convert to list of datetime objects
    dates = [s[0] for s in sessions_dates if s[0]]

    # 4. Weekly Stats (Last 8 weeks)
    # 0 = Current week, 1 = Last week, etc.
    weekly_counts = [0] * 8
    today = datetime.now().date()
    # Find start of current week (Monday)
    start_of_week = today - timedelta(days=today.weekday())
    
    weekly_counts = []
    # Fill array [Week-7, ..., Week-0] (left to right = oldest to newest)
    for i in range(7, -1, -1):
        target_start = start_of_week - timedelta(weeks=i)
        target_end = target_start + timedelta(days=6)
        
        count = sum(1 for d in dates if target_start <= d.date() <= target_end)
        weekly_counts.append(count)

    # 5. Daily Stats (Last 7 days)
    daily_counts = [0] * 7
    for i in range(7):
        target_day = today - timedelta(days=6 - i)  # Index 6 is today, 0 is 6 days ago
        daily_counts[i] = sum(1 for d in dates if d.date() == target_day)

    # 6. Active Streak (Weeks)
    streak_weeks = 0
    
    # Start checking backwards from the current week
    for i in range(52):  # Max lookback is 52 weeks
        target_start = start_of_week - timedelta(weeks=i)
        target_end = target_start + timedelta(days=6)
        
        has_session = any(target_start <= d.date() <= target_end for d in dates)
        
        if has_session:
            streak_weeks += 1
        else:
            # If current week has no session, it's allowed (streak from last week hasn't died yet)
            if i == 0:
                continue
            break

    return {
        "sessions": total_sessions,
        "volume": int(total_volume),
        "weekly_sessions": weekly_counts,
        "daily_sessions": daily_counts,
        "streak_weeks": streak_weeks
    }
