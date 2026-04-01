"""
Progression suggestion endpoints.

Mode A: Algorithmic quick suggestions (no AI cost)
Mode C: Full Progression Report (algorithmic + AI)
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.routine import Routine
from app.models.progression import ProgressionReport, ProgressionFeedback

class ReportRequest(BaseModel):
    user_context: Optional[str] = None
    use_joker: bool = False


router = APIRouter(
    prefix="/api/progression",
    tags=["progression"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────


class FeedbackRequest(BaseModel):
    report_id: Optional[int] = None
    exercise_id: int
    suggestion_type: str
    suggested_value: dict
    action: str  # accepted, rejected, modified, ignored
    applied_value: Optional[dict] = None


# ── Mode A: Algorithmic Quick Suggestions ────────────────────────────────────

@router.get("/exercise/{exercise_id}")
def get_exercise_suggestion(
    exercise_id: int,
    routine_id: int,
    day_index: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get algorithmic progression suggestion for a single exercise."""
    from app.progression_engine import analyze_exercise_progression

    suggestion = analyze_exercise_progression(
        user_id=current_user.id,
        exercise_id=exercise_id,
        routine_id=routine_id,
        db=db,
        day_index=day_index,
    )
    if not suggestion:
        return {"suggestion": None}
    return {"suggestion": suggestion.to_dict()}


@router.get("/routine/{routine_id}")
def get_routine_suggestions(
    routine_id: int,
    day_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get algorithmic suggestions for all exercises in a routine day."""
    # Verify ownership
    routine = db.get(Routine, routine_id)
    if not routine or routine.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Routine not found")

    from app.progression_engine import analyze_routine_day

    suggestions = analyze_routine_day(
        user_id=current_user.id,
        routine_id=routine_id,
        day_index=day_index,
        db=db,
    )
    return {"suggestions": suggestions}


# ── Mode C: Full Progression Report ─────────────────────────────────────────

@router.get("/report/{routine_id}")
def get_latest_report(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent saved report for this routine + weekly usage count."""
    from datetime import datetime, timedelta, timezone

    cached = (
        db.query(ProgressionReport)
        .filter(
            ProgressionReport.user_id == current_user.id,
            ProgressionReport.routine_id == routine_id,
        )
        .order_by(ProgressionReport.created_at.desc())
        .first()
    )

    if not cached:
        return {"report": None}
    return {
        "report": {"report_id": cached.id, "created_at": str(cached.created_at), **cached.report_data}
    }


@router.post("/report/{routine_id}")
async def generate_report(
    request: Request,
    routine_id: int,
    body: ReportRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a full progression report. Costs 50 coins (or 1 joker token).
    """
    routine = db.get(Routine, routine_id)
    if not routine or routine.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Routine not found")

    from app.progression_engine import analyze_routine_day
    from app.openai_service import generate_report_ai
    from app.gamification import deduct_coins

    deduct_coins(db, current_user, 50, use_joker=body.use_joker if body else False)

    # 1. Run algorithmic analysis for all days
    algorithmic_results = {}
    for day_idx, day in enumerate(routine.days or []):
        day_suggestions = analyze_routine_day(
            user_id=current_user.id,
            routine_id=routine_id,
            day_index=day_idx,
            db=db,
        )
        if day_suggestions:
            algorithmic_results[day["day_name"]] = day_suggestions

    # 2. Get AI enrichment
    try:
        ai_result = await generate_report_ai(
            db=db,
            user=current_user,
            routine=routine,
            algorithmic_results=algorithmic_results,
            user_context=body.user_context if body else None,
        )
    except (ValueError, RuntimeError):
        # AI unavailable — return algorithmic results only
        ai_result = {
            "overall_assessment": "AI analysis unavailable. See per-exercise suggestions below.",
            "periodization_note": None,
            "exercise_enrichments": {},
        }
    except Exception:
        ai_result = {
            "overall_assessment": "AI analysis unavailable.",
            "periodization_note": None,
            "exercise_enrichments": {},
        }

    # 3. Combine into report
    report_data = {
        "routine_name": routine.name,
        "overall_assessment": ai_result.get("overall_assessment", ""),
        "periodization_note": ai_result.get("periodization_note"),
        "days": {},
    }

    for day_name, suggestions in algorithmic_results.items():
        enrichments = ai_result.get("exercise_enrichments", {})
        day_report = {}
        for ex_id_str, suggestion in suggestions.items():
            ex_id = str(ex_id_str)
            enrichment = enrichments.get(ex_id, {})
            alt = enrichment.get("alternative")
            entry = {
                **suggestion,
                "ai_note": enrichment.get("note"),
            }
            # For exercise_swap, promote the AI-suggested replacement to the primary target
            if suggestion.get("type") == "exercise_swap" and alt:
                entry["new_exercise_id"] = alt.get("exercise_id")
                entry["new_exercise_name"] = alt.get("name")
            day_report[ex_id] = entry
        report_data["days"][day_name] = day_report

    # 4. Save report
    report = ProgressionReport(
        user_id=current_user.id,
        routine_id=routine_id,
        report_data=report_data,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    db.refresh(current_user)
    return {"report_id": report.id, "currency": current_user.currency, **report_data}


# ── Feedback tracking ───────────────────────────────────────────────────────

@router.post("/feedback")
def save_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record what the user did with a suggestion (accepted/rejected/modified)."""
    feedback = ProgressionFeedback(
        user_id=current_user.id,
        report_id=body.report_id,
        exercise_id=body.exercise_id,
        suggestion_type=body.suggestion_type,
        suggested_value=body.suggested_value,
        action=body.action,
        applied_value=body.applied_value,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return {"id": feedback.id, "status": "saved"}
