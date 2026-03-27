from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.weight_log import WeightLog
from app.schemas import WeightLogCreate, WeightLogResponse

router = APIRouter(prefix="/api/weight", tags=["weight"])


@router.post("", response_model=WeightLogResponse)
def log_weight(
    data: WeightLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = WeightLog(
        user_id=current_user.id,
        weight_kg=data.weight_kg,
        measured_at=data.measured_at or datetime.now(timezone.utc),
        source="manual",
    )
    db.add(entry)

    # Keep User.weight in sync (round to int for backward compat)
    current_user.weight = round(data.weight_kg)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("")
def get_weight_history(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.session import Session as SessionModel

    def _aware(dt):
        return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Explicit weight logs
    logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id, WeightLog.measured_at >= cutoff)
        .order_by(desc(WeightLog.measured_at))
        .all()
    )
    result = [
        {"id": l.id, "weight_kg": l.weight_kg, "measured_at": _aware(l.measured_at).isoformat(), "source": l.source}
        for l in logs
    ]

    # Fill gaps: session bodyweight for dates not covered by an explicit log
    covered = {_aware(l.measured_at).date() for l in logs}
    sessions_with_bw = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == current_user.id,
            SessionModel.completed_at.isnot(None),
            SessionModel.bodyweight_kg.isnot(None),
            SessionModel.started_at >= cutoff,
        )
        .order_by(desc(SessionModel.started_at))  # latest session wins per day
        .all()
    )
    for s in sessions_with_bw:
        if not s.started_at or s.bodyweight_kg is None:
            continue
        d = _aware(s.started_at).date()
        if d not in covered:
            covered.add(d)
            result.append({"id": 0, "weight_kg": s.bodyweight_kg, "measured_at": _aware(s.started_at).isoformat(), "source": "session"})

    result.sort(key=lambda x: x["measured_at"], reverse=True)
    return result


@router.get("/stats")
def get_weight_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(desc(WeightLog.measured_at))
        .all()
    )
    if not logs:
        return {"current": current_user.weight, "min": None, "max": None, "avg": None, "change_7d": None, "change_30d": None, "count": 0}

    current = logs[0].weight_kg
    weights = [l.weight_kg for l in logs]
    now = datetime.now(timezone.utc)

    def _as_aware(dt):
        return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

    def change_since(days):
        cutoff = now - timedelta(days=days)
        older = [l for l in logs if _as_aware(l.measured_at) <= cutoff]
        if older:
            return round(current - older[0].weight_kg, 1)
        return None

    return {
        "current": current,
        "min": min(weights),
        "max": max(weights),
        "avg": round(sum(weights) / len(weights), 1),
        "change_7d": change_since(7),
        "change_30d": change_since(30),
        "count": len(logs),
    }


@router.put("/{log_id}")
def update_weight_log(
    log_id: int,
    data: WeightLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeightLog).filter(WeightLog.id == log_id, WeightLog.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Weight log not found")
    entry.weight_kg = data.weight_kg
    if data.measured_at:
        entry.measured_at = data.measured_at
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "weight_kg": entry.weight_kg, "measured_at": entry.measured_at.isoformat(), "source": entry.source}


@router.get("/demo")
def get_weight_history_demo(days: int = 90, db: Session = Depends(get_db)):
    """Returns weight history for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == demo_user.id, WeightLog.measured_at >= cutoff)
        .order_by(desc(WeightLog.measured_at))
        .all()
    )
    return [{"id": l.id, "weight_kg": l.weight_kg, "measured_at": l.measured_at.isoformat(), "source": l.source} for l in logs]


@router.get("/stats/demo")
def get_weight_stats_demo(db: Session = Depends(get_db)):
    """Returns weight stats for the demo user (no auth required)."""
    demo_user = db.query(User).filter(User.email == "demo@gymtracker.app").first()
    if not demo_user:
        return {"current": None, "min": None, "max": None, "avg": None, "change_7d": None, "change_30d": None, "count": 0}
    logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == demo_user.id)
        .order_by(desc(WeightLog.measured_at))
        .all()
    )
    if not logs:
        return {"current": demo_user.weight, "min": None, "max": None, "avg": None, "change_7d": None, "change_30d": None, "count": 0}
    current = logs[0].weight_kg
    weights = [l.weight_kg for l in logs]
    now = datetime.now(timezone.utc)

    def _as_aware(dt):
        return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

    def change_since(days_back):
        cutoff = now - timedelta(days=days_back)
        older = [l for l in logs if _as_aware(l.measured_at) <= cutoff]
        return round(current - older[0].weight_kg, 1) if older else None

    return {
        "current": current, "min": min(weights), "max": max(weights),
        "avg": round(sum(weights) / len(weights), 1),
        "change_7d": change_since(7), "change_30d": change_since(30), "count": len(logs),
    }


@router.delete("/{log_id}")
def delete_weight_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(WeightLog).filter(WeightLog.id == log_id, WeightLog.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Weight log not found")
    db.delete(entry)
    db.commit()
    return {"message": "Deleted"}
