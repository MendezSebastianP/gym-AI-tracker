"""
Build a structured user progress summary for AI prompts.

Computes per-exercise trends, plateau flags, PRs, NSS trends,
and consistency metrics. Designed to keep token usage low while
giving the AI meaningful context.

Reused by both Coach Chat (mode B) and Progression Report (mode C).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, func
from sqlalchemy.orm import Session as DBSession

from app.models.session import Session as SessionModel, Set as SetModel
from app.models.exercise import Exercise
from app.models.routine import Routine
from app.models.user_preference import UserPreference
# DIFFICULTY_FACTORS and BW_RATIOS available in app.exercise_scoring if needed for NSS

logger = logging.getLogger(__name__)


def build_progress_summary(
    user_id: int,
    routine_id: int,
    db: DBSession,
    day_index: int | None = None,
) -> dict:
    """
    Build a compact progress summary dict suitable for inclusion in AI prompts.

    Returns:
    {
        "overall": {
            "total_sessions": int,
            "weeks_active": int,
            "consistency_streak": int,  # consecutive weeks with ≥1 session
            "recent_prs": [...],
        },
        "exercises": [
            {
                "exercise_id": int,
                "name": str,
                "type": str,
                "trend": "improving" | "stalled" | "regressing",
                "sessions_tracked": int,
                "best_set": {"weight": float, "reps": int} | {"distance": float, "duration": int},
                "avg_last_3": {"weight": float, "reps": float},
                "plateau": bool,
                "weeks_at_current_level": int,
            },
            ...
        ],
        "user_context": {
            "goal": str | None,
            "experience": str | None,
            "injuries": list,
            "equipment": list,
            "progression_pace": str | None,
        }
    }
    """
    routine = db.get(Routine, routine_id)
    if not routine:
        return {"overall": {}, "exercises": [], "user_context": {}}

    # ── Overall stats ────────────────────────────────────────────────
    completed_sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == user_id,
            SessionModel.routine_id == routine_id,
            SessionModel.completed_at.isnot(None),
        )
        .order_by(desc(SessionModel.completed_at))
        .all()
    )

    total_sessions = len(completed_sessions)

    # Consistency streak (consecutive weeks)
    consistency_streak = 0
    if completed_sessions:
        now = datetime.now(timezone.utc)
        current_week_start = now - timedelta(days=now.weekday())
        week_start = current_week_start
        for _ in range(52):  # max 1 year
            week_end = week_start + timedelta(days=7)
            has_session = any(
                week_start.date() <= s.completed_at.date() < week_end.date()
                for s in completed_sessions
                if s.completed_at
            )
            if has_session:
                consistency_streak += 1
                week_start -= timedelta(days=7)
            else:
                break

    # Weeks active
    weeks_active = 0
    if completed_sessions and completed_sessions[-1].completed_at:
        first_session = completed_sessions[-1].completed_at
        weeks_active = max(1, (datetime.now(timezone.utc) - first_session).days // 7)

    # ── Gather exercises to analyse ──────────────────────────────────
    days = routine.days or []
    if day_index is not None and 0 <= day_index < len(days):
        target_days = [days[day_index]]
    else:
        target_days = days

    exercise_ids = []
    for day in target_days:
        for ex in day.get("exercises", []):
            eid = ex.get("exercise_id")
            if eid and eid not in exercise_ids:
                exercise_ids.append(eid)

    # ── Per-exercise analysis ────────────────────────────────────────
    exercises_summary = []
    recent_prs = []

    for exercise_id in exercise_ids:
        exercise = db.get(Exercise, exercise_id)
        if not exercise:
            continue

        # Get all sets for this exercise across completed sessions of this routine
        session_ids = [s.id for s in completed_sessions]
        if not session_ids:
            continue

        sets_by_session = {}
        all_sets = (
            db.query(SetModel)
            .filter(
                SetModel.session_id.in_(session_ids),
                SetModel.exercise_id == exercise_id,
            )
            .all()
        )

        for s in all_sets:
            sets_by_session.setdefault(s.session_id, []).append(s)

        # Order sessions newest first
        ordered_sessions = [
            (sess, sets_by_session.get(sess.id, []))
            for sess in completed_sessions
            if sess.id in sets_by_session
        ]

        if not ordered_sessions:
            continue

        sessions_tracked = len(ordered_sessions)
        ex_type = (exercise.type or "Strength").lower()

        if ex_type == "cardio":
            summary = _summarize_cardio(exercise, ordered_sessions)
        else:
            summary = _summarize_strength(exercise, ordered_sessions)

        summary["exercise_id"] = exercise_id
        summary["name"] = exercise.name
        summary["type"] = exercise.type or "Strength"
        summary["sessions_tracked"] = sessions_tracked

        # Check for recent PRs (in last 2 sessions)
        if summary.get("is_pr"):
            recent_prs.append({"exercise": exercise.name, "type": summary.get("pr_type", "weight")})

        exercises_summary.append(summary)

    # ── User context ─────────────────────────────────────────────────
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    user_context = {
        "goal": pref.primary_goal if pref else None,
        "experience": pref.experience_level if pref else None,
        "injuries": pref.injured_areas if pref and pref.has_injuries == "Yes" else [],
        "equipment": pref.available_equipment if pref else [],
        "progression_pace": pref.progression_pace if pref else None,
    }

    return {
        "overall": {
            "total_sessions": total_sessions,
            "weeks_active": weeks_active,
            "consistency_streak": consistency_streak,
            "recent_prs": recent_prs,
        },
        "exercises": exercises_summary,
        "user_context": user_context,
    }


def _summarize_strength(exercise: Exercise, ordered_sessions: list) -> dict:
    """Summarise a strength/bodyweight exercise across sessions."""
    # Extract per-session aggregates
    session_stats = []
    all_time_best_weight = 0
    all_time_best_reps = 0

    for sess, sets in ordered_sessions:
        if not sets:
            continue
        max_weight = max((s.weight_kg or 0) for s in sets)
        avg_reps = sum((s.reps or 0) for s in sets) / len(sets)
        max_reps = max((s.reps or 0) for s in sets)
        session_stats.append({
            "max_weight": max_weight,
            "avg_reps": round(avg_reps, 1),
            "max_reps": max_reps,
            "num_sets": len(sets),
            "date": sess.completed_at,
        })

        if max_weight > all_time_best_weight:
            all_time_best_weight = max_weight
        if max_reps > all_time_best_reps:
            all_time_best_reps = max_reps

    if not session_stats:
        return {"trend": "stalled", "plateau": False, "weeks_at_current_level": 0}

    latest = session_stats[0]

    # Best set
    best_set = {"weight": all_time_best_weight, "reps": all_time_best_reps}

    # Average of last 3
    last_3 = session_stats[:3]
    avg_weight_3 = round(sum(s["max_weight"] for s in last_3) / len(last_3), 1)
    avg_reps_3 = round(sum(s["avg_reps"] for s in last_3) / len(last_3), 1)

    # Trend detection (compare last 3 vs previous 3)
    trend = "stalled"
    if len(session_stats) >= 4:
        prev_3 = session_stats[3:6] if len(session_stats) >= 6 else session_stats[3:]
        if prev_3:
            prev_avg_weight = sum(s["max_weight"] for s in prev_3) / len(prev_3)
            prev_avg_reps = sum(s["avg_reps"] for s in prev_3) / len(prev_3)
            # Volume proxy: weight * reps
            current_vol = avg_weight_3 * avg_reps_3
            prev_vol = prev_avg_weight * prev_avg_reps
            if current_vol > prev_vol * 1.03:
                trend = "improving"
            elif current_vol < prev_vol * 0.97:
                trend = "regressing"

    # Plateau: same weight ±0 for 4+ sessions
    plateau = False
    if len(session_stats) >= 4:
        ref_w = latest["max_weight"]
        ref_r = latest["avg_reps"]
        same_count = sum(
            1 for s in session_stats[:6]
            if abs(s["max_weight"] - ref_w) < 0.01 and abs(s["avg_reps"] - ref_r) <= 1
        )
        plateau = same_count >= 4

    # Weeks at current level
    weeks_at_current = 0
    if session_stats and latest["date"]:
        ref_w = latest["max_weight"]
        oldest_same = latest["date"]
        for s in session_stats:
            if abs(s["max_weight"] - ref_w) < 0.01:
                oldest_same = s["date"]
            else:
                break
        if oldest_same:
            weeks_at_current = max(1, (datetime.now(timezone.utc) - oldest_same).days // 7)

    # PR check (is latest the all-time best?)
    is_pr = latest["max_weight"] >= all_time_best_weight and latest["max_weight"] > 0
    pr_type = "weight"
    if exercise.is_bodyweight:
        is_pr = latest["max_reps"] >= all_time_best_reps and latest["max_reps"] > 0
        pr_type = "reps"

    return {
        "trend": trend,
        "best_set": best_set,
        "avg_last_3": {"weight": avg_weight_3, "reps": avg_reps_3},
        "plateau": plateau,
        "weeks_at_current_level": weeks_at_current,
        "is_pr": is_pr,
        "pr_type": pr_type,
    }


def _summarize_cardio(exercise: Exercise, ordered_sessions: list) -> dict:
    """Summarise a cardio exercise across sessions."""
    session_stats = []
    best_distance = 0
    best_duration = 0
    best_pace = float("inf")

    for sess, sets in ordered_sessions:
        if not sets:
            continue
        total_dist = sum((s.distance_km or 0) for s in sets)
        total_dur = sum((s.duration_sec or 0) for s in sets)
        avg_pace = (total_dur / total_dist) if total_dist > 0 else 0

        session_stats.append({
            "distance": round(total_dist, 2),
            "duration": total_dur,
            "pace": round(avg_pace) if avg_pace else 0,
            "date": sess.completed_at,
        })

        if total_dist > best_distance:
            best_distance = total_dist
        if total_dur > best_duration:
            best_duration = total_dur
        if 0 < avg_pace < best_pace:
            best_pace = avg_pace

    if not session_stats:
        return {"trend": "stalled", "plateau": False, "weeks_at_current_level": 0}

    # Average last 3
    last_3 = session_stats[:3]
    avg_dist_3 = round(sum(s["distance"] for s in last_3) / len(last_3), 2)
    avg_dur_3 = round(sum(s["duration"] for s in last_3) / len(last_3))

    # Trend
    trend = "stalled"
    if len(session_stats) >= 4:
        prev_3 = session_stats[3:6] if len(session_stats) >= 6 else session_stats[3:]
        if prev_3:
            prev_dist = sum(s["distance"] for s in prev_3) / len(prev_3)
            if avg_dist_3 > prev_dist * 1.03:
                trend = "improving"
            elif avg_dist_3 < prev_dist * 0.97:
                trend = "regressing"

    return {
        "trend": trend,
        "best_set": {"distance": round(best_distance, 2), "duration": best_duration},
        "avg_last_3": {"distance": avg_dist_3, "duration": avg_dur_3},
        "plateau": False,
        "weeks_at_current_level": 0,
        "is_pr": False,
        "pr_type": "distance",
    }


def format_summary_for_prompt(summary: dict) -> str:
    """Convert the summary dict into a compact string for AI prompts."""
    lines = []

    overall = summary.get("overall", {})
    lines.append("## User Progress Summary")
    lines.append(f"Sessions: {overall.get('total_sessions', 0)} | "
                 f"Weeks active: {overall.get('weeks_active', 0)} | "
                 f"Streak: {overall.get('consistency_streak', 0)} weeks")

    prs = overall.get("recent_prs", [])
    if prs:
        pr_str = ", ".join(f"{p['exercise']} ({p['type']})" for p in prs)
        lines.append(f"Recent PRs: {pr_str}")

    lines.append("")
    lines.append("## Per-Exercise Status")

    for ex in summary.get("exercises", []):
        trend_icon = {"improving": "↑", "stalled": "→", "regressing": "↓"}.get(ex["trend"], "?")
        line = f"- {ex['name']} [{ex['type']}] {trend_icon}"

        avg = ex.get("avg_last_3", {})
        if ex["type"] == "Cardio":
            line += f" | avg: {avg.get('distance', 0)}km / {avg.get('duration', 0)}s"
        else:
            line += f" | avg: {avg.get('weight', 0)}kg × {avg.get('reps', 0)}"

        if ex.get("plateau"):
            line += f" | PLATEAU ({ex.get('weeks_at_current_level', 0)}w)"
        lines.append(line)

    ctx = summary.get("user_context", {})
    if any(ctx.values()):
        lines.append("")
        lines.append("## User Preferences")
        if ctx.get("goal"):
            lines.append(f"Goal: {ctx['goal']}")
        if ctx.get("experience"):
            lines.append(f"Experience: {ctx['experience']}")
        if ctx.get("injuries"):
            lines.append(f"Injuries: {', '.join(ctx['injuries'])}")
        if ctx.get("equipment"):
            lines.append(f"Equipment: {', '.join(ctx['equipment'])}")
        if ctx.get("progression_pace"):
            lines.append(f"Pace: {ctx['progression_pace']}")

    return "\n".join(lines)
