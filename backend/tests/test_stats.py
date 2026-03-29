"""
Tests for the stats endpoint:
  GET /api/stats/weekly
"""
import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import register_and_login


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _now():
    return datetime.now(timezone.utc)


class TestWeeklyStats:
    def _create_completed_session(self, client, headers, started_offset_days: int = 0):
        """Helper: create a completed session N days ago."""
        started = _now() - timedelta(days=started_offset_days, hours=1)
        completed = started + timedelta(hours=1)
        r = client.post("/api/sessions/", json={
            "started_at": _iso(started),
            "completed_at": _iso(completed),
        }, headers=headers)
        assert r.status_code == 200
        return r.json()

    def _add_set_to_session(self, client, headers, session_id: int, weight: float = 100.0, reps: int = 10):
        r = client.post("/api/sets/", json={
            "session_id": session_id,
            "exercise_id": 1,
            "set_number": 1,
            "weight_kg": weight,
            "reps": reps,
            "completed_at": _iso(_now()),
        }, headers=headers)
        assert r.status_code == 200
        return r.json()

    def test_stats_empty_user(self, client):
        """A fresh user with no sessions returns zero stats."""
        headers = register_and_login(client)
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["sessions"] == 0
        assert data["volume"] == 0
        assert data["streak_weeks"] == 0
        assert len(data["weekly_sessions"]) == 8
        assert len(data["daily_sessions"]) == 7

    def test_stats_with_sessions(self, client):
        """Completed sessions increment total_sessions count."""
        headers = register_and_login(client)
        self._create_completed_session(client, headers)
        self._create_completed_session(client, headers)
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.status_code == 200
        assert r.json()["sessions"] == 2

    def test_stats_volume_calculation(self, client):
        """Volume should be weight_kg * reps for each set."""
        headers = register_and_login(client)
        session = self._create_completed_session(client, headers)
        self._add_set_to_session(client, headers, session["id"], weight=100.0, reps=10)  # 1000 kg
        self._add_set_to_session(client, headers, session["id"], weight=50.0, reps=8)   # 400 kg
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.status_code == 200
        assert r.json()["volume"] == 1400

    def test_stats_streak_this_week(self, client):
        """Having a session this week starts a streak of 1."""
        headers = register_and_login(client)
        self._create_completed_session(client, headers, started_offset_days=0)
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.json()["streak_weeks"] >= 1

    def test_stats_multi_week_streak(self, client):
        headers = register_and_login(client)
        # Create sessions spanning 3 consecutive weeks
        self._create_completed_session(client, headers, started_offset_days=0)
        self._create_completed_session(client, headers, started_offset_days=7)
        self._create_completed_session(client, headers, started_offset_days=14)
        
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.json()["streak_weeks"] >= 3

    def test_stats_user_isolation(self, client):
        """Stats are per-user; User B's sessions don't appear in User A's stats."""
        headers_a = register_and_login(client, "a@example.com")
        headers_b = register_and_login(client, "b@example.com")
        self._create_completed_session(client, headers_b)

        r = client.get("/api/stats/weekly", headers=headers_a)
        assert r.json()["sessions"] == 0

    def test_stats_unauthenticated(self, client):
        r = client.get("/api/stats/weekly")
        assert r.status_code == 401

    def test_only_completed_sessions_count(self, client):
        """Incomplete (active) sessions must NOT be counted in stats."""
        headers = register_and_login(client)
        # Incomplete session (no completed_at)
        client.post("/api/sessions/", json={"started_at": _iso(_now())}, headers=headers)
        r = client.get("/api/stats/weekly", headers=headers)
        assert r.json()["sessions"] == 0

