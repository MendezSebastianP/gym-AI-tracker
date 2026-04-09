"""
Algorithmic progression engine.

Analyses session history for a given exercise and returns science-based
progression suggestions: weight increases, rep adjustments, deloads,
bodyweight chain advances, or cardio increments.

No AI calls — pure Python + DB queries.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, asdict
from typing import Optional

from sqlalchemy import desc, func as sa_func
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session as SessionModel, Set as SetModel
from app.models.exercise import Exercise
from app.models.routine import Routine
from app.models.progression import ExerciseProgression
from app.models.user_preference import UserPreference

logger = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────

# How many sessions to look back
MAX_HISTORY = 10

# Weight increment rules (kg)
WEIGHT_INCREMENTS = {
    "barbell": 2.5,
    "dumbbell": 2.0,
    "machine": 2.5,
    "cable": 2.5,
    "default": 2.5,
    "isolation": 1.0,
}

# Muscles typically trained with isolation movements
ISOLATION_MUSCLES = {
    "Biceps", "Triceps", "Forearms", "Calves",
    "Rear Deltoids", "Lateral Deltoids",
}

# Sessions needed at top-of-range before suggesting weight increase
SESSIONS_FOR_DOUBLE_PROGRESSION = {
    "beginner": 2,     # experience_level 1-3
    "intermediate": 3,  # experience_level 4-7
    "advanced": 3,      # experience_level 8-10
}


# ── Result dataclass ────────────────────────────────────────────────────────

@dataclass
class ProgressionSuggestion:
    type: str  # weight_increase, rep_increase, deload, exercise_swap, bw_progression, cardio_increase, plateau_warning, none
    current: dict  # {weight, reps, sets} or {distance, duration, pace}
    suggested: dict  # same shape as current
    reason: str
    confidence: float  # 0.0–1.0
    # For bw_progression / exercise_swap
    new_exercise_id: Optional[int] = None
    new_exercise_name: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_rep_range(reps_str: str) -> tuple[int, int]:
    """Parse routine rep range like '8-12', '5', '3-5' into (low, high)."""
    if not reps_str:
        return (8, 12)
    reps_str = str(reps_str).strip()
    if "-" in reps_str:
        parts = reps_str.split("-")
        try:
            return (int(parts[0]), int(parts[1]))
        except (ValueError, IndexError):
            return (8, 12)
    try:
        val = int(reps_str)
        return (val, val)
    except ValueError:
        return (8, 12)


def _get_experience_tier(user_id: int, db: DBSession) -> str:
    """Map experience_level to beginner/intermediate/advanced."""
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref or not pref.experience_level:
        return "beginner"
    try:
        level = int(pref.experience_level)
    except (ValueError, TypeError):
        # Legacy string values
        exp = str(pref.experience_level).lower()
        if "begin" in exp:
            return "beginner"
        if "adv" in exp:
            return "advanced"
        return "intermediate"

    if level <= 3:
        return "beginner"
    if level <= 7:
        return "intermediate"
    return "advanced"


def _get_weight_increment(exercise: Exercise) -> float:
    """Determine appropriate weight increment for an exercise."""
    equipment = (exercise.equipment or "").lower()
    muscle = exercise.muscle or ""

    # Isolation exercises get smaller increments
    if muscle in ISOLATION_MUSCLES:
        return WEIGHT_INCREMENTS["isolation"]

    for key in WEIGHT_INCREMENTS:
        if key in equipment:
            return WEIGHT_INCREMENTS[key]

    return WEIGHT_INCREMENTS["default"]


def _get_session_history(
    user_id: int, exercise_id: int, routine_id: int, db: DBSession, limit: int = MAX_HISTORY
) -> list[dict]:
    """
    Fetch the last N completed sessions containing this exercise, newest first.
    Returns list of {session_id, completed_at, sets: [{weight_kg, reps, set_number}]}
    """
    sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.routine_id == routine_id,
            SessionModel.completed_at.isnot(None),
        )
        .order_by(desc(SessionModel.completed_at))
        .limit(limit * 2)  # fetch extra in case some sessions lack this exercise
        .all()
    )

    history = []
    for sess in sessions:
        exercise_sets = (
            db.query(SetModel)
            .filter(
                SetModel.session_id == sess.id,
                SetModel.exercise_id == exercise_id,
                sa_func.coalesce(SetModel.set_type, "normal") == "normal",
            )
            .order_by(SetModel.set_number)
            .all()
        )
        if not exercise_sets:
            continue
        history.append({
            "session_id": sess.id,
            "completed_at": sess.completed_at,
            "sets": [
                {
                    "weight_kg": s.weight_kg or 0,
                    "reps": s.reps or 0,
                    "duration_sec": s.duration_sec or 0,
                    "distance_km": s.distance_km or 0,
                    "avg_pace": s.avg_pace or 0,
                    "set_number": s.set_number,
                }
                for s in exercise_sets
            ],
        })
        if len(history) >= limit:
            break

    return history


def _find_swap_alternative(
    exercise: Exercise, routine: Routine, day_index: int | None, db: DBSession
) -> tuple[int | None, str | None]:
    """Find a suitable alternative exercise for a swap suggestion.

    Looks for exercises targeting the same muscle, preferring same equipment.
    Excludes exercises already in the routine day.
    Returns (exercise_id, exercise_name) or (None, None).
    """
    # Collect exercise IDs already in the routine (all days) to exclude
    days = routine.days or []
    existing_ids = set()
    for day in days:
        for ex in day.get("exercises", []):
            eid = ex.get("exercise_id")
            if eid:
                existing_ids.add(eid)
    existing_ids.add(exercise.id)

    if not exercise.muscle:
        return None, None

    # Query candidates: same primary muscle, system exercises only, exclude existing
    candidates = (
        db.query(Exercise)
        .filter(
            Exercise.muscle == exercise.muscle,
            Exercise.id.notin_(existing_ids),
            Exercise.user_id.is_(None),  # system exercises only
        )
        .all()
    )

    if not candidates:
        return None, None

    # Score candidates: prefer same equipment, similar difficulty
    def score(c: Exercise) -> float:
        s = 0.0
        if c.equipment and exercise.equipment and c.equipment.lower() == exercise.equipment.lower():
            s += 2.0
        if c.is_bodyweight == exercise.is_bodyweight:
            s += 1.0
        if c.difficulty_level and exercise.difficulty_level:
            s -= abs(c.difficulty_level - exercise.difficulty_level) * 0.3
        return s

    candidates.sort(key=score, reverse=True)
    best = candidates[0]
    return best.id, best.name


def _get_routine_exercise_config(routine: Routine, day_index: int | None, exercise_id: int) -> dict | None:
    """Get the exercise config from routine JSON for a given exercise."""
    days = routine.days or []
    search_days = [days[day_index]] if day_index is not None and day_index < len(days) else days
    for day in search_days:
        for ex in day.get("exercises", []):
            if ex.get("exercise_id") == exercise_id:
                return ex
    return None


# ── Strength analysis ────────────────────────────────────────────────────────

def _analyze_strength(
    history: list[dict],
    exercise: Exercise,
    routine_config: dict | None,
    experience_tier: str,
    db: DBSession | None = None,
    routine: Routine | None = None,
    day_index: int | None = None,
) -> ProgressionSuggestion | None:
    """Apply double progression / linear progression / deload rules for strength exercises."""
    if not history:
        return None

    # Get target rep range from routine config
    reps_str = routine_config.get("reps", "8-12") if routine_config else "8-12"
    rep_low, rep_high = _parse_rep_range(reps_str)
    target_sets = routine_config.get("sets", 3) if routine_config else 3

    # Current performance (most recent session)
    latest = history[0]
    latest_sets = latest["sets"]
    current_weight = max((s["weight_kg"] for s in latest_sets), default=0)
    current_reps_per_set = [s["reps"] for s in latest_sets]
    avg_reps = sum(current_reps_per_set) / len(current_reps_per_set) if current_reps_per_set else 0
    num_sets = len(latest_sets)

    current = {"weight": current_weight, "reps": round(avg_reps, 1), "sets": num_sets}
    is_assisted = "assisted" in (exercise.name or "").lower()

    # ── Double progression: did all sets hit top of range? ───────────
    sessions_needed = SESSIONS_FOR_DOUBLE_PROGRESSION[experience_tier]

    # Check consecutive sessions where all sets >= rep_high
    consecutive_at_top = 0
    for session_data in history:
        sets = session_data["sets"]
        session_weight = max((s["weight_kg"] for s in sets), default=0)
        # Must be at same weight (or higher) as current
        if session_weight < current_weight:
            break
        all_at_top = all(s["reps"] >= rep_high for s in sets) and len(sets) >= target_sets
        if all_at_top:
            consecutive_at_top += 1
        else:
            break

    if consecutive_at_top >= sessions_needed and current_weight > 0:
        increment = _get_weight_increment(exercise)
        suggested_weight = max(0.0, current_weight - increment) if is_assisted else current_weight + increment
        return ProgressionSuggestion(
            type="weight_increase",
            current=current,
            suggested={"weight": suggested_weight, "reps": rep_low, "sets": target_sets},
            reason=f"You've hit {rep_high} reps on all sets for {consecutive_at_top} sessions. Increase to {suggested_weight}kg and aim for {rep_low} reps.",
            confidence=0.9,
        )

    # ── Plateau detection ────────────────────────────────────────────
    if len(history) >= 2:
        plateau_count = 0
        ref_weight = current_weight
        ref_reps = round(avg_reps)
        for session_data in history[:6]:
            sets = session_data["sets"]
            sw = max((s["weight_kg"] for s in sets), default=0)
            sr = sum(s["reps"] for s in sets) / len(sets) if sets else 0
            if abs(sw - ref_weight) < 0.01 and abs(sr - ref_reps) <= 1:
                plateau_count += 1
            else:
                break

        if plateau_count >= 4:
            alt_id, alt_name = (None, None)
            if db and routine:
                alt_id, alt_name = _find_swap_alternative(exercise, routine, day_index, db)
            reason = f"You've been at {current_weight}kg × ~{ref_reps} reps for {plateau_count} sessions."
            if alt_name:
                reason += f" Try swapping to {alt_name}."
            else:
                reason += " Consider swapping this exercise or trying a different rep range."
            return ProgressionSuggestion(
                type="exercise_swap",
                current=current,
                suggested=current,
                reason=reason,
                confidence=0.7,
                new_exercise_id=alt_id,
                new_exercise_name=alt_name,
            )

        # ── Pre-plateau warning (2-3 stagnant sessions) ─────────────
        if 2 <= plateau_count < 4:
            increment = _get_weight_increment(exercise)
            suggested_weight = max(0.0, current_weight - increment) if is_assisted else current_weight + increment
            return ProgressionSuggestion(
                type="plateau_warning",
                current=current,
                suggested={"weight": suggested_weight, "reps": rep_high, "sets": target_sets},
                reason=f"You've been at {current_weight}kg × ~{ref_reps} reps for {plateau_count} sessions — push for one more rep or try {suggested_weight}kg to avoid a plateau.",
                confidence=0.6,
            )

    return None


# ── Bodyweight analysis ──────────────────────────────────────────────────────

def _analyze_bodyweight(
    history: list[dict],
    exercise: Exercise,
    routine_config: dict | None,
    experience_tier: str,
    db: DBSession,
    routine: Routine | None = None,
    day_index: int | None = None,
) -> ProgressionSuggestion | None:
    """Check bodyweight progression chains."""
    if not history:
        return None

    # Find this exercise in a chain
    chain_entry = (
        db.query(ExerciseProgression)
        .filter(ExerciseProgression.exercise_id == exercise.id)
        .first()
    )
    if not chain_entry:
        # Not in a chain — fall back to strength-style analysis (reps-based)
        return _analyze_strength(history, exercise, routine_config, experience_tier, db, routine, day_index)

    target_reps = chain_entry.target_reps_to_advance
    target_sets = chain_entry.target_sets_to_advance
    # Advance after 2 sessions instead of DB value — don't make users wait a month
    sessions_needed = 2

    latest = history[0]
    latest_sets = latest["sets"]
    current_reps = [s["reps"] for s in latest_sets]
    avg_reps = sum(current_reps) / len(current_reps) if current_reps else 0
    num_sets = len(latest_sets)

    current = {"weight": 0, "reps": round(avg_reps, 1), "sets": num_sets}

    # Check consecutive sessions at/above target
    consecutive_at_target = 0
    for session_data in history:
        sets = session_data["sets"]
        all_hit = all(s["reps"] >= target_reps for s in sets) and len(sets) >= target_sets
        if all_hit:
            consecutive_at_target += 1
        else:
            break

    if consecutive_at_target >= sessions_needed:
        # Find next exercise in chain
        next_entry = (
            db.query(ExerciseProgression)
            .filter(
                ExerciseProgression.chain_name == chain_entry.chain_name,
                ExerciseProgression.position == chain_entry.position + 1,
            )
            .first()
        )
        if next_entry:
            next_exercise = db.get(Exercise, next_entry.exercise_id)
            if next_exercise:
                return ProgressionSuggestion(
                    type="bw_progression",
                    current=current,
                    suggested={
                        "weight": 0,
                        "reps": next_entry.suggested_starting_reps,
                        "sets": next_entry.suggested_starting_sets,
                    },
                    reason=f"You've hit {target_reps}+ reps for {consecutive_at_target} sessions. Progress to {next_exercise.name} at {next_entry.suggested_starting_sets}×{next_entry.suggested_starting_reps}.",
                    confidence=0.85,
                    new_exercise_id=next_exercise.id,
                    new_exercise_name=next_exercise.name,
                )

    # ── Rep increase suggestion (below target, encourage +1 rep) ────
    if avg_reps < target_reps and len(history) >= 1:
        suggested_reps = math.ceil(avg_reps) + 1
        if suggested_reps > target_reps:
            suggested_reps = target_reps
        return ProgressionSuggestion(
            type="rep_increase",
            current=current,
            suggested={"weight": 0, "reps": suggested_reps, "sets": target_sets},
            reason=f"You're averaging {round(avg_reps, 1)} reps — aim for {suggested_reps} reps next session to progress toward {target_reps}.",
            confidence=0.7,
        )

    # Plateau detection for bodyweight
    if len(history) >= 2:
        plateau_count = 0
        ref_reps = round(avg_reps)
        for session_data in history[:6]:
            sets = session_data["sets"]
            sr = sum(s["reps"] for s in sets) / len(sets) if sets else 0
            if abs(sr - ref_reps) <= 1:
                plateau_count += 1
            else:
                break

        if plateau_count >= 4:
            alt_id, alt_name = (None, None)
            if routine:
                alt_id, alt_name = _find_swap_alternative(exercise, routine, day_index, db)
            reason = f"You've been stuck at ~{ref_reps} reps for {plateau_count} sessions."
            if alt_name:
                reason += f" Try swapping to {alt_name}."
            else:
                reason += " Consider a variation or a different progression."
            return ProgressionSuggestion(
                type="exercise_swap",
                current=current,
                suggested=current,
                reason=reason,
                confidence=0.65,
                new_exercise_id=alt_id,
                new_exercise_name=alt_name,
            )

        # ── Pre-plateau warning (2-3 stagnant sessions) ─────────────
        if 2 <= plateau_count < 4:
            return ProgressionSuggestion(
                type="plateau_warning",
                current=current,
                suggested={"weight": 0, "reps": ref_reps + 1, "sets": target_sets},
                reason=f"You've been at ~{ref_reps} reps for {plateau_count} sessions — push for one more rep to avoid a plateau.",
                confidence=0.55,
            )

    return None


# ── Cardio analysis ──────────────────────────────────────────────────────────

def _analyze_cardio(
    history: list[dict],
    exercise: Exercise,
    routine_config: dict | None,
) -> ProgressionSuggestion | None:
    """Apply conservative cardio progression (+3-5% distance, +1-3 min duration)."""
    if len(history) < 3:
        return None

    # Gather recent metrics
    recent_distances = []
    recent_durations = []
    recent_paces = []

    for session_data in history[:5]:
        for s in session_data["sets"]:
            if s["distance_km"] > 0:
                recent_distances.append(s["distance_km"])
            if s["duration_sec"] > 0:
                recent_durations.append(s["duration_sec"])
            if s["avg_pace"] > 0:
                recent_paces.append(s["avg_pace"])

    if not recent_distances and not recent_durations:
        return None

    current = {
        "distance": round(sum(recent_distances[:3]) / len(recent_distances[:3]), 2) if recent_distances else 0,
        "duration": round(sum(recent_durations[:3]) / len(recent_durations[:3])) if recent_durations else 0,
        "pace": round(sum(recent_paces[:3]) / len(recent_paces[:3])) if recent_paces else 0,
    }

    # Check consistency: last 3 sessions should be similar (within 10%)
    if len(recent_distances) >= 3:
        avg_dist = current["distance"]
        if avg_dist > 0 and all(abs(d - avg_dist) / avg_dist < 0.1 for d in recent_distances[:3]):
            # Suggest +4% distance
            suggested_dist = round(avg_dist * 1.04, 2)
            return ProgressionSuggestion(
                type="cardio_increase",
                current=current,
                suggested={**current, "distance": suggested_dist},
                reason=f"Consistent at {avg_dist}km for 3 sessions. Try {suggested_dist}km (+4%).",
                confidence=0.7,
            )

    if len(recent_durations) >= 3:
        avg_dur = current["duration"]
        if avg_dur > 0 and all(abs(d - avg_dur) / avg_dur < 0.1 for d in recent_durations[:3]):
            # Suggest +2 minutes
            suggested_dur = avg_dur + 120
            return ProgressionSuggestion(
                type="cardio_increase",
                current=current,
                suggested={**current, "duration": suggested_dur},
                reason=f"Consistent duration for 3 sessions. Try adding 2 minutes ({suggested_dur // 60} min total).",
                confidence=0.7,
            )

    return None


# ── Main entry points ────────────────────────────────────────────────────────

def analyze_exercise_progression(
    user_id: int,
    exercise_id: int,
    routine_id: int,
    db: DBSession,
    day_index: int | None = None,
) -> ProgressionSuggestion | None:
    """
    Analyse session history for one exercise and return a suggestion (or None).
    This is the main entry point for mode (A) quick suggestions.
    """
    exercise = db.get(Exercise, exercise_id)
    if not exercise:
        return None

    routine = db.get(Routine, routine_id)
    if not routine:
        return None

    routine_config = _get_routine_exercise_config(routine, day_index, exercise_id)
    history = _get_session_history(user_id, exercise_id, routine_id, db)

    if not history:
        return None

    experience_tier = _get_experience_tier(user_id, db)

    # Route to appropriate analyser
    ex_type = (exercise.type or "Strength").lower()

    if ex_type == "cardio":
        return _analyze_cardio(history, exercise, routine_config)
    elif exercise.is_bodyweight:
        return _analyze_bodyweight(history, exercise, routine_config, experience_tier, db, routine, day_index)
    else:
        return _analyze_strength(history, exercise, routine_config, experience_tier, db, routine, day_index)


def analyze_routine_day(
    user_id: int,
    routine_id: int,
    day_index: int,
    db: DBSession,
) -> dict[int, dict]:
    """
    Analyse all exercises in a routine day. Returns {exercise_id: suggestion_dict}.
    Used by the batch endpoint.
    """
    routine = db.get(Routine, routine_id)
    if not routine:
        return {}

    days = routine.days or []
    if day_index < 0 or day_index >= len(days):
        return {}

    day = days[day_index]
    results = {}

    for ex_config in day.get("exercises", []):
        exercise_id = ex_config.get("exercise_id")
        if not exercise_id:
            continue
        suggestion = analyze_exercise_progression(user_id, exercise_id, routine_id, db, day_index)
        if suggestion and suggestion.type != "none":
            results[exercise_id] = suggestion.to_dict()

    return results
