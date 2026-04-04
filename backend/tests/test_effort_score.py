from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import sessionmaker

from app.effort_score import compute_effort_score
from app.models.exercise import Exercise
from app.models.session import Session as SessionModel, Set as SetModel
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _exercise(name: str) -> Exercise:
    return Exercise(name=name, muscle="Chest", equipment="Barbell", type="Strength")


class TestEffortScore:
    def test_first_session_is_neutral_without_history(self, db_engine):
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort1@example.com", password_hash="x", settings={"failure_tracking_enabled": False})
            db.add(user)
            db.flush()

            ex = _exercise("Bench Press")
            db.add(ex)
            db.flush()

            s = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(hours=1),
                completed_at=_now(),
                self_rated_effort=None,
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

            score = compute_effort_score(db, user.id, s)
            assert score == 50.0
        finally:
            db.close()

    def test_failure_enabled_score_combines_all_factors(self, db_engine):
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort2@example.com", password_hash="x", settings={"failure_tracking_enabled": True})
            db.add(user)
            db.flush()

            ex1 = _exercise("Bench Press")
            ex2 = _exercise("Incline Press")
            db.add_all([ex1, ex2])
            db.flush()

            prev = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(days=2, hours=1),
                completed_at=_now() - timedelta(days=2),
                self_rated_effort=6,
            )
            db.add(prev)
            db.flush()
            db.add_all([
                SetModel(session_id=prev.id, exercise_id=ex1.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()),
                SetModel(session_id=prev.id, exercise_id=ex2.id, set_number=2, weight_kg=80, reps=10, set_type="normal", completed_at=_now()),
            ])

            current = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(hours=1),
                completed_at=_now(),
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
            # drop sets are ignored in effort math.
            # volume~62.8 (1900/1800 ratio), failure=50 (1/2 exercises), self=70 (rating 7),
            # progression=75 (1/2 exercises improved — formula: 50 + progressed/comparable * 50)
            # score = 62.8*0.15 + 50*0.30 + 70*0.30 + 75*0.25 = 9.42 + 15 + 21 + 18.75 = 64.17
            assert abs(score - 64.2) < 0.1
        finally:
            db.close()

    def test_failure_disabled_redistributes_weights(self, db_engine):
        Session = sessionmaker(bind=db_engine)
        db = Session()
        try:
            user = User(email="effort3@example.com", password_hash="x", settings={"failure_tracking_enabled": False})
            db.add(user)
            db.flush()

            ex = _exercise("Flat Press")
            db.add(ex)
            db.flush()

            prev = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(days=2, hours=1),
                completed_at=_now() - timedelta(days=2),
                self_rated_effort=6,
            )
            db.add(prev)
            db.flush()
            db.add(SetModel(session_id=prev.id, exercise_id=ex.id, set_number=1, weight_kg=100, reps=10, set_type="normal", completed_at=_now()))

            current = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(hours=1),
                completed_at=_now(),
                self_rated_effort=5,
            )
            db.add(current)
            db.flush()
            db.add(SetModel(
                session_id=current.id,
                exercise_id=ex.id,
                set_number=1,
                weight_kg=100,
                reps=10,
                set_type="normal",
                to_failure=True,
                completed_at=_now(),
            ))
            db.commit()

            score = compute_effort_score(db, user.id, current)
            # failure disabled -> volume=50 (same volume as prev), self=50 (rating 5),
            # progression=50 (0/1 exercises improved — formula: 50 + 0*50 = neutral 50)
            # 50*0.27 + 50*0.40 + 50*0.33 = 13.5 + 20 + 16.5 = 50.0
            assert abs(score - 50.0) < 0.1
        finally:
            db.close()
