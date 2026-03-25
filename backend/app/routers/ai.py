"""
AI-powered endpoints for routine generation.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_preference import UserPreference
from app.models.exercise import Exercise
from app.limiter import limiter

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"]
)


class GenerateRoutineRequest(BaseModel):
    extra_prompt: Optional[str] = None


class GenerateRoutineResponse(BaseModel):
    ai_usage_id: int
    name: str
    description: str
    coach_message: Optional[str] = None
    days: list


@router.post("/generate-routine", response_model=GenerateRoutineResponse)
@limiter.limit("3/hour")
async def generate_routine(
    request: Request,
    body: GenerateRoutineRequest = GenerateRoutineRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an AI-powered routine suggestion based on user preferences.

    Returns a routine structure (name, description, days) that the frontend
    can display for review. The user then saves it via POST /api/routines.

    Rate limited to 3 requests per hour per IP.
    """
    from app.openai_service import generate_routine_suggestion

    # Fetch user preferences
    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    # Users using the slider start at '5' visually. If it's literally empty, default to 5.
    exp_level = preferences.experience_level if (preferences and preferences.experience_level) else "5"
    
    # Try parsing as a raw numeric slider value (e.g. "5"). If it's a legacy string, fallback.
    try:
        max_difficulty = float(exp_level)
    except (ValueError, TypeError):
        experience_to_max_level = {
            "Beginner (0-6 months)": 2.5,
            "Intermediate (6 months - 2 years)": 3.5,
            "Advanced (2+ years)": 10.0,
            "I don't know": 3.0,
        }
        max_difficulty = experience_to_max_level.get(exp_level, 3.0)

    # Fetch system exercises filtered by difficulty
    exercises = (
        db.query(Exercise)
        .filter(Exercise.user_id == None)  # noqa: E711
        .filter(Exercise.difficulty_level <= max_difficulty)
        .all()
    )

    try:
        result = await generate_routine_suggestion(
            db=db,
            user=current_user,
            preferences=preferences,
            exercises=exercises,
            extra_prompt=body.extra_prompt,
        )
    except ValueError as e:
        # OPENAI_API_KEY not configured
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        # OpenAI returned bad data
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        # Pass through exceptions (like 401, 429) thrown by the service layer
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {str(e)}"
        )

    return result


# ── Interactive Exercise Replacement ──────────────────────────────────────


class RoutineExerciseInput(BaseModel):
    exercise_id: int
    sets: int = 3
    reps: str = "10"
    rest: int = 60


class RoutineDayInput(BaseModel):
    day_name: str
    exercises: List[RoutineExerciseInput]


class CurrentRoutineInput(BaseModel):
    name: str
    days: List[RoutineDayInput]


class ReplaceExercisesRequest(BaseModel):
    current_routine: CurrentRoutineInput
    rejected_exercise_ids: List[int]
    extra_prompt: Optional[str] = None


class ReplacementItem(BaseModel):
    original_exercise_id: int
    exercise_id: int
    sets: int
    reps: str
    rest: int
    notes: Optional[str] = None


class ReplaceExercisesResponse(BaseModel):
    replacements: List[ReplacementItem]


@router.post("/replace-exercises", response_model=ReplaceExercisesResponse)
@limiter.limit("10/hour")
async def replace_exercises(
    request: Request,
    body: ReplaceExercisesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Replace specific rejected exercises in an existing AI routine.
    The AI selects suitable replacements based on the user's prompt and equipment.
    """
    from app.openai_service import replace_exercises_ai

    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    experience_to_max_level = {
        "Beginner (0-6 months)": 4,
        "Intermediate (6 months - 2 years)": 7,
        "Advanced (2+ years)": 10,
        "I don't know": 5,
    }
    exp_level = preferences.experience_level if preferences else None
    max_difficulty = experience_to_max_level.get(exp_level, 5)

    exercises = (
        db.query(Exercise)
        .filter(Exercise.user_id == None)  # noqa: E711
        .filter(Exercise.difficulty_level <= max_difficulty)
        .all()
    )

    try:
        result = await replace_exercises_ai(
            db=db,
            user=current_user,
            preferences=preferences,
            exercises=exercises,
            current_routine=body.current_routine.model_dump(),
            rejected_ids=body.rejected_exercise_ids,
            extra_prompt=body.extra_prompt,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI replacement failed: {str(e)}"
        )

    return result


# ── AI Fill Day ─────────────────────────────────────────────────────────────


class FillDayRequest(BaseModel):
    prompt: str
    existing_exercise_ids: List[int] = []
    day_name: Optional[str] = None


class FillDayExercise(BaseModel):
    exercise_id: int
    sets: int
    reps: str
    rest: int
    notes: Optional[str] = None


class FillDayResponse(BaseModel):
    exercises: List[FillDayExercise]


@router.post("/fill-day", response_model=FillDayResponse)
@limiter.limit("3/hour")
async def fill_day(
    request: Request,
    body: FillDayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Given a free-text prompt like "add 3 chest exercises with dumbbells",
    return exercises scoped to a single day. Uses AI.
    Rate limited to 3 requests per hour per IP.
    """
    from app.openai_service import fill_day_ai

    preferences = (
        db.query(UserPreference)
        .filter(UserPreference.user_id == current_user.id)
        .first()
    )

    exp_level = preferences.experience_level if (preferences and preferences.experience_level) else "5"
    try:
        max_difficulty = float(exp_level)
    except (ValueError, TypeError):
        experience_to_max_level = {
            "Beginner (0-6 months)": 2.5,
            "Intermediate (6 months - 2 years)": 3.5,
            "Advanced (2+ years)": 10.0,
            "I don't know": 3.0,
        }
        max_difficulty = experience_to_max_level.get(exp_level, 3.0)

    exercises = (
        db.query(Exercise)
        .filter(Exercise.user_id == None)  # noqa: E711
        .filter(Exercise.difficulty_level <= max_difficulty)
        .all()
    )

    try:
        result = await fill_day_ai(
            db=db,
            user=current_user,
            preferences=preferences,
            exercises=exercises,
            prompt=body.prompt,
            existing_ids=body.existing_exercise_ids,
            day_name=body.day_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI fill-day failed: {str(e)}"
        )

    return result
