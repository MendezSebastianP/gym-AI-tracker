"""
Seed a demo user with 6 months of realistic training data (Upper/Lower then PPL).
Run via:  python -m app.seed_demo
"""
import random
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.user import User
from app.models.exercise import Exercise
from app.models.session import Session, Set
from app.models.routine import Routine
from app.models.quest import Quest, UserQuest
from app.gamification import exp_for_next_level
from app.auth import get_password_hash

DEMO_EMAIL = "demo@gymtracker.app"
DEMO_PASSWORD_HASH = get_password_hash("demo_blocked_account_no_login")

# UPPER / LOWER split definition
UPPER_EXERCISES = ['Bench Press', 'Bent Over Row', 'Overhead Press', 'Pull Up', 'Barbell Curl', 'Tricep Extension']
LOWER_EXERCISES = ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raise']

# PPL split definition
PUSH_EXERCISES = ['Bench Press', 'Incline Dumbbell Press', 'Cable Crossover', 'Overhead Press', 'Lateral Raise', 'Tricep Extension']
PULL_EXERCISES = ['Pull Up', 'Bent Over Row', 'Seated Row', 'Face Pull', 'Barbell Curl', 'Hammer Curl']
LEGS_EXERCISES = ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Extension', 'Leg Curl', 'Calf Raise']

UL_DAYS = [
    ('Upper', UPPER_EXERCISES),
    ('Lower', LOWER_EXERCISES),
]

PPL_DAYS = [
    ('Push', PUSH_EXERCISES),
    ('Pull', PULL_EXERCISES),
    ('Legs', LEGS_EXERCISES),
]

START_WEIGHTS = {
    'Bench Press': 30, 'Incline Dumbbell Press': 10, 'Cable Crossover': 5,
    'Overhead Press': 20, 'Lateral Raise': 5, 'Tricep Extension': 10,
    'Pull Up': 0, 'Bent Over Row': 30, 'Seated Row': 25,
    'Face Pull': 10, 'Barbell Curl': 10, 'Hammer Curl': 8,
    'Squat': 40, 'Romanian Deadlift': 40, 'Leg Press': 60,
    'Leg Extension': 15, 'Leg Curl': 15, 'Calf Raise': 20,
}

