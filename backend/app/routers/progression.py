"""
Progression suggestion endpoints.

Mode A: Algorithmic quick suggestions (no AI cost)
Mode B: AI Coach Chat (OpenAI)
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
from app.limiter import limiter

router = APIRouter(
    prefix="/api/progression",
    tags=["progression"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    routine_id: int
    day_index: Optional[int] = None
    message: str


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
    routine = db.query(Routine).get(routine_id)
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


# ── Mode B: AI Coach Chat ───────────────────────────────────────────────────

@router.post("/chat")
@limiter.limit("5/hour")
async def coach_chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Free-form AI coach chat. Sends user message with routine context
    and progress summary to OpenAI, returns structured suggestions.
    """
    routine = db.query(Routine).get(body.routine_id)
    if not routine or routine.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Routine not found")

    from app.openai_service import coach_chat_ai

    try:
        result = await coach_chat_ai(
            db=db,
            user=current_user,
            routine=routine,
            day_index=body.day_index,
            message=body.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")

    return result


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

    # Count reports generated this week (across all routines)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    reports_this_week = (
        db.query(ProgressionReport)
        .filter(
            ProgressionReport.user_id == current_user.id,
            ProgressionReport.created_at >= week_ago,
        )
        .count()
    )
    max_per_week = 3
    remaining = max(0, max_per_week - reports_this_week)

    if not cached:
        return {"report": None, "reports_remaining": remaining, "max_per_week": max_per_week}
    return {
        "report": {"report_id": cached.id, "created_at": str(cached.created_at), **cached.report_data},
        "reports_remaining": remaining,
        "max_per_week": max_per_week,
    }


@router.post("/report/{routine_id}")
@limiter.limit("3/week")
async def generate_report(
    request: Request,
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a full progression report: algorithmic analysis for all exercises
    across all days, enriched with AI narrative and periodization advice.
    """
    routine = db.query(Routine).get(routine_id)
    if not routine or routine.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Routine not found")

    from app.progression_engine import analyze_routine_day
    from app.openai_service import generate_report_ai

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
            day_report[ex_id] = {
                **suggestion,
                "ai_note": enrichment.get("note"),
                "ai_alternative": enrichment.get("alternative"),
            }
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

    return {"report_id": report.id, **report_data}


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
