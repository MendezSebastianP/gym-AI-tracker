from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.exercise import Exercise
from app.schemas import ExerciseResponse, ExerciseCreate
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/api/exercises",
    tags=["exercises"]
)

# Complementary muscle mapping for smart suggestions
COMPLEMENTARY_MUSCLES = {
    "Chest": ["Triceps", "Shoulders"],
    "Shoulders": ["Triceps", "Chest"],
    "Triceps": ["Chest", "Shoulders"],
    "Lats": ["Biceps", "Traps"],
    "Traps": ["Biceps", "Lats", "Shoulders"],
    "Biceps": ["Lats", "Traps"],
    "Quadriceps": ["Hamstrings", "Glutes", "Calves"],
    "Hamstrings": ["Quadriceps", "Glutes", "Calves"],
    "Glutes": ["Hamstrings", "Quadriceps", "Calves"],
    "Calves": ["Quadriceps", "Hamstrings"],
    "Abdominals": ["Lower Back"],
    "Lower Back": ["Abdominals"],
    "Forearms": ["Biceps"],
}

@router.get("", response_model=List[ExerciseResponse])
def get_exercises(
    search: Optional[str] = None,
    muscle: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Exercise).filter(
        (Exercise.user_id == current_user.id) | (Exercise.user_id == None)
    )
    
    if search:
        query = query.filter(Exercise.name.ilike(f"%{search}%"))
    if muscle:
        query = query.filter(Exercise.muscle == muscle)
        
    return query.all()

@router.post("", response_model=ExerciseResponse)
def create_exercise(
    exercise: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_exercise = Exercise(**exercise.model_dump(), user_id=current_user.id, source="custom")
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return db_exercise


@router.get("/suggest")
def suggest_exercises(
    existing_ids: str = Query("", description="Comma-separated exercise IDs already in the day"),
    equipment: str = Query("", description="Comma-separated equipment types the user has"),
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Suggest complementary exercises based on muscle group coverage gaps.
    Pure algorithmic — no AI cost.
    """
    # Parse existing IDs
    existing_id_set = set()
    if existing_ids:
        for s in existing_ids.split(","):
            s = s.strip()
            if s.isdigit():
                existing_id_set.add(int(s))

    # Parse equipment filter
    equipment_set = set()
    if equipment:
        equipment_set = {e.strip().lower() for e in equipment.split(",") if e.strip()}

    # Look up muscles covered by existing exercises
    covered_muscles = set()
    if existing_id_set:
        existing_exercises = (
            db.query(Exercise)
            .filter(Exercise.id.in_(existing_id_set))
            .all()
        )
        for ex in existing_exercises:
            if ex.muscle:
                covered_muscles.add(ex.muscle)

    # Find complementary muscles that are missing
    missing_muscles = set()
    for muscle in covered_muscles:
        complements = COMPLEMENTARY_MUSCLES.get(muscle, [])
        for comp in complements:
            if comp not in covered_muscles:
                missing_muscles.add(comp)

    # If nothing is covered yet or no gaps found, suggest popular exercises
    if not missing_muscles:
        missing_muscles = {"Chest", "Lats", "Quadriceps", "Shoulders", "Abdominals"}

    # Query for exercises matching missing muscles
    query = (
        db.query(Exercise)
        .filter(Exercise.user_id == None)  # noqa: E711 — system exercises only
        .filter(Exercise.muscle.in_(missing_muscles))
    )

    # Exclude already-added exercises
    if existing_id_set:
        query = query.filter(~Exercise.id.in_(existing_id_set))

    # Equipment filter
    bodyweight_aliases = {"none (bodyweight)", "bodyweight", "body weight", "none", ""}
    if equipment_set and not equipment_set.issubset(bodyweight_aliases):
        # Include bodyweight exercises + exercises matching user's equipment
        allowed_eq = bodyweight_aliases.copy()
        eq_mapping = {
            "dumbbell": {"dumbbell"},
            "barbell": {"barbell"},
            "cable": {"cable"},
            "machine": {"machine"},
            "kettlebell": {"kettlebell"},
            "bands": {"bands", "band", "resistance band"},
            "smith machine": {"smith machine"},
        }
        for user_eq in equipment_set:
            for key, mapped in eq_mapping.items():
                if key in user_eq:
                    allowed_eq.update(mapped)
        query = query.filter(
            func.lower(func.coalesce(Exercise.equipment, "none (bodyweight)")).in_(allowed_eq)
        )

    candidates = query.all()

    # Diversify: pick at most 2 exercises per missing muscle
    result = []
    muscle_counts: dict = {}
    for ex in candidates:
        m = ex.muscle or "Other"
        if muscle_counts.get(m, 0) >= 2:
            continue
        muscle_counts[m] = muscle_counts.get(m, 0) + 1

        # Build reason
        reason = f"Complements your day — adds {m}"
        result.append({
            "id": ex.id,
            "name": ex.name,
            "muscle": ex.muscle,
            "muscle_group": ex.muscle_group,
            "equipment": ex.equipment,
            "reason": reason,
        })
        if len(result) >= limit:
            break

    return result
