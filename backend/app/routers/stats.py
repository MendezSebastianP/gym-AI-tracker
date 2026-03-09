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
    prefix="/api/stats",
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

@router.get("/muscles")
def get_muscle_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns volume and sets breakdown by muscle group."""
    from app.models.exercise import Exercise

    # Join sets -> sessions -> exercises, filter for completed sessions of this user
    rows = (
        db.query(
            Exercise.muscle_group,
            func.count(SetModel.id).label("total_sets"),
            func.sum(
                func.coalesce(SetModel.weight_kg, Exercise.default_weight_kg) *
                func.coalesce(SetModel.reps, 0)
            ).label("total_volume"),
            func.count(func.distinct(SessionModel.id)).label("total_sessions")
        )
        .join(SessionModel, SetModel.session_id == SessionModel.id)
        .join(Exercise, SetModel.exercise_id == Exercise.id)
        .filter(
            SessionModel.user_id == current_user.id,
            SessionModel.completed_at.isnot(None),
            SetModel.reps > 0
        )
        .group_by(Exercise.muscle_group)
        .all()
    )

    result = []
    for row in rows:
        result.append({
            "muscle_group": row.muscle_group or "Other",
            "total_sets": row.total_sets or 0,
            "total_volume": int(row.total_volume or 0),
            "total_sessions": row.total_sessions or 0,
        })

    result.sort(key=lambda x: x["total_volume"], reverse=True)
    return result


def _compute_progress(db, user_id: int, muscle_group: str = None, muscle: str = None, exercise_id: int = None):
    """Shared NSS computation for both authenticated and demo progress."""
    from app.models.exercise import Exercise

    # Get all completed sessions for the user, ordered chronologically
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user_id, SessionModel.completed_at.isnot(None))
        .order_by(SessionModel.completed_at.asc())
        .all()
    )

    # Get user bodyweight for BW exercises
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.weight:
        user_bw = float(user.weight)
    elif user and user.gender == "female":
        user_bw = 60.0
    elif user and user.gender == "male":
        user_bw = 70.0
    else:
        user_bw = 65.0

    # Build exercise cache
    exercise_cache = {}

    result = []
    for idx, session in enumerate(sessions):
        # Get sets for this session
        sets_query = db.query(SetModel).filter(SetModel.session_id == session.id, SetModel.reps > 0)

        # Apply filters via exercise join
        if muscle_group or muscle or exercise_id:
            sets_query = sets_query.join(Exercise, SetModel.exercise_id == Exercise.id)
            if exercise_id:
                sets_query = sets_query.filter(Exercise.id == exercise_id)
            elif muscle:
                sets_query = sets_query.filter(Exercise.muscle == muscle)
            elif muscle_group:
                sets_query = sets_query.filter(Exercise.muscle_group == muscle_group)

        sets = sets_query.all()
        if not sets:
            continue

        session_nss = 0.0
        for s in sets:
            # Cache exercise data
            if s.exercise_id not in exercise_cache:
                ex = db.query(Exercise).filter(Exercise.id == s.exercise_id).first()
                exercise_cache[s.exercise_id] = ex
            ex = exercise_cache[s.exercise_id]
            if not ex:
                continue

            eff_reps = min(s.reps, 30)

            if ex.is_bodyweight:
                bw_ratio = ex.bw_ratio or 0.65
                effective_weight = user_bw * bw_ratio
                est_1rm = effective_weight * (1 + eff_reps / 30.0)
                session_nss += est_1rm
            else:
                weight = s.weight_kg or 0
                if weight <= 0:
                    continue
                df = ex.difficulty_factor or 1.0
                est_1rm = weight * (1 + eff_reps / 30.0) * df
                session_nss += est_1rm

        result.append({
            "session_number": len(result) + 1,
            "date": session.completed_at.isoformat() if session.completed_at else None,
            "nss": round(session_nss, 1),
        })

    return result


@router.get("/progress")
def get_progress(
    muscle_group: str = None,
    muscle: str = None,
    exercise_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns per-session NSS for the authenticated user."""
    return _compute_progress(db, current_user.id, muscle_group, muscle, exercise_id)


@router.get("/progress/demo")
def get_progress_demo(
    muscle_group: str = None,
    muscle: str = None,
    exercise_id: int = None,
    db: Session = Depends(get_db),
):
    """Returns per-session NSS for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return []
    return _compute_progress(db, demo_user.id, muscle_group, muscle, exercise_id)


