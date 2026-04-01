"""
Tests for the weight log endpoints:
  POST   /api/weight
  GET    /api/weight
  GET    /api/weight/stats
  PUT    /api/weight/{id}
  DELETE /api/weight/{id}
  GET    /api/weight/demo
  GET    /api/weight/stats/demo
"""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import sessionmaker
from tests.conftest import register_and_login

from app.models.user import User
from app.models.weight_log import WeightLog


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _days_ago_iso(days: int):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _seed_demo_user(db_engine):
    """Create demo@gymtracker.app with 3 weight log entries in the test DB."""
    Session = sessionmaker(bind=db_engine)
    db = Session()
    try:
        demo = User(
            email="demo@gymtracker.app",
            password_hash="hashed",
            is_active=True,
            is_demo=True,
            weight=78,
        )
        db.add(demo)
        db.flush()
        now = datetime.now(timezone.utc)
        # oldest → newest: 80.5, 79.0, 78.2
        for i, w in enumerate([80.5, 79.0, 78.2]):
            db.add(WeightLog(
                user_id=demo.id,
                weight_kg=w,
                measured_at=now - timedelta(days=30 - i * 7),
                source="manual",
            ))
        db.commit()
    finally:
        db.close()


class TestWeightCRUD:
    def test_log_weight(self, client):
        headers = register_and_login(client)
        r = client.post("/api/weight", json={"weight_kg": 75.5}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["weight_kg"] == 75.5
        assert data["source"] == "manual"
        assert "id" in data
        assert "measured_at" in data

    def test_log_weight_syncs_user_profile(self, client):
        headers = register_and_login(client)
        client.post("/api/weight", json={"weight_kg": 83.7}, headers=headers)
        me = client.get("/api/auth/me", headers=headers).json()
        assert me["weight"] == 84  # rounded to nearest int

    def test_log_weight_custom_date(self, client):
        headers = register_and_login(client)
        custom_date = "2024-06-15T09:00:00+00:00"
        r = client.post("/api/weight", json={"weight_kg": 72.0, "measured_at": custom_date}, headers=headers)
        assert r.status_code == 200
        assert "2024-06-15" in r.json()["measured_at"]

    def test_get_weight_history(self, client):
        headers = register_and_login(client)
        client.post("/api/weight", json={"weight_kg": 70.0, "measured_at": _days_ago_iso(2)}, headers=headers)
        client.post("/api/weight", json={"weight_kg": 71.0, "measured_at": _days_ago_iso(1)}, headers=headers)
        r = client.get("/api/weight", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 2
        # Ordered desc — most recent first
        assert data[0]["weight_kg"] == 71.0
        assert data[1]["weight_kg"] == 70.0

    def test_get_weight_history_days_filter(self, client):
        headers = register_and_login(client)
        client.post("/api/weight", json={"weight_kg": 80.0, "measured_at": _days_ago_iso(60)}, headers=headers)
        client.post("/api/weight", json={"weight_kg": 78.0, "measured_at": _days_ago_iso(1)}, headers=headers)
        r = client.get("/api/weight?days=30", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["weight_kg"] == 78.0

    def test_get_weight_history_empty(self, client):
        headers = register_and_login(client)
        r = client.get("/api/weight", headers=headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_get_weight_stats(self, client):
        headers = register_and_login(client)
        client.post("/api/weight", json={"weight_kg": 75.0, "measured_at": _days_ago_iso(14)}, headers=headers)
        client.post("/api/weight", json={"weight_kg": 80.0, "measured_at": _days_ago_iso(7)}, headers=headers)
        client.post("/api/weight", json={"weight_kg": 70.0, "measured_at": _days_ago_iso(1)}, headers=headers)
        r = client.get("/api/weight/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["min"] == 70.0
        assert data["max"] == 80.0
        assert data["avg"] == 75.0
        assert data["count"] == 3
        assert data["current"] == 70.0  # most recent log

    def test_get_weight_stats_empty(self, client):
        headers = register_and_login(client)
        r = client.get("/api/weight/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0
        assert data["current"] is None

    def test_update_weight_log(self, client):
        headers = register_and_login(client)
        log = client.post("/api/weight", json={"weight_kg": 75.0}, headers=headers).json()
        r = client.put(f"/api/weight/{log['id']}", json={"weight_kg": 77.5}, headers=headers)
        assert r.status_code == 200
        assert r.json()["weight_kg"] == 77.5

    def test_update_weight_log_not_found(self, client):
        headers = register_and_login(client)
        r = client.put("/api/weight/99999", json={"weight_kg": 75.0}, headers=headers)
        assert r.status_code == 404

    def test_update_weight_log_other_user(self, client):
        headers_a = register_and_login(client, "a@example.com")
        headers_b = register_and_login(client, "b@example.com")
        log = client.post("/api/weight", json={"weight_kg": 70.0}, headers=headers_a).json()
        r = client.put(f"/api/weight/{log['id']}", json={"weight_kg": 99.0}, headers=headers_b)
        assert r.status_code == 404

    def test_delete_weight_log(self, client):
        headers = register_and_login(client)
        log = client.post("/api/weight", json={"weight_kg": 75.0}, headers=headers).json()
        r = client.delete(f"/api/weight/{log['id']}", headers=headers)
        assert r.status_code == 200
        history = client.get("/api/weight", headers=headers).json()
        assert all(entry["id"] != log["id"] for entry in history)

    def test_delete_weight_log_not_found(self, client):
        headers = register_and_login(client)
        r = client.delete("/api/weight/99999", headers=headers)
        assert r.status_code == 404

    def test_delete_weight_log_other_user(self, client):
        headers_a = register_and_login(client, "a@example.com")
        headers_b = register_and_login(client, "b@example.com")
        log = client.post("/api/weight", json={"weight_kg": 70.0}, headers=headers_a).json()
        r = client.delete(f"/api/weight/{log['id']}", headers=headers_b)
        assert r.status_code == 404

    def test_weight_unauthenticated(self, client):
        assert client.get("/api/weight").status_code == 401
        assert client.post("/api/weight", json={"weight_kg": 70.0}).status_code == 401
        assert client.get("/api/weight/stats").status_code == 401
        assert client.put("/api/weight/1", json={"weight_kg": 70.0}).status_code == 401
        assert client.delete("/api/weight/1").status_code == 401


class TestWeightDemo:
    def test_weight_demo_history(self, client, db_engine):
        _seed_demo_user(db_engine)
        r = client.get("/api/weight/demo")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 3
        weights = {d["weight_kg"] for d in data}
        assert 78.2 in weights
        assert 80.5 in weights

    def test_weight_demo_history_no_demo_user(self, client):
        r = client.get("/api/weight/demo")
        assert r.status_code == 200
        assert r.json() == []

    def test_weight_stats_demo(self, client, db_engine):
        _seed_demo_user(db_engine)
        r = client.get("/api/weight/stats/demo")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 3
        assert data["min"] == 78.2
        assert data["max"] == 80.5
        assert data["current"] == 78.2  # most recently logged (16 days ago)
        assert data["avg"] is not None

    def test_weight_stats_demo_no_demo_user(self, client):
        r = client.get("/api/weight/stats/demo")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0
        assert data["current"] is None
