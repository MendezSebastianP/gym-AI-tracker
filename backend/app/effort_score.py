"""Effort score computation for completed sessions (informational only)."""
from __future__ import annotations

from typing import Dict, Iterable, Optional

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session as SessionModel, Set as SetModel
from app.models.user import User


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _is_normal_set_filter():
    return sa_func.coalesce(SetModel.set_type, "normal") == "normal"


def _session_volume(sets: Iterable[SetModel]) -> float:
    total = 0.0
    for s in sets:
        weight = float(s.weight_kg or 0)
        reps = int(s.reps or 0)
        if reps <= 0:
            continue
        total += weight * reps
    return total


def _volume_factor(db: DBSession, user_id: int, session: SessionModel, current_volume: float) -> float:
    if not session.completed_at:
        return 50.0

    previous_sessions = (
        db.query(SessionModel.id)
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.completed_at.isnot(None),
            SessionModel.id != session.id,
            SessionModel.completed_at < session.completed_at,
        )
        .order_by(SessionModel.completed_at.desc())
        .limit(10)
        .all()
    )
    prev_ids = [sid for (sid,) in previous_sessions]

    if not prev_ids:
        return 50.0

    volumes = []
    for sid in prev_ids:
        prev_sets = (
            db.query(SetModel)
            .filter(SetModel.session_id == sid, _is_normal_set_filter())
            .all()
        )
        volumes.append(_session_volume(prev_sets))

    if not volumes:
        return 50.0

    avg_volume = sum(volumes) / len(volumes)
    if avg_volume <= 0:
        return 50.0

    ratio = current_volume / avg_volume
    # Tuned to match product examples: 1.0 -> 50, 1.1 -> ~73, 1.25+ capped at 100.
    return _clamp(50.0 + ((ratio - 1.0) * 230.0), 0.0, 100.0)


def _failure_factor(current_sets: list[SetModel]) -> float:
    exercise_ids = {s.exercise_id for s in current_sets}
    if not exercise_ids:
        return 0.0

    total = len(exercise_ids)
    # Realistic ceiling: failing the last set of half your exercises is already
    # very intense. Cap both the denominator and the numerator at total/2 so
    # that "last set to failure on half the exercises" scores 100.
    cap = total / 2.0
    failed_exercises = len({
        s.exercise_id
        for s in current_sets
        if bool(s.to_failure)
    })
    capped_failed = min(float(failed_exercises), cap)
    return (capped_failed / cap) * 100.0


def _self_rating_factor(session: SessionModel) -> float:
    if session.self_rated_effort is None:
        return 50.0
    rating = int(_clamp(float(session.self_rated_effort), 1.0, 10.0))
    return float(rating * 10)


def _progression_factor(db: DBSession, user_id: int, session: SessionModel, current_sets: list[SetModel]) -> float:
    if not session.completed_at:
        return 50.0

    sets_by_exercise: Dict[int, list[SetModel]] = {}
    for s in current_sets:
        sets_by_exercise.setdefault(s.exercise_id, []).append(s)

    if not sets_by_exercise:
        return 50.0

    comparable = 0
    progressed = 0

    for exercise_id, ex_sets in sets_by_exercise.items():
        prev_best = (
            db.query(
                sa_func.max(SetModel.weight_kg).label("max_weight"),
                sa_func.max(SetModel.reps).label("max_reps"),
            )
            .join(SessionModel, SessionModel.id == SetModel.session_id)
            .filter(
                SessionModel.user_id == user_id,
                SessionModel.completed_at.isnot(None),
                SessionModel.id != session.id,
                SessionModel.completed_at < session.completed_at,
                SetModel.exercise_id == exercise_id,
                _is_normal_set_filter(),
            )
            .first()
        )

        prev_weight = float(prev_best.max_weight or 0) if prev_best else 0.0
        prev_reps = int(prev_best.max_reps or 0) if prev_best else 0

        if prev_weight <= 0 and prev_reps <= 0:
            continue

        comparable += 1
        curr_weight = max(float(s.weight_kg or 0) for s in ex_sets)
        curr_reps = max(int(s.reps or 0) for s in ex_sets)

        if (curr_weight > prev_weight) or (curr_reps > prev_reps):
            progressed += 1

    if comparable == 0:
        return 50.0  # no prior data to compare — neutral, don't penalise

    # Scale: 0% progressed = 10 (not pushing beyond history), 100% progressed = 100.
    return 10.0 + (progressed / comparable) * 90.0


def compute_effort_score(db: DBSession, user_id: int, session: SessionModel) -> Optional[float]:
    """Compute a 0-100 effort score for a completed session.
    Returns None if no self-rated effort was recorded (user opted out for that session)."""
    if session.self_rated_effort is None:
        return None

    # No score for the very first session — nothing to compare against
    has_prior = db.query(SessionModel.id).filter(
        SessionModel.user_id == user_id,
        SessionModel.completed_at.isnot(None),
        SessionModel.id != session.id,
    ).limit(1).first()
    if not has_prior:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    settings = (user.settings or {}) if user else {}

    current_sets = (
        db.query(SetModel)
        .filter(SetModel.session_id == session.id, _is_normal_set_filter())
        .all()
    )

    current_volume = _session_volume(current_sets)
    volume_factor = _volume_factor(db, user_id, session, current_volume)
    self_factor = _self_rating_factor(session)
    progression_factor = _progression_factor(db, user_id, session, current_sets)

    failure_enabled = bool(settings.get("failure_tracking_enabled"))

    if failure_enabled:
        failure_factor = _failure_factor(current_sets)
        score = (
            (volume_factor * 0.15)
            + (failure_factor * 0.30)
            + (self_factor * 0.30)
            + (progression_factor * 0.25)
        )
    else:
        # Redistributed weights when failure tracking is disabled.
        score = (
            (volume_factor * 0.27)
            + (self_factor * 0.40)
            + (progression_factor * 0.33)
        )

    return round(_clamp(score, 0.0, 100.0), 1)
