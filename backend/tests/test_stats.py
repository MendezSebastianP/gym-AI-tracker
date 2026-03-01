"""
Tests for the stats endpoint:
  GET /stats/weekly
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
        r = client.get("/stats/weekly", headers=headers)
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
        r = client.get("/stats/weekly", headers=headers)
        assert r.status_code == 200
        assert r.json()["sessions"] == 2

    def test_stats_volume_calculation(self, client):
        """Volume should be weight_kg * reps for each set."""
        headers = register_and_login(client)
        session = self._create_completed_session(client, headers)
        self._add_set_to_session(client, headers, session["id"], weight=100.0, reps=10)  # 1000 kg
        self._add_set_to_session(client, headers, session["id"], weight=50.0, reps=8)   # 400 kg
        r = client.get("/stats/weekly", headers=headers)
        assert r.status_code == 200
        assert r.json()["volume"] == 1400

    def test_stats_streak_this_week(self, client):
        """Having a session this week starts a streak of 1."""
        headers = register_and_login(client)
        self._create_completed_session(client, headers, started_offset_days=0)
        r = client.get("/stats/weekly", headers=headers)
        assert r.json()["streak_weeks"] >= 1

    def test_stats_multi_week_streak(self, client):
        headers = register_and_login(client)
        # Create sessions spanning 3 consecutive weeks
        self._create_completed_session(client, headers, started_offset_days=0)
        self._create_completed_session(client, headers, started_offset_days=7)
        self._create_completed_session(client, headers, started_offset_days=14)
        
        r = client.get("/stats/weekly", headers=headers)
        assert r.json()["streak_weeks"] >= 3

    def test_stats_user_isolation(self, client):
        """Stats are per-user; User B's sessions don't appear in User A's stats."""
        headers_a = register_and_login(client, "a@example.com")
        headers_b = register_and_login(client, "b@example.com")
        self._create_completed_session(client, headers_b)

        r = client.get("/stats/weekly", headers=headers_a)
        assert r.json()["sessions"] == 0

    def test_stats_unauthenticated(self, client):
        r = client.get("/stats/weekly")
        assert r.status_code == 401

    def test_only_completed_sessions_count(self, client):
        """Incomplete (active) sessions must NOT be counted in stats."""
        headers = register_and_login(client)
        # Incomplete session (no completed_at)
        client.post("/api/sessions/", json={"started_at": _iso(_now())}, headers=headers)
        r = client.get("/stats/weekly", headers=headers)
        assert r.json()["sessions"] == 0
