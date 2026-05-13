from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import sessionmaker

from app.effort_score import compute_effort_score
from app.models.exercise import Exercise
from app.models.routine import Routine
from app.models.session import Session as SessionModel, Set as SetModel
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _exercise(name: str) -> Exercise:
    return Exercise(name=name, muscle="Chest", equipment="Barbell", type="Strength")


def _routine(user_id: int, name: str = "R") -> Routine:
    return Routine(user_id=user_id, name=name, days=[{"day_name": "A", "exercises": []}])


class TestEffortScore:
    def test_first_cycle_returns_none(self, db_engine):
        """Very first time doing a given (routine, day_index) yields no score."""
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort1@example.com", password_hash="x", settings={"failure_tracking_enabled": False})
            db.add(user)
            db.flush()

            routine = _routine(user.id)
            db.add(routine)
            db.flush()

            ex = _exercise("Bench Press")
            db.add(ex)
            db.flush()

            s = SessionModel(
                user_id=user.id,
                routine_id=routine.id,
                day_index=0,
                started_at=_now() - timedelta(hours=1),
                completed_at=_now(),
                self_rated_effort=7,
            )
            db.add(s)
            db.flush()

            db.add(SetModel(
                session_id=s.id,
                exercise_id=ex.id,
                set_number=1,
                weight_kg=100,
                reps=10,
                set_type="normal",
                to_failure=False,
                completed_at=_now(),
            ))
            db.commit()

            assert compute_effort_score(db, user.id, s) is None
        finally:
            db.close()

    def test_session_without_routine_or_day_index_returns_none(self, db_engine):
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort_noroute@example.com", password_hash="x", settings={})
            db.add(user)
            db.flush()

            s = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(hours=1),
                completed_at=_now(),
                self_rated_effort=7,
            )
            db.add(s)
            db.flush()
            db.commit()

            assert compute_effort_score(db, user.id, s) is None
        finally:
            db.close()

    def test_only_compares_against_same_day_index(self, db_engine):
        """Day 2 cycle 2 should NOT compare against Day 1 of the same routine."""
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort_day@example.com", password_hash="x", settings={"failure_tracking_enabled": False})
            db.add(user)
            db.flush()

            routine = _routine(user.id)
            db.add(routine)
            db.flush()

            ex = _exercise("Squat")
            db.add(ex)
            db.flush()

            # Cycle 1 Day 0 — heavy
            c1_d0 = SessionModel(
                user_id=user.id, routine_id=routine.id, day_index=0,
                started_at=_now() - timedelta(days=4), completed_at=_now() - timedelta(days=4),
                self_rated_effort=7,
            )
            db.add(c1_d0)
            db.flush()
            db.add(SetModel(session_id=c1_d0.id, exercise_id=ex.id, set_number=1,
                            weight_kg=200, reps=5, set_type="normal", completed_at=_now()))

            # Cycle 1 Day 1 — lighter
            c1_d1 = SessionModel(
                user_id=user.id, routine_id=routine.id, day_index=1,
                started_at=_now() - timedelta(days=3), completed_at=_now() - timedelta(days=3),
                self_rated_effort=6,
            )
            db.add(c1_d1)
            db.flush()
            db.add(SetModel(session_id=c1_d1.id, exercise_id=ex.id, set_number=1,
                            weight_kg=50, reps=10, set_type="normal", completed_at=_now()))

            # Cycle 2 Day 1 — should compare to Cycle 1 Day 1 (light), not Day 0 (heavy)
            c2_d1 = SessionModel(
                user_id=user.id, routine_id=routine.id, day_index=1,
                started_at=_now() - timedelta(hours=1), completed_at=_now(),
                self_rated_effort=7,
            )
            db.add(c2_d1)
            db.flush()
            db.add(SetModel(session_id=c2_d1.id, exercise_id=ex.id, set_number=1,
                            weight_kg=55, reps=10, set_type="normal", completed_at=_now()))
            db.commit()

            score = compute_effort_score(db, user.id, c2_d1)
            # If we'd accidentally paired against day 0 (200kg × 5 = 1000), the
            # ratio would be ~0.55 and volume_factor would crash to 0.
            # Correctly paired against day 1 (50 × 10 = 500): ratio 1.1 -> ~73.
            assert score is not None
            assert score > 50.0
        finally:
            db.close()

    def test_paired_cycle_2_uses_cycle_1_baseline(self, db_engine):
        """Cycle 2 of same (routine, day_index) gets a real score."""
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort_paired@example.com", password_hash="x", settings={"failure_tracking_enabled": True})
            db.add(user)
            db.flush()

            routine = _routine(user.id)
            db.add(routine)
            db.flush()

            ex1 = _exercise("Bench Press")
            ex2 = _exercise("Incline Press")
            db.add_all([ex1, ex2])
            db.flush()

            prev = SessionModel(
                user_id=user.id, routine_id=routine.id, day_index=0,
                started_at=_now() - timedelta(days=2, hours=1), completed_at=_now() - timedelta(days=2),
                self_rated_effort=6,
            )
            db.add(prev)
            db.flush()
            db.add_all([
                SetModel(session_id=prev.id, exercise_id=ex1.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()),
                SetModel(session_id=prev.id, exercise_id=ex2.id, set_number=2, weight_kg=80, reps=10, set_type="normal", completed_at=_now()),
            ])

            current = SessionModel(
                user_id=user.id, routine_id=routine.id, day_index=0,
                started_at=_now() - timedelta(hours=1), completed_at=_now(),
                self_rated_effort=7,
            )
            db.add(current)
            db.flush()
            db.add_all([
                SetModel(session_id=current.id, exercise_id=ex1.id, set_number=1, weight_kg=110, reps=10, set_type="normal", to_failure=True, completed_at=_now()),
                SetModel(session_id=current.id, exercise_id=ex2.id, set_number=2, weight_kg=80, reps=10, set_type="normal", to_failure=False, completed_at=_now()),
                SetModel(session_id=current.id, exercise_id=ex2.id, set_number=3, weight_kg=55, reps=10, set_type="drop", to_failure=False, completed_at=_now()),
            ])
            db.commit()

            score = compute_effort_score(db, user.id, current)
            assert score is not None and score > 50.0
        finally:
            db.close()

    def test_other_routine_does_not_count_as_baseline(self, db_engine):
        """Sessions on a different routine don't unlock scoring for this one."""
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort_iso@example.com", password_hash="x", settings={"failure_tracking_enabled": False})
            db.add(user)
            db.flush()

            routine_a = _routine(user.id, "A")
            routine_b = _routine(user.id, "B")
            db.add_all([routine_a, routine_b])
            db.flush()

            ex = _exercise("Bench Press")
            db.add(ex)
            db.flush()

            # Lots of sessions on routine A
            for i in range(3):
                s = SessionModel(
                    user_id=user.id, routine_id=routine_a.id, day_index=0,
                    started_at=_now() - timedelta(days=10 - i), completed_at=_now() - timedelta(days=10 - i),
                    self_rated_effort=7,
                )
                db.add(s)
                db.flush()
                db.add(SetModel(session_id=s.id, exercise_id=ex.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()))

            # First-ever session on routine B
            first_b = SessionModel(
                user_id=user.id, routine_id=routine_b.id, day_index=0,
                started_at=_now() - timedelta(hours=1), completed_at=_now(),
                self_rated_effort=7,
            )
            db.add(first_b)
            db.flush()
            db.add(SetModel(session_id=first_b.id, exercise_id=ex.id, set_number=1, weight_kg=110, reps=10, set_type="normal", completed_at=_now()))
            db.commit()

            assert compute_effort_score(db, user.id, first_b) is None
        finally:
            db.close()

    def test_no_self_rating_returns_none(self, db_engine):
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort_noself@example.com", password_hash="x", settings={})
            db.add(user)
            db.flush()
            routine = _routine(user.id)
            db.add(routine)
            db.flush()

            ex = _exercise("Bench Press")
            db.add(ex)
            db.flush()

            prev = SessionModel(user_id=user.id, routine_id=routine.id, day_index=0,
                                started_at=_now() - timedelta(days=2), completed_at=_now() - timedelta(days=2),
                                self_rated_effort=7)
            db.add(prev)
            db.flush()
            db.add(SetModel(session_id=prev.id, exercise_id=ex.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()))

            current = SessionModel(user_id=user.id, routine_id=routine.id, day_index=0,
                                   started_at=_now() - timedelta(hours=1), completed_at=_now(),
                                   self_rated_effort=None)
            db.add(current)
            db.flush()
            db.add(SetModel(session_id=current.id, exercise_id=ex.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()))
            db.commit()

            assert compute_effort_score(db, user.id, current) is None
        finally:
            db.close()
