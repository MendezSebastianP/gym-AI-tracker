"""
Tests for session & set endpoints:
  POST   /api/sessions/
  GET    /api/sessions/
  GET    /api/sessions/{id}
  PUT    /api/sessions/{id}
  DELETE /api/sessions/{id}
  POST   /api/sets/
  PUT    /api/sets/{id}
  DELETE /api/sets/{id}
"""
import pytest
from datetime import datetime, timezone
from tests.conftest import register_and_login


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class TestSessions:
    def _create_session(self, client, headers, **kwargs):
        payload = {
            "started_at": _now_iso(),
            "completed_at": None,
            "notes": None,
            **kwargs,
        }
        r = client.post("/api/sessions/", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_session(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        assert "id" in session
        assert session["user_id"] is not None

    def test_create_session_with_routine(self, client):
        headers = register_and_login(client)
        r_routine = client.post("/api/routines/", json={"name": "PPL", "days": []}, headers=headers)
        routine_id = r_routine.json()["id"]
        session = self._create_session(client, headers, routine_id=routine_id, day_index=0)
        assert session["routine_id"] == routine_id
        assert session["day_index"] == 0

    def test_list_sessions(self, client):
        headers = register_and_login(client)
        self._create_session(client, headers)
        self._create_session(client, headers)
        r = client.get("/api/sessions/", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_get_session_by_id(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers, notes="test notes")
        r = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["notes"] == "test notes"

    def test_get_session_not_found(self, client):
        headers = register_and_login(client)
        r = client.get("/api/sessions/9999", headers=headers)
        assert r.status_code == 404

    def test_update_session(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        completed = _now_iso()
        r = client.put(f"/api/sessions/{session['id']}", json={"completed_at": completed}, headers=headers)
        assert r.status_code == 200
        assert r.json()["completed_at"] is not None

    def test_delete_session(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        r = client.delete(f"/api/sessions/{session['id']}", headers=headers)
        assert r.status_code == 200
        # Verify it's gone
        r2 = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert r2.status_code == 404

    def test_sessions_are_user_isolated(self, client):
        headers_a = register_and_login(client, "userA@example.com")
        headers_b = register_and_login(client, "userB@example.com")
        self._create_session(client, headers_a)
        r = client.get("/api/sessions/", headers=headers_b)
        assert len(r.json()) == 0

    def test_session_includes_sets_list(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        r = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert "sets" in r.json()
        assert isinstance(r.json()["sets"], list)

    def test_draft_session_persistence_across_logins(self, client):
        """Workout drafts (incomplete sessions) must be saved and retrieved on a new login."""
        # User logs in and creates a draft session (no completed_at)
        headers_1 = register_and_login(client, "draft@example.com", "pass")
        draft = self._create_session(client, headers_1)
        
        r_login = client.post("/api/auth/login", json={"email": "draft@example.com", "password": "pass"})
        headers_2 = {"Authorization": f"Bearer {r_login.json()['access_token']}"}
        r = client.get("/api/sessions", headers=headers_2)
        assert r.status_code == 200
        
        sessions = r.json()
        assert len(sessions) == 1
        assert sessions[0]["id"] == draft["id"]
        assert sessions[0]["completed_at"] is None  # It's a draft



class TestSets:
    def _create_session(self, client, headers):
        r = client.post("/api/sessions/", json={"started_at": _now_iso()}, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    def _create_set(self, client, headers, session_id: int, exercise_id: int = 1, **kwargs):
        payload = {
            "session_id": session_id,
            "exercise_id": exercise_id,
            "set_number": 1,
            "weight_kg": 60.0,
            "reps": 10,
            "completed_at": _now_iso(),
            **kwargs,
        }
        r = client.post("/api/sets/", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_set(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        s = self._create_set(client, headers, session["id"])
        assert s["session_id"] == session["id"]
        assert s["weight_kg"] == 60.0
        assert s["reps"] == 10

    def test_create_set_missing_session(self, client):
        """POSTing a set for a non-existent session_id must return 404."""
        headers = register_and_login(client)
        r = client.post("/api/sets/", json={
            "session_id": 9999,
            "exercise_id": 1,
            "set_number": 1,
            "completed_at": _now_iso(),
        }, headers=headers)
        assert r.status_code == 404

    def test_create_set_for_other_users_session(self, client):
        """User B cannot add sets to User A's session."""
        headers_a = register_and_login(client, "ua@example.com")
        headers_b = register_and_login(client, "ub@example.com")
        session_a = self._create_session(client, headers_a)
        r = client.post("/api/sets/", json={
            "session_id": session_a["id"],
            "exercise_id": 1,
            "set_number": 1,
            "completed_at": _now_iso(),
        }, headers=headers_b)
        assert r.status_code == 404  # session not found for this user

    def test_update_set(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        s = self._create_set(client, headers, session["id"])
        r = client.put(f"/api/sets/{s['id']}", json={"weight_kg": 80.0, "reps": 8, "set_number": 1}, headers=headers)
        assert r.status_code == 200
        assert r.json()["weight_kg"] == 80.0
        assert r.json()["reps"] == 8

    def test_delete_set(self, client):
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        s = self._create_set(client, headers, session["id"])
        r = client.delete(f"/api/sets/{s['id']}", headers=headers)
        assert r.status_code == 200

    def test_set_returned_in_session_response(self, client):
        """Sets created for a session must appear in the GET /sessions/{id} response."""
        headers = register_and_login(client)
        session = self._create_session(client, headers)
        self._create_set(client, headers, session["id"], set_number=1)
        self._create_set(client, headers, session["id"], set_number=2)
        r = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["sets"]) == 2
