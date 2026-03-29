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
        func.coalesce(SetModel.set_type, "normal") == "normal",
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

    # 7. Duration stats
    duration_sessions = db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.completed_at.isnot(None),
        SessionModel.duration_seconds.isnot(None),
        SessionModel.duration_seconds > 0
    ).all()
    total_duration = sum(s.duration_seconds for s in duration_sessions)
    avg_duration = int(total_duration / len(duration_sessions)) if duration_sessions else 0

    return {
        "sessions": total_sessions,
        "volume": int(total_volume),
        "weekly_sessions": weekly_counts,
        "daily_sessions": daily_counts,
        "streak_weeks": streak_weeks,
        "total_duration_seconds": total_duration,
        "avg_duration_seconds": avg_duration,
        "tracked_duration_sessions": len(duration_sessions)
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
            func.coalesce(SetModel.set_type, "normal") == "normal",
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
        # Override the base user_bw with the snapshot from the session, if it exists
        session_bw = float(session.bodyweight_kg) if session.bodyweight_kg else user_bw

        # Get sets for this session
        sets_query = db.query(SetModel).filter(
            SetModel.session_id == session.id,
            SetModel.reps > 0,
            func.coalesce(SetModel.set_type, "normal") == "normal",
        )

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

            weight = s.weight_kg or 0

            if ex.is_bodyweight:
                bw_ratio = ex.bw_ratio or 0.65
                
                if 'Assisted' in ex.name:
                    if weight == 0:
                        # Logged at 0kg assistance - treat as unassisted
                        bw_ratio = 0.85 if 'Dip' in ex.name else 1.0
                        effective_weight = session_bw * bw_ratio
                    elif weight > 0:
                        # Logged with assistance > 0. Weight represents reduction.
                        effective_weight = max(0, session_bw - weight) * bw_ratio
                    else:
                        # Logged with negative weight (unusual for Assisted class, but theoretically reduced)
                        effective_weight = max(0, session_bw + weight) * bw_ratio
                else:
                    if weight < 0:
                        # Normal exercise, but negative weight implies band/assistance
                        effective_weight = max(0, session_bw + weight) * bw_ratio
                    else:
                        # Normal exercise with pos weight = extra weighted plates
                        effective_weight = (session_bw * bw_ratio) + weight

                est_1rm = effective_weight * (1 + eff_reps / 30.0)
                session_nss += est_1rm
            else:
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


def _compute_effort_trend(db, user_id: int, limit: int = 12) -> List[Dict[str, Any]]:
    """Reusable effort trend points for any user (0-100 scale)."""
    safe_limit = max(1, min(limit, 40))
    rows = (
        db.query(
            SessionModel.completed_at,
            SessionModel.effort_score,
            SessionModel.self_rated_effort,
        )
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.completed_at.isnot(None),
        )
        .order_by(SessionModel.completed_at.asc())
        .all()
    )

    points: List[Dict[str, Any]] = []
    for completed_at, effort_score, self_rated_effort in rows:
        effort_value = effort_score
        if effort_value is None and self_rated_effort is not None:
            effort_value = float(self_rated_effort) * 10.0
        if effort_value is None:
            continue

        clamped = max(0.0, min(100.0, float(effort_value)))
        points.append({
            "date": completed_at.date().isoformat() if completed_at else None,
            "effort": round(clamped, 1),
        })

    points = points[-safe_limit:]
    return [
        {
            "index": idx + 1,
            "date": point["date"],
            "effort": point["effort"],
        }
        for idx, point in enumerate(points)
    ]


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