class TestNSSAlgorithms:
    def _create_session_with_exercise(self, client, headers, ex_name: str, weight: float, reps: int):
        # Create session
        r = client.post("/api/sessions/", json={"started_at": _iso(_now())}, headers=headers)
        session_id = r.json()["id"]

        # Provide defaults for bodyweight flags
        is_bw = True if ("Pull Up" in ex_name or "Dip" in ex_name) else False

        # Create exercise dynamically since test DB is empty
        r = client.post("/api/exercises", json={
            "name": ex_name,
            "muscle": "Back",
            "equipment": "Bodyweight" if is_bw else "Barbell",
            "type": "bodyweight" if is_bw else "weighted",
            "is_bodyweight": is_bw,
            "difficulty_factor": 1.0, # Will be ignored/overwritten by stats engine for NSS logic
            "bw_ratio": 1.0 if "Assisted" not in ex_name else 0.50
        }, headers=headers)
        ex_id = r.json().get("id")
        
        # If exercise creation fails because admin endpoint requires logic, fallback to pure db logic instead
        # Wait, the POST /api/exercises endpoint is standard for custom exercises.
        assert ex_id is not None, f"Failed to create exercise {ex_name}: {r.json()}"

        # add set
        client.post("/api/sets/", json={
            "session_id": session_id,
            "exercise_id": ex_id,
            "set_number": 1,
            "weight_kg": weight,
            "reps": reps,
            "completed_at": _iso(_now()),
        }, headers=headers)

        # Complete session via bulk
        client.post(f"/api/sessions/{session_id}/complete_bulk", json={
            "completed_at": _iso(_now()),
            "notes": "",
            "sets": [{
                "exercise_id": ex_id,
                "set_number": 1,
                "weight_kg": weight,
                "reps": reps,
                "duration_sec": 30,
                "rpe": 8,
                "completed_at": _iso(_now())
            }]
        }, headers=headers)

        return session_id

    def test_nss_historical_bodyweight_snapshot(self, client):
        headers = register_and_login(client, "snapshot@example.com")
        
        # User is default weight (e.g. 65kg) inside _compute_progress if not set, let's explicitly set it to 50kg
        client.put("/api/auth/me", json={"weight": 50.0}, headers=headers)
        
        # Log a pure Pull Up (bw_ratio = 1.0)
        self._create_session_with_exercise(client, headers, "Pull Up", weight=0.0, reps=10)
        
        # Assert NSS at 50kg -> (50 * 1.0) * (1 + 10/30) = 50 * 1.333 = ~66.7
        r = client.get("/api/stats/progress?muscle=Back", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert 66.0 <= data[0]["nss"] <= 67.0
        
        # Now User BULKS to 100kg
        client.put("/api/auth/me", json={"weight": 100.0}, headers=headers)
        
        # Historical progress should REMAIN at ~66.7, NOT shoot up to 133.3 (100 * 1.333)
        r = client.get("/api/stats/progress?muscle=Back", headers=headers)
        assert 66.0 <= r.json()[0]["nss"] <= 67.0

    def test_nss_assisted_pull_up_overrides(self, client):
        headers = register_and_login(client, "assisted@example.com")
        client.put("/api/auth/me", json={"weight": 80.0}, headers=headers)
        
        # 1. Standard Assisted Reps (e.g. 20kg assistance) -> BW = 80 - 20 = 60kg. Ratio = 0.50 -> 30kg eff * 1.333
        self._create_session_with_exercise(client, headers, "Assisted Pull Up", weight=20.0, reps=10)
        r = client.get("/api/stats/progress", headers=headers)
        assert r.status_code == 200
        assisted_nss = r.json()[0]["nss"]
        # 30 * 1.333 = ~40.0
        assert 39.0 <= assisted_nss <= 41.0
        
        # 2. Drop Set Pure Reps (0kg assistance) -> Drops ratio 0.50 back to 1.00. 80kg eff * 1.333
        self._create_session_with_exercise(client, headers, "Assisted Pull Up", weight=0.0, reps=10)
        r = client.get("/api/stats/progress", headers=headers)
        pure_override_nss = r.json()[1]["nss"]
        # 80 * 1.333 = ~106.7
        assert 106.0 <= pure_override_nss <= 107.0
        assert pure_override_nss > assisted_nss


class TestCardioStats:
    def _create_cardio_exercise(self, client, headers, name="Running"):
        r = client.post("/api/exercises", json={
            "name": name,
            "muscle": "Cardio",
            "muscle_group": "Cardio",
            "equipment": "None",
            "type": "Cardio",
            "is_bodyweight": False,
        }, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def _create_cardio_session(self, client, headers, exercise_id, distance_km, pace_sec, days_ago=0):
        started = _now() - timedelta(days=days_ago, hours=1)
        completed = started + timedelta(hours=1)
        r = client.post("/api/sessions/", json={
            "started_at": _iso(started),
            "completed_at": _iso(completed),
        }, headers=headers)
        assert r.status_code == 200
        session_id = r.json()["id"]
        duration_sec = round(distance_km * pace_sec)
        client.post("/api/sets/", json={
            "session_id": session_id,
            "exercise_id": exercise_id,
            "set_number": 1,
            "distance_km": distance_km,
            "duration_sec": duration_sec,
            "avg_pace": pace_sec,
            "completed_at": _iso(completed),
        }, headers=headers)
        return session_id

    def test_cardio_stats_empty(self, client):
        headers = register_and_login(client)
        r = client.get("/api/stats/cardio", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total_distance_km"] == 0
        assert data["total_sessions"] == 0
        assert data["distance_trend"] == []
        assert data["pace_trend"] == []

    def test_cardio_stats_totals(self, client):
        headers = register_and_login(client)
        ex_id = self._create_cardio_exercise(client, headers)
        for i in range(3):
            self._create_cardio_session(client, headers, ex_id, distance_km=5.0, pace_sec=360.0, days_ago=i)
        r = client.get("/api/stats/cardio", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert abs(data["total_distance_km"] - 15.0) < 0.1
        assert data["total_sessions"] == 3

    def test_cardio_stats_distance_trend(self, client):
        headers = register_and_login(client)
        ex_id = self._create_cardio_exercise(client, headers)
        self._create_cardio_session(client, headers, ex_id, distance_km=5.0, pace_sec=360.0, days_ago=1)
        self._create_cardio_session(client, headers, ex_id, distance_km=6.0, pace_sec=350.0, days_ago=0)
        r = client.get("/api/stats/cardio", headers=headers)
        trend = r.json()["distance_trend"]
        assert len(trend) == 2
        distances = [t["distance_km"] for t in trend]
        assert 5.0 in distances
        assert 6.0 in distances

    def test_cardio_stats_pace_trend(self, client):
        headers = register_and_login(client)
        ex_id = self._create_cardio_exercise(client, headers)
        self._create_cardio_session(client, headers, ex_id, distance_km=5.0, pace_sec=360.0, days_ago=0)
        r = client.get("/api/stats/cardio", headers=headers)
        pace_trend = r.json()["pace_trend"]
        assert len(pace_trend) == 1
        assert pace_trend[0]["avg_pace"] == 360.0

    def test_cardio_stats_exercise_filter(self, client):
        headers = register_and_login(client)
        running_id = self._create_cardio_exercise(client, headers, name="Running")
        cycling_id = self._create_cardio_exercise(client, headers, name="Cycling")
        self._create_cardio_session(client, headers, running_id, distance_km=5.0, pace_sec=360.0, days_ago=2)
        self._create_cardio_session(client, headers, running_id, distance_km=5.5, pace_sec=355.0, days_ago=1)
        self._create_cardio_session(client, headers, cycling_id, distance_km=20.0, pace_sec=180.0, days_ago=0)
        r = client.get(f"/api/stats/cardio?exercise_id={running_id}", headers=headers)
        data = r.json()
        assert data["total_sessions"] == 2
        assert all(t["exercise"] == "Running" for t in data["distance_trend"])

    def test_cardio_stats_days_filter(self, client):
        headers = register_and_login(client)
        ex_id = self._create_cardio_exercise(client, headers)
        # One session 60 days ago, one today
        self._create_cardio_session(client, headers, ex_id, distance_km=5.0, pace_sec=360.0, days_ago=60)
        self._create_cardio_session(client, headers, ex_id, distance_km=6.0, pace_sec=350.0, days_ago=0)
        r = client.get("/api/stats/cardio?days=30", headers=headers)
        data = r.json()
        assert data["total_sessions"] == 1
        assert abs(data["total_distance_km"] - 6.0) < 0.1

    def test_cardio_exercises_empty(self, client):
        headers = register_and_login(client)
        r = client.get("/api/stats/cardio/exercises", headers=headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_cardio_exercises_sorted(self, client):
        headers = register_and_login(client)
        running_id = self._create_cardio_exercise(client, headers, name="Running")
        cycling_id = self._create_cardio_exercise(client, headers, name="Cycling")
        for _ in range(3):
            self._create_cardio_session(client, headers, running_id, distance_km=5.0, pace_sec=360.0)
        self._create_cardio_session(client, headers, cycling_id, distance_km=20.0, pace_sec=180.0)
        r = client.get("/api/stats/cardio/exercises", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["name"] == "Running"
        assert data[0]["session_count"] == 3
        assert data[1]["name"] == "Cycling"
        assert data[1]["session_count"] == 1

    def test_cardio_endpoints_unauthenticated(self, client):
        assert client.get("/api/stats/cardio").status_code == 401
        assert client.get("/api/stats/cardio/exercises").status_code == 401

    def test_cardio_stats_demo(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker as sm
        from app.models.user import User
        from app.models.session import Session as SessionModel, Set as SetModel
        from app.models.exercise import Exercise
        Session = sm(bind=db_engine)
        db = Session()
        try:
            demo = User(email="demo@gymtracker.app", password_hash="h", is_active=True, is_demo=True)
            db.add(demo)
            db.flush()
            ex = Exercise(name="Running", muscle="Cardio", muscle_group="Cardio",
                          equipment="None", type="Cardio", is_bodyweight=False)
            db.add(ex)
            db.flush()
            now = _now()
            for i in range(2):
                sess = SessionModel(
                    user_id=demo.id,
                    started_at=_now() - timedelta(days=i + 1, hours=2),
                    completed_at=_now() - timedelta(days=i + 1, hours=1),
                )
                db.add(sess)
                db.flush()
                db.add(SetModel(
                    session_id=sess.id, exercise_id=ex.id, set_number=1,
                    distance_km=5.0, duration_sec=1800, avg_pace=360.0,
                    completed_at=_now() - timedelta(hours=1),
                ))
            db.commit()
        finally:
            db.close()

        r = client.get("/api/stats/cardio/demo")
        assert r.status_code == 200
        data = r.json()
        assert data["total_sessions"] == 2
        assert abs(data["total_distance_km"] - 10.0) < 0.1

    def test_cardio_exercises_demo(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker as sm
        from app.models.user import User
        from app.models.session import Session as SessionModel, Set as SetModel
        from app.models.exercise import Exercise
        Session = sm(bind=db_engine)
        db = Session()
        try:
            demo = User(email="demo@gymtracker.app", password_hash="h", is_active=True, is_demo=True)
            db.add(demo)
            db.flush()
            ex = Exercise(name="Running", muscle="Cardio", muscle_group="Cardio",
                          equipment="None", type="Cardio", is_bodyweight=False)
            db.add(ex)
            db.flush()
            sess = SessionModel(
                user_id=demo.id,
                started_at=_now() - timedelta(hours=2),
                completed_at=_now() - timedelta(hours=1),
            )
            db.add(sess)
            db.flush()
            db.add(SetModel(
                session_id=sess.id, exercise_id=ex.id, set_number=1,
                distance_km=5.0, duration_sec=1800, avg_pace=360.0,
                completed_at=_now() - timedelta(hours=1),
            ))
            db.commit()
        finally:
            db.close()

        r = client.get("/api/stats/cardio/exercises/demo")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["name"] == "Running"
        assert data[0]["session_count"] == 1

    def test_cardio_demo_no_demo_user(self, client):
        r = client.get("/api/stats/cardio/demo")
        assert r.status_code == 200
        data = r.json()
        assert data["total_distance_km"] == 0
        assert data["distance_trend"] == []

        r2 = client.get("/api/stats/cardio/exercises/demo")
        assert r2.status_code == 200
        assert r2.json() == []


class TestEffortTrend:
    def test_effort_unauthenticated(self, client):
        r = client.get("/api/stats/effort")
        assert r.status_code == 401

    def test_effort_returns_score_or_self_rating(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker as sm
        from app.models.user import User
        from app.models.session import Session as SessionModel

        headers = register_and_login(client, "efforttrend@example.com")

        Session = sm(bind=db_engine)
        db = Session()
        try:
            user = db.query(User).filter(User.email == "efforttrend@example.com").one()

            # Should use effort_score as-is.
            s1 = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(days=3, hours=1),
                completed_at=_now() - timedelta(days=3),
                effort_score=73.4,
                self_rated_effort=5,
            )
            # effort_score missing -> fallback to self_rated_effort * 10.
            s2 = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(days=2, hours=1),
                completed_at=_now() - timedelta(days=2),
                effort_score=None,
                self_rated_effort=8,
            )
            # Missing both -> ignored.
            s3 = SessionModel(
                user_id=user.id,
                started_at=_now() - timedelta(days=1, hours=1),
                completed_at=_now() - timedelta(days=1),
                effort_score=None,
                self_rated_effort=None,
            )
            db.add_all([s1, s2, s3])
            db.commit()
        finally:
            db.close()

        r = client.get("/api/stats/effort?limit=12", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["index"] == 1
        assert data[0]["effort"] == 73.4
        assert data[1]["index"] == 2
        assert data[1]["effort"] == 80.0

    def test_effort_limit_and_clamp(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker as sm
        from app.models.user import User
        from app.models.session import Session as SessionModel

        headers = register_and_login(client, "effortclamp@example.com")

        Session = sm(bind=db_engine)
        db = Session()
        try:
            user = db.query(User).filter(User.email == "effortclamp@example.com").one()

            # Values should be clamped to [0, 100]
            rows = [
                SessionModel(
                    user_id=user.id,
                    started_at=_now() - timedelta(days=3, hours=1),
                    completed_at=_now() - timedelta(days=3),
                    effort_score=-20.0,
                    self_rated_effort=None,
                ),
                SessionModel(
                    user_id=user.id,
                    started_at=_now() - timedelta(days=2, hours=1),
                    completed_at=_now() - timedelta(days=2),
                    effort_score=130.0,
                    self_rated_effort=None,
                ),
                SessionModel(
                    user_id=user.id,
                    started_at=_now() - timedelta(days=1, hours=1),
                    completed_at=_now() - timedelta(days=1),
                    effort_score=65.2,
                    self_rated_effort=None,
                ),
            ]
            db.add_all(rows)
            db.commit()
        finally:
            db.close()

        r = client.get("/api/stats/effort?limit=2", headers=headers)
        assert r.status_code == 200
        data = r.json()
        # Keep only newest 2 points, re-indexed from 1.
        assert len(data) == 2
        assert data[0]["index"] == 1
        assert data[0]["effort"] == 100.0
        assert data[1]["index"] == 2
        assert data[1]["effort"] == 65.2

    def test_effort_demo_endpoint(self, client, db_engine):
        from sqlalchemy.orm import sessionmaker as sm
        from app.models.user import User
        from app.models.session import Session as SessionModel

        Session = sm(bind=db_engine)
        db = Session()
        try:
            demo = User(email="demo@gymtracker.app", password_hash="h", is_active=True, is_demo=True)
            db.add(demo)
            db.flush()
            db.add_all([
                SessionModel(
                    user_id=demo.id,
                    started_at=_now() - timedelta(days=2, hours=1),
                    completed_at=_now() - timedelta(days=2),
                    effort_score=61.0,
                    self_rated_effort=6,
                ),
                SessionModel(
                    user_id=demo.id,
                    started_at=_now() - timedelta(days=1, hours=1),
                    completed_at=_now() - timedelta(days=1),
                    effort_score=None,
                    self_rated_effort=9,
                ),
            ])
            db.commit()
        finally:
            db.close()

        r = client.get("/api/stats/effort/demo?limit=12")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        assert data[0]["effort"] == 61.0
        assert data[1]["effort"] == 90.0

    def test_effort_demo_no_demo_user(self, client):
        r = client.get("/api/stats/effort/demo")
        assert r.status_code == 200
        assert r.json() == []
