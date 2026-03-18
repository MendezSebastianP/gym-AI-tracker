"""
Seed the difficulty_level column (1-10) for all global exercises.

Logic:
- Weight-scalable machine/cable/dumbbell exercises → 1 (anyone can do them by adjusting the weight)
- Basic bodyweight movements (pushups, squats, planks) → 1-2
- Compound barbell lifts (deadlift, squat, bench) → 3
- Intermediate bodyweight (pull-ups, dips, pistol squats) → 4
- Advanced calisthenics progressions (archer pull-ups, L-sit) → 5-6
- Elite gymnastic movements (muscle-ups, front lever, planche) → 7-9
- Near-impossible feats (one-arm pull-up, full planche, human flag) → 10
"""
import re
from app.database import SessionLocal
from app.models.exercise import Exercise

# ── Keyword-based difficulty mapping ──────────────────────────────────────────
# Order matters: first match wins. Use lowercase patterns.
DIFFICULTY_RULES = [
    # ── Level 10: Elite / Near Impossible ──
    (10, ["one arm pull up", "one arm chin up", "full planche", "planche push",
           "iron cross", "impossible dip", "human flag", "clutch flag",
           "one arm handstand", "maltese"]),

    # ── Level 9: Very Advanced Gymnastic ──
    (9, ["back lever raise", "front lever raise", "front lever pull",
          "straddle planche", "advanced tuck planche", "ring muscle up",
          "flying push up", "90 degree push up", "handstand push up",
          "full back lever", "full front lever"]),

    # ── Level 8: Advanced Gymnastic ──
    (8, ["half lay front lever", "half lay back lever",
          "advanced tuck front lever", "advanced tuck back lever",
          "muscle up (bar)", "muscle up (ring)", "muscle up",
          "bulgarian ring dip", "windshield wiper",
          "archer push up", "clapping pull up", "explosive pull up",
          "l-sit dip", "korean dip", "russian dip",
          "typewriter push up", "dragon flag"]),

    # ── Level 7: Upper-Intermediate Gymnastic ──
    (7, ["archer pull up", "behind the neck pull up", "l-sit pull up",
          "around the world pull up", "straight bar dip",
          "tuck front lever", "tuck back lever",
          "commando pull up", "mixed grip pull up",
          "ring dip", "straddle l-sit", "v-up hold",
          "pistol squat", "shrimp squat", "nordic curl"]),

    # ── Level 6: Intermediate-Advanced ──
    (6, ["close grip pull up", "neutral grip pull up",
          "l-sit", "l-sit flutter", "hollow body rock",
          "jackknife pull up", "deficit deadlift", "meadows row",
          "romanian deadlift", "sumo deadlift", "pendlay row",
          "decline push up", "pike push up", "hindu push up",
          "diamond push up", "negative pull up", "negative chin up",
          "negative dip", "tuck l-sit", "tuck v-up",
          "hanging leg raise",
          "front squat", "overhead press", "clean and press",
          "snatch grip deadlift"]),

    # ── Level 5: Intermediate ──
    (5, ["pull up", "chin up", "dip", "tricep dip",
          "bench dip", "ab wheel", "v-up",
          "barbell row", "bent over row", "t-bar row",
          "overhead squat", "hip thrust",
          "hyperextension",
          "muscle snatch", "power clean", "single leg deadlift"]),

    # ── Level 4: Beginner-Intermediate ──
    (4, ["inverted row", "ring row",
          "bench press", "incline bench", "decline bench",
          "military press", "push press",
          "deadlift", "barbell squat", "back squat",
          "barbell curl", "barbell shrug", "farmer's walk"]),

    # ── Level 3: Competent Beginner ──
    (3, ["dumbbell press", "dumbbell fly", "dumbbell row",
          "dumbbell curl", "dumbbell shoulder", "dumbbell lateral",
          "dumbbell front raise", "dumbbell lunge",
          "goblet squat", "bulgarian split squat",
          "hammer curl", "concentration curl",
          "skull crusher", "overhead tricep",
          "seated dumbbell press", "arnold press",
          "lunges", "step up", "calf raise",
          "jackknife abs"]),

    # ── Level 2: Easy / Fundamental Bodyweight ──
    (2, ["push up", "pushup", "push-up",
          "squat", "bodyweight squat", "air squat",
          "plank", "side plank", "crunch",
          "leg raise", "mountain climber", "russian twist",
          "bicycle crunch", "tuck crunch",
          "glute bridge", "superman", "dead bug",
          "jumping jack", "burpee",
          "band assisted"]),

    # ── Level 1: Universal / Weight Scalable ──
    # Machines, cables, and basic isolation movements anyone can do
    (1, ["cable", "machine", "lat pulldown", "leg press",
          "leg extension", "leg curl", "pec deck", "chest fly machine",
          "smith machine", "hack squat machine",
          "tricep pushdown", "face pull",
          "seated row", "preacher curl",
          "lateral raise machine", "shoulder press machine",
          "assisted", "wall sit", "wall push"]),
]


def assign_difficulty(name: str, equipment: str, is_bodyweight: bool) -> int:
    """Determine difficulty level for an exercise based on name/equipment patterns."""
    name_lower = name.lower()
    equip_lower = (equipment or "").lower()

    # Check keyword rules (first match wins)
    for level, keywords in DIFFICULTY_RULES:
        for kw in keywords:
            if kw in name_lower:
                return level

    # Fallback heuristics
    if "machine" in equip_lower or "cable" in equip_lower:
        return 1  # Machines are always adjustable
    if "dumbbell" in equip_lower:
        return 3  # Dumbbells need some coordination
    if "barbell" in equip_lower:
        return 4  # Barbell lifts need technique
    if is_bodyweight:
        return 3  # Unknown bodyweight exercise → moderate

    return 2  # Generic fallback


def main():
    db = SessionLocal()
    exercises = db.query(Exercise).filter(Exercise.user_id == None).all()

    print(f"Tagging {len(exercises)} global exercises with difficulty levels...\n")

    level_counts = {}
    for ex in exercises:
        new_level = assign_difficulty(ex.name, ex.equipment, ex.is_bodyweight)
        ex.difficulty_level = new_level
        level_counts[new_level] = level_counts.get(new_level, 0) + 1

    db.commit()

    print("Distribution:")
    for lvl in sorted(level_counts.keys()):
        print(f"  Level {lvl:2d}: {level_counts[lvl]:3d} exercises")
    print(f"\nTotal: {len(exercises)} exercises tagged successfully!")


if __name__ == "__main__":
    main()
