import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app.database import SessionLocal
from app.models.exercise import Exercise

def audit_exercises():
    db = SessionLocal()
    exercises = db.query(Exercise).filter(Exercise.user_id == None).all()
    count = 0
    
    for ex in exercises:
        name_lower = ex.name.lower()
        new_eq = ex.equipment or "None (Bodyweight)"
        new_diff = ex.difficulty_level

        # --- EQUIPMENT FIXES ---
        # 1. Bench fixing
        if any(kw in name_lower for kw in ["bench press", "bench fly", "incline", "decline", "seated"]):
            if "machine" not in new_eq.lower() and "cable" not in new_eq.lower():
                if "bench" not in new_eq.lower():
                    new_eq += ", Bench"
        
        if ("dumbbell press" in name_lower or "dumbbell fly" in name_lower) and "standing" not in name_lower and "floor" not in name_lower:
            if "bench" not in new_eq.lower():
                new_eq += ", Bench"
                
        if "tricep dip" in name_lower or "bench dip" in name_lower:
            new_eq = "Other, Bench"

        # 2. Dip Station fixing
        if "dip" in name_lower and "bench" not in name_lower and "tricep" not in name_lower:
            if "dip station" not in new_eq.lower() and "ring" not in name_lower:
                new_eq = "Dip Station"

        # 3. Pull-up bar fixing
        if any(kw in name_lower for kw in ["pull up", "pull-up", "chin up", "chin-up", "muscle up", "toes to bar"]) and "machine" not in name_lower and "assisted" not in name_lower:
            if "pull-up bar" not in new_eq.lower() and "ring" not in name_lower:
                new_eq = "None (Bodyweight), Pull-up Bar"

        # --- DIFFICULTY FIXES ---
        # Explicit Beginner (1-3)
        if any(kw in name_lower for kw in ["assisted pull", "assisted dip", "lat pulldown", "seated row", "machine", "cable", "leg press", "extension", "curl", "calf", "goblet", "glute bridge", "crunch", "plank"]):
            new_diff = min(new_diff, 3)
            
        # Explicit Intermediate (4-6)
        if any(kw in name_lower for kw in ["pull up", "chin up", "dip", "deadlift", "barbell row", "t-bar", "front squat", "sumo", "hip thrust", "overhead press", "bulgarian", "romanian", "single leg deadlift"]):
            if new_diff < 4:
                new_diff = 5
        
        # Specific tuning
        if name_lower in ["pull up", "chin up"]:
            new_diff = 4
        elif name_lower == "dips":
            new_diff = 3
        elif name_lower == "push up":
            new_diff = 2
        elif name_lower == "single leg deadlift":
            new_diff = 5

        # Explicit Advanced (7-10)
        if any(kw in name_lower for kw in ["muscle up", "planche", "front lever", "back lever", "one arm"]):
             if new_diff < 8:
                 new_diff = 8

        # Cleanup equipment strings
        eq_parts = list(set([e.strip() for e in new_eq.split(",") if e.strip()]))
        final_eq = ", ".join(eq_parts)

        if final_eq != ex.equipment or new_diff != ex.difficulty_level:
            ex.equipment = final_eq
            ex.difficulty_level = new_diff
            count += 1

    db.commit()
    print(f"Audited and updated {count} exercises.")

if __name__ == "__main__":
    audit_exercises()