@router.get("/effort")
def get_effort_trend(
    limit: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns recent session effort trend points for the authenticated user."""
    return _compute_effort_trend(db, current_user.id, limit)


@router.get("/cardio")
def get_cardio_stats(
    days: int = 90,
    exercise_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns cardio statistics: totals and trends for distance/pace."""
    return _compute_cardio_stats(db, current_user.id, days, exercise_id)


def _compute_cardio_exercises(db, user_id: int, days: int = 100):
    """Returns [{exercise_id, name, session_count}] for a user sorted by session_count desc."""
    from app.models.exercise import Exercise
    from sqlalchemy import func as sqlfunc

    cutoff = datetime.now() - timedelta(days=days)
    rows = (
        db.query(
            Exercise.id.label("exercise_id"),
            Exercise.name.label("name"),
            sqlfunc.count(sqlfunc.distinct(SessionModel.id)).label("session_count"),
        )
        .join(SetModel, SetModel.exercise_id == Exercise.id)
        .join(SessionModel, SetModel.session_id == SessionModel.id)
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.completed_at.isnot(None),
            SessionModel.completed_at >= cutoff,
            SetModel.distance_km.isnot(None),
            SetModel.distance_km > 0,
        )
        .group_by(Exercise.id, Exercise.name)
        .order_by(sqlfunc.count(sqlfunc.distinct(SessionModel.id)).desc())
        .all()
    )
    return [{"exercise_id": r.exercise_id, "name": r.name, "session_count": r.session_count} for r in rows]


def _compute_cardio_stats(db, user_id: int, days: int = 90, exercise_id: int = None):
    """Reusable cardio stats computation for any user."""
    from app.models.exercise import Exercise

    cutoff = datetime.now() - timedelta(days=days)
    query = (
        db.query(
            SetModel.distance_km,
            SetModel.duration_sec,
            SetModel.avg_pace,
            SessionModel.completed_at,
            Exercise.name.label("exercise_name"),
        )
        .join(SessionModel, SetModel.session_id == SessionModel.id)
        .join(Exercise, SetModel.exercise_id == Exercise.id)
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.completed_at.isnot(None),
            SessionModel.completed_at >= cutoff,
            SetModel.distance_km.isnot(None),
            SetModel.distance_km > 0,
        )
    )
    if exercise_id:
        query = query.filter(Exercise.id == exercise_id)
    query = query.order_by(SessionModel.completed_at.asc())
    rows = query.all()

    total_distance = 0.0
    total_duration = 0
    total_sessions_set = set()
    distance_trend = []
    pace_trend = []

    for row in rows:
        total_distance += row.distance_km
        total_duration += row.duration_sec or 0
        session_date = row.completed_at.date().isoformat() if row.completed_at else None
        total_sessions_set.add(session_date)
        distance_trend.append({"date": session_date, "distance_km": round(row.distance_km, 2), "exercise": row.exercise_name})
        pace = row.avg_pace
        if not pace and row.duration_sec and row.distance_km > 0:
            pace = row.duration_sec / row.distance_km
        if pace:
            pace_trend.append({"date": session_date, "avg_pace": round(pace, 1), "exercise": row.exercise_name})

    avg_pace = round(total_duration / total_distance, 1) if total_distance > 0 else None
    return {
        "total_distance_km": round(total_distance, 2),
        "total_duration_sec": total_duration,
        "total_sessions": len(total_sessions_set),
        "avg_pace": avg_pace,
        "distance_trend": distance_trend,
        "pace_trend": pace_trend,
    }


@router.get("/cardio/exercises")
def get_cardio_exercises(
    days: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns exercises the user has logged cardio sets for, sorted by session count."""
    return _compute_cardio_exercises(db, current_user.id, days)


@router.get("/cardio/exercises/demo")
def get_cardio_exercises_demo(days: int = 100, db: Session = Depends(get_db)):
    """Returns cardio exercises for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return []
    return _compute_cardio_exercises(db, demo_user.id, days)


@router.get("/effort/demo")
def get_effort_trend_demo(
    limit: int = 12,
    db: Session = Depends(get_db),
):
    """Returns recent effort trend points for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return []
    return _compute_effort_trend(db, demo_user.id, limit)


@router.get("/cardio/demo")
def get_cardio_stats_demo(
    days: int = 90,
    exercise_id: int = None,
    db: Session = Depends(get_db),
):
    """Returns cardio stats for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return {"total_distance_km": 0, "total_duration_sec": 0, "total_sessions": 0, "avg_pace": None, "distance_trend": [], "pace_trend": []}
    return _compute_cardio_stats(db, demo_user.id, days, exercise_id)


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
