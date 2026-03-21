"""
Seed a demo user with 6 months of realistic training data (Upper/Lower then PPL),
cardio sessions (Running + Cycling), and weekly body weight logs.
Run via:  python -m app.seed_demo
"""
import random
from datetime import datetime, timedelta, timezone
from app.database import SessionLocal
from app.models.user import User
from app.models.exercise import Exercise
from app.models.session import Session, Set
from app.models.routine import Routine
from app.models.quest import Quest, UserQuest
from app.models.weight_log import WeightLog
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

# Cardio: weekday -> (exercise_name_candidates, dist_km_base, pace_start_sec, pace_end_sec, duration_variation_min)
CARDIO_SCHEDULE = {
    1: (['Running', 'Running (Treadmill)'], 5.0, 420, 290, 3),   # Tuesday — Running
    3: (['Running', 'Running (Treadmill)'], 6.0, 415, 285, 4),   # Thursday — Running (longer)
    6: (['Cycling', 'Cycling (Outdoor)'], 20.0, 210, 160, 5),    # Sunday — Cycling
}


def seed_demo():
    db = SessionLocal()

    demo_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if demo_user:
        # Delete old sets by joining sessions
        old_sessions = db.query(Session).filter(Session.user_id == demo_user.id).all()
        for s in old_sessions:
            db.query(Set).filter(Set.session_id == s.id).delete()

        # Bulk delete sessions, routines, quests, weight logs
        db.query(Session).filter(Session.user_id == demo_user.id).delete()
        db.query(Routine).filter(Routine.user_id == demo_user.id).delete()
        db.query(UserQuest).filter(UserQuest.user_id == demo_user.id).delete()
        db.query(WeightLog).filter(WeightLog.user_id == demo_user.id).delete()
        db.commit()
        demo_user.is_demo = True
        demo_user.weight = 78
        demo_user.gender = "male"
    else:
        demo_user = User(
            email=DEMO_EMAIL, password_hash=DEMO_PASSWORD_HASH,
            is_active=True, is_demo=True, weight=78, gender="male",
        )
        db.add(demo_user)
    db.commit()
    db.refresh(demo_user)

    exercises = db.query(Exercise).filter(Exercise.user_id == None).all()
    ex_map = {e.name: e for e in exercises}

    # Resolve cardio exercise objects (pick first available candidate)
    cardio_ex = {}
    for weekday, (candidates, *_) in CARDIO_SCHEDULE.items():
        for name in candidates:
            if name in ex_map:
                cardio_ex[weekday] = ex_map[name]
                break

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
    cardio_count = 0
    ul_cycle = 0
    ppl_cycle = 0
    week_num = 0

    target_weights = {k: v * random.uniform(1.3, 1.6) for k, v in START_WEIGHTS.items()}
    total_weeks = 26  # 6 months ~ 26 weeks

    while current_date < datetime.now():
        days_passed = (current_date - start_date).days
        is_month_one = days_passed < 30
        weekday = current_date.weekday()

        # ── Strength sessions: Mon/Wed/Fri/Sat ──────────────────────────
        if weekday in (0, 2, 4, 5):
            if random.random() >= 0.25:  # 75% completion
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
                    if not ex:
                        continue

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
                if weekday == 5:
                    week_num += 1

        # ── Cardio sessions: Tue/Thu/Sun ─────────────────────────────────
        if weekday in CARDIO_SCHEDULE:
            if random.random() >= 0.05:  # 95% completion for cardio
                ex_obj = cardio_ex.get(weekday)
                if ex_obj:
                    candidates, dist_base, pace_start, pace_end, dur_var = CARDIO_SCHEDULE[weekday]
                    progress_ratio = min(1.0, days_passed / 180)

                    # Distance: ramp from 60% to 140% of base over 6 months
                    dist_km = round(dist_base * (0.6 + 0.8 * progress_ratio) + random.uniform(-0.2, 0.2), 1)
                    dist_km = max(1.0, dist_km)

                    # Pace: improve from pace_start to pace_end sec/km over 6 months
                    pace_sec = pace_start + (pace_end - pace_start) * progress_ratio
                    pace_sec = max(pace_end * 0.9, pace_sec + random.uniform(-5, 5))
                    pace_sec = round(pace_sec, 1)

                    duration_sec = round(dist_km * pace_sec)

                    session_hour = random.randint(7, 9) if weekday in (1, 3) else random.randint(9, 11)
                    session_time = current_date.replace(hour=session_hour, minute=random.choice([0, 15, 30]))
                    cardio_session = Session(
                        user_id=demo_user.id,
                        routine_id=None,
                        day_index=None,
                        started_at=session_time,
                        completed_at=session_time + timedelta(seconds=duration_sec + random.randint(-120, 120)),
                    )
                    db.add(cardio_session)
                    db.flush()

                    cardio_set = Set(
                        session_id=cardio_session.id,
                        exercise_id=ex_obj.id,
                        set_number=1,
                        distance_km=dist_km,
                        duration_sec=duration_sec,
                        avg_pace=pace_sec,
                        completed_at=session_time + timedelta(seconds=duration_sec),
                    )
                    db.add(cardio_set)
                    cardio_count += 1

        current_date += timedelta(days=1)

    db.commit()

    # ── Weekly body weight logs ─────────────────────────────────────────
    # Realistic: starts ~81 kg, slight downward trend to ~77.5 over 6 months
    weight_date = start_date + timedelta(days=3)  # first log after a few days
    weight_kg = 81.0
    weight_target = 77.5
    total_weight_weeks = 26
    weight_week = 0
    while weight_date < datetime.now():
        progress = min(1.0, weight_week / total_weight_weeks)
        ideal_weight = 81.0 + (weight_target - 81.0) * progress
        weight_kg = round(ideal_weight + random.uniform(-0.8, 0.8), 1)
        measured_at = weight_date.replace(hour=8, minute=0, tzinfo=timezone.utc)
        wl = WeightLog(
            user_id=demo_user.id,
            weight_kg=weight_kg,
            measured_at=measured_at,
            source="manual",
        )
        db.add(wl)
        weight_date += timedelta(weeks=1)
        weight_week += 1

    demo_user.weight = weight_kg  # Update profile to last logged weight
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
        if q.req_type == "sessions":
            progress = min(session_count, q.req_value)
        elif q.req_type == "sets":
            progress = min(session_count * 18, q.req_value)
        elif q.req_type == "volume":
            progress = min(session_count * 3000, q.req_value)

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
    print(f"Demo seed complete. {session_count} strength + {cardio_count} cardio sessions for {DEMO_EMAIL} (Level {level}, {coins} coins)")


if __name__ == "__main__":
    seed_demo()
