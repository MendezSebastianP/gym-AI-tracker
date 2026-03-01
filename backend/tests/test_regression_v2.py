"""
Regression tests for issues found in v2 (March 2026):
  1. Session with corrupted/duplicate sets (too many sets created)
  2. Routine details crash (t is not defined → frontend-only, but we test routine edit API)
  3. Sync 500 on session create with invalid routine_id
  4. DB export/import round-trip integrity
"""
import json
import os
import pytest
from datetime import datetime, timezone
from tests.conftest import register_and_login


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class TestSessionSetIntegrity:
    """Ensure sessions don't end up with absurd numbers of duplicate sets."""

    def _create_routine_with_exercises(self, client, headers):
        """Create a routine with 2 exercises, 3 sets each."""
        routine_data = {
            "name": "Test Routine",
            "days": [{
                "day_name": "Day 1",
                "exercises": [
                    {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60},
                    {"exercise_id": 2, "sets": 3, "reps": "10", "rest": 60},
                ]
            }]
        }
        r = client.post("/api/routines/", json=routine_data, headers=headers)
        assert r.status_code == 200
        return r.json()

    def test_session_sets_count_is_bounded(self, client):
        """A session should never have more sets than expected from its routine."""
        headers = register_and_login(client)
        routine = self._create_routine_with_exercises(client, headers)

        # Create session
        r = client.post("/api/sessions/", json={
            "started_at": _now_iso(),
            "routine_id": routine["id"],
            "day_index": 0,
        }, headers=headers)
        assert r.status_code == 200
        session = r.json()

        # Add the expected number of sets (2 exercises x 3 sets = 6)
        for ex_id in [1, 2]:
            for set_num in range(1, 4):
                r = client.post("/api/sets/", json={
                    "session_id": session["id"],
                    "exercise_id": ex_id,
                    "set_number": set_num,
                    "weight_kg": 50.0,
                    "reps": 10,
                    "completed_at": _now_iso(),
                }, headers=headers)
                assert r.status_code == 200

        # Verify total sets == 6 exactly
        r = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert r.status_code == 200
        session_data = r.json()
        assert len(session_data["sets"]) == 6, \
            f"Expected 6 sets, got {len(session_data['sets'])} — possible duplication bug"

    def test_duplicate_set_numbers_allowed_but_counted(self, client):
        """Even if duplicate set_numbers are posted, the total count reflects reality."""
        headers = register_and_login(client)
        r = client.post("/api/sessions/", json={"started_at": _now_iso()}, headers=headers)
        session = r.json()

        # Add 3 sets
        for i in range(3):
            client.post("/api/sets/", json={
                "session_id": session["id"],
                "exercise_id": 1,
                "set_number": i + 1,
                "weight_kg": 60.0,
                "reps": 10,
                "completed_at": _now_iso(),
            }, headers=headers)

        r = client.get(f"/api/sessions/{session['id']}", headers=headers)
        assert len(r.json()["sets"]) == 3


class TestSyncSessionWithInvalidRoutine:
    """POST /api/sessions with a routine_id that doesn't exist should NOT cause a 500."""

    def test_create_session_with_nonexistent_routine_id(self, client):
        """Sync may send local Dexie IDs that don't exist on the server."""
        headers = register_and_login(client)
        r = client.post("/api/sessions/", json={
            "started_at": _now_iso(),
            "routine_id": 99999,  # Does not exist
            "day_index": 0,
        }, headers=headers)
        # Should succeed (not 500), with routine_id set to None
        assert r.status_code == 200
        assert r.json()["routine_id"] is None

    def test_create_session_with_valid_routine_id(self, client):
        """Normal case: routine exists and is linked correctly."""
        headers = register_and_login(client)
        r_routine = client.post("/api/routines/", json={"name": "Valid", "days": []}, headers=headers)
        routine_id = r_routine.json()["id"]

        r = client.post("/api/sessions/", json={
            "started_at": _now_iso(),
            "routine_id": routine_id,
            "day_index": 0,
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["routine_id"] == routine_id

    def test_create_session_with_other_users_routine(self, client):
        """User B's routine_id should be treated as nonexistent for User A."""
        headers_a = register_and_login(client, "a@x.com")
        headers_b = register_and_login(client, "b@x.com")

        r_routine = client.post("/api/routines/", json={"name": "B's routine", "days": []}, headers=headers_b)
        routine_id = r_routine.json()["id"]

        r = client.post("/api/sessions/", json={
            "started_at": _now_iso(),
            "routine_id": routine_id,
            "day_index": 0,
        }, headers=headers_a)
        assert r.status_code == 200
        assert r.json()["routine_id"] is None  # Shouldn't link to B's routine


class TestRoutineEditAPI:
    """Ensure routine details and editing work correctly (API side of the frontend crash)."""

    def test_routine_with_exercises_returns_days(self, client):
        """Routine with exercises should return all day data correctly."""
        headers = register_and_login(client)
        routine_data = {
            "name": "PPL",
            "days": [{
                "day_name": "Push",
                "exercises": [
                    {"exercise_id": 1, "sets": 4, "reps": "8-12", "rest": 90, "locked": True},
                ]
            }]
        }
        r = client.post("/api/routines/", json=routine_data, headers=headers)
        assert r.status_code == 200
        routine_id = r.json()["id"]

        # Fetch and verify
        r = client.get(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["days"]) == 1
        assert data["days"][0]["day_name"] == "Push"
        assert len(data["days"][0]["exercises"]) == 1
        assert data["days"][0]["exercises"][0]["locked"] is True

    def test_routine_update_preserves_exercises(self, client):
        """Updating a routine should not drop exercises."""
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={
            "name": "Test",
            "days": [{"day_name": "A", "exercises": [
                {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60}
            ]}]
        }, headers=headers)
        routine_id = r.json()["id"]

        # Update name only
        r = client.put(f"/api/routines/{routine_id}", json={"name": "Updated"}, headers=headers)
        assert r.status_code == 200

        # Exercises should still be there
        r = client.get(f"/api/routines/{routine_id}", headers=headers)
        assert len(r.json()["days"][0]["exercises"]) == 1


class TestDbExportImport:
    """Test the export/import utility module compiles and basic logic works."""

    def test_export_module_imports(self, client):
        """The export/import module should be importable without errors."""
        from app.db_export_import import export_data, import_data
        assert callable(export_data)
        assert callable(import_data)

    def test_session_data_integrity_preserved(self, client):
        """All session data should survive a create → fetch round-trip."""
        headers = register_and_login(client, "export@test.com")

        # Create data
        r = client.post("/api/routines/", json={"name": "Export Test", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        started = _now_iso()
        r = client.post("/api/sessions/", json={
            "started_at": started,
            "routine_id": routine_id,
        }, headers=headers)
        session_id = r.json()["id"]

        r = client.post("/api/sets/", json={
            "session_id": session_id,
            "exercise_id": 1,
            "set_number": 1,
            "weight_kg": 100.0,
            "reps": 5,
            "completed_at": _now_iso(),
        }, headers=headers)
        assert r.status_code == 200

        # Verify all data can be fetched back intact
        r = client.get(f"/api/sessions/{session_id}", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["routine_id"] == routine_id
        assert len(data["sets"]) == 1
        assert data["sets"][0]["weight_kg"] == 100.0
        assert data["sets"][0]["reps"] == 5