def seed_demo():
    db = SessionLocal()

    demo_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if demo_user:
        # Delete old sets by joining sessions
        old_sessions = db.query(Session).filter(Session.user_id == demo_user.id).all()
        for s in old_sessions:
            db.query(Set).filter(Set.session_id == s.id).delete()
            
        # Bulk delete sessions, then routines, then quests
        db.query(Session).filter(Session.user_id == demo_user.id).delete()
        db.query(Routine).filter(Routine.user_id == demo_user.id).delete()
        db.query(UserQuest).filter(UserQuest.user_id == demo_user.id).delete()
        db.commit()
        demo_user.is_demo = True
        demo_user.weight = 80
        demo_user.gender = "male"
    else:
        demo_user = User(
            email=DEMO_EMAIL, password_hash=DEMO_PASSWORD_HASH,
            is_active=True, is_demo=True, weight=80, gender="male",
        )
        db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    exercises = db.query(Exercise).filter(Exercise.user_id == None).all()
    ex_map = {e.name: e for e in exercises}

    # Create routines
    routine_ul = Routine(
        user_id=demo_user.id,
        name="Upper / Lower (Beginner)",
        days=[
            {"day_name": "Upper", "exercises": [{"exercise_id": ex_map[name].id, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": False} for name in UPPER_EXERCISES if name in ex_map]},
            {"day_name": "Lower", "exercises": [{"exercise_id": ex_map[name].id, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": False} for name in LOWER_EXERCISES if name in ex_map]}
        ]
    )
    db.add(routine_ul)

    routine_ppl = Routine(
        user_id=demo_user.id,
        name="PPL Split (Intermediate)",
        is_favorite=True,
        days=[
            {"day_name": "Push", "exercises": [{"exercise_id": ex_map[name].id, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": False} for name in PUSH_EXERCISES if name in ex_map]},
            {"day_name": "Pull", "exercises": [{"exercise_id": ex_map[name].id, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": False} for name in PULL_EXERCISES if name in ex_map]},
            {"day_name": "Legs", "exercises": [{"exercise_id": ex_map[name].id, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": False} for name in LEGS_EXERCISES if name in ex_map]}
        ]
    )
    db.add(routine_ppl)
    db.commit()
    db.refresh(routine_ul)
    db.refresh(routine_ppl)

    # 6 months = ~180 days. First month = U/L, Next 5 = PPL.
    start_date = datetime.now() - timedelta(days=180)
    current_date = start_date
    session_count = 0
    ul_cycle = 0
    ppl_cycle = 0
    week_num = 0

    target_weights = {k: v * random.uniform(1.3, 1.6) for k, v in START_WEIGHTS.items()}
    total_weeks = 26  # 6 months ~ 26 weeks

    while current_date < datetime.now():
        days_passed = (current_date - start_date).days
        is_month_one = days_passed < 30

        # Typical training days: Mon, Wed, Fri, Sat
        weekday = current_date.weekday()
        if weekday not in (0, 2, 4, 5): 
            current_date += timedelta(days=1)
            continue

        # Complete routines 75% of the time (Drop ~25%)
        if random.random() < 0.25:
            current_date += timedelta(days=1)
            continue

        if is_month_one:
            active_routine = routine_ul
            day_idx = ul_cycle % 2
            day_name, day_exercises = UL_DAYS[day_idx]
            ul_cycle += 1
        else:
            active_routine = routine_ppl
            day_idx = ppl_cycle % 3
            day_name, day_exercises = PPL_DAYS[day_idx]
            ppl_cycle += 1

        session_time = current_date.replace(hour=random.randint(16, 20), minute=random.choice([0, 15, 30]))
        session = Session(
            user_id=demo_user.id,
            routine_id=active_routine.id,
            day_index=day_idx,
            started_at=session_time,
            completed_at=session_time + timedelta(minutes=random.randint(45, 90)),
        )
        db.add(session)
        db.flush()

        progress_ratio = min(1.0, week_num / total_weeks)

        for ex_name in day_exercises:
            ex = ex_map.get(ex_name)
            if not ex: continue

            ideal_weight = START_WEIGHTS.get(ex_name, 20) + (target_weights.get(ex_name, 35) - START_WEIGHTS.get(ex_name, 20)) * progress_ratio
            if week_num > 0 and week_num % 6 == 0:
                ideal_weight *= 0.85
                
            is_bw = ex.is_bodyweight
            num_sets = random.choice([3, 4])

            for set_num in range(1, num_sets + 1):
                if is_bw:
                    base_reps = int(3 + (15 - 3) * progress_ratio)
                    reps = max(1, base_reps + random.randint(-1, 2))
                    w = 0.0
                else:
                    w = round(ideal_weight + random.uniform(-1, 1), 1)
                    w = max(0.0, w)
                    base_reps = random.randint(8, 12)
                    reps = max(3, base_reps - (set_num - 1))

                s = Set(
                    session_id=session.id, exercise_id=ex.id, set_number=set_num,
                    weight_kg=w if not is_bw else None, reps=reps,
                    completed_at=session_time + timedelta(minutes=set_num * 3),
                )
                db.add(s)

        session_count += 1
        if weekday == 5: week_num += 1
        current_date += timedelta(days=1)

    db.commit()

    total_xp = session_count * 60
    level = 1
    remaining_xp = total_xp
    coins = 0
    while remaining_xp >= exp_for_next_level(level):
        remaining_xp -= exp_for_next_level(level)
        level += 1
        coins += 10

    demo_user.level = level
    demo_user.experience = remaining_xp
    demo_user.currency = coins + 20
    db.commit()

    all_quests = db.query(Quest).all()
    for q in all_quests:
        progress = 0
        if q.req_type == "sessions": progress = min(session_count, q.req_value)
        elif q.req_type == "sets": progress = min(session_count * 18, q.req_value)
        elif q.req_type == "volume": progress = min(session_count * 3000, q.req_value)

        completed = progress >= q.req_value
        claimed = completed and random.random() < 0.7
        uq = UserQuest(
            user_id=demo_user.id, quest_id=q.id, progress=progress,
            completed=completed, claimed=claimed,
            completed_at=datetime.now() - timedelta(days=random.randint(1, 100)) if completed else None,
        )
        db.add(uq)

    db.commit()
    db.close()
    print(f"Demo seed complete. Created {session_count} sessions for {DEMO_EMAIL} (Level {level}, {coins} coins)")

if __name__ == "__main__":
    seed_demo()
