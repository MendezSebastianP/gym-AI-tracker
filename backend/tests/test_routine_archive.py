"""
Tests for routine archiving feature (soft delete + restore + permanent delete).
"""
from datetime import datetime, timezone
from tests.conftest import register_and_login


class TestRoutineArchive:
    """Test archive/restore/delete workflow for routines."""

    def test_archive_routine(self, client):
        """Archiving a routine should set archived_at and make it hidden from default GET."""
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "Test Routine", "days": []}, headers=headers)
        assert r.status_code == 200
        routine_id = r.json()["id"]

        # Archive it
        r = client.post(f"/api/routines/{routine_id}/archive", headers=headers)
        assert r.status_code == 200
        assert r.json()["archived_at"] is not None
        assert r.json()["is_favorite"] is False

        # Default GET should NOT include it
        r = client.get("/api/routines/", headers=headers)
        assert r.status_code == 200
        ids = [rout["id"] for rout in r.json()]
        assert routine_id not in ids

        # GET with include_archived should include it
        r = client.get("/api/routines/?include_archived=true", headers=headers)
        assert r.status_code == 200
        ids = [rout["id"] for rout in r.json()]
        assert routine_id in ids

    def test_restore_routine(self, client):
        """Restoring an archived routine should clear archived_at."""
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "Restorable", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        # Archive then restore
        client.post(f"/api/routines/{routine_id}/archive", headers=headers)
        r = client.post(f"/api/routines/{routine_id}/restore", headers=headers)
        assert r.status_code == 200
        assert r.json()["archived_at"] is None

        # Should appear in default GET again
        r = client.get("/api/routines/", headers=headers)
        ids = [rout["id"] for rout in r.json()]
        assert routine_id in ids

    def test_permanent_delete(self, client):
        """Deleting a routine should remove it completely."""
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "Deletable", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        # Archive, then permanently delete
        client.post(f"/api/routines/{routine_id}/archive", headers=headers)
        r = client.delete(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200

        # Should not appear anywhere
        r = client.get("/api/routines/?include_archived=true", headers=headers)
        ids = [rout["id"] for rout in r.json()]
        assert routine_id not in ids

    def test_archive_unfavorites(self, client):
        """Archiving a favorite routine should remove the favorite status."""
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "Fav", "days": [], "is_favorite": True}, headers=headers)
        routine_id = r.json()["id"]

        r = client.post(f"/api/routines/{routine_id}/archive", headers=headers)
        assert r.json()["is_favorite"] is False

    def test_archive_other_users_routine_fails(self, client):
        """Cannot archive another user's routine."""
        headers_a = register_and_login(client, "archiver@x.com")
        headers_b = register_and_login(client, "victim@x.com")

        r = client.post("/api/routines/", json={"name": "B's routine", "days": []}, headers=headers_b)
        routine_id = r.json()["id"]

        r = client.post(f"/api/routines/{routine_id}/archive", headers=headers_a)
        assert r.status_code == 404


class TestRoutineDescriptionEdit:
    """Test that routine descriptions can be updated."""

    def test_update_description(self, client):
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "With Desc", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        r = client.put(f"/api/routines/{routine_id}", json={"description": "My PPL split"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["description"] == "My PPL split"

        # Verify on GET
        r = client.get(f"/api/routines/{routine_id}", headers=headers)
        assert r.json()["description"] == "My PPL split"

    def test_clear_description(self, client):
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={"name": "Clear Desc", "days": [], "description": "Old"}, headers=headers)
        routine_id = r.json()["id"]

        r = client.put(f"/api/routines/{routine_id}", json={"description": None}, headers=headers)
        assert r.status_code == 200
        assert r.json()["description"] is None


class TestRoutineDeleteUnlinksSessions:
    """Test that deleting a routine unlinks (but does not delete) its sessions."""

    def test_delete_unlinks_sessions(self, client):
        """Sessions referencing the deleted routine should have routine_id set to None."""
        headers = register_and_login(client)

        # Create routine + session
        r = client.post("/api/routines/", json={"name": "Deletable R", "days": [{"day_name": "A", "exercises": []}]}, headers=headers)
        routine_id = r.json()["id"]

        r = client.post("/api/sessions/", json={"routine_id": routine_id, "day_index": 0}, headers=headers)
        assert r.status_code == 200
        session_id = r.json()["id"]

        # Permanently delete routine
        r = client.delete(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200

        # Session should still exist but with routine_id = None
        r = client.get(f"/api/sessions/{session_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["routine_id"] is None

    def test_delete_without_archive_first(self, client):
        """Should be able to permanently delete a routine that was never archived."""
        headers = register_and_login(client)

        r = client.post("/api/routines/", json={"name": "Direct Del", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        r = client.delete(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200

        r = client.get("/api/routines/?include_archived=true", headers=headers)
        ids = [rout["id"] for rout in r.json()]
        assert routine_id not in ids

    def test_multiple_archive_restore_cycles(self, client):
        """Archiving and restoring multiple times should work cleanly."""
        headers = register_and_login(client)

        r = client.post("/api/routines/", json={"name": "Flippy", "days": []}, headers=headers)
        routine_id = r.json()["id"]

        for _ in range(3):
            r = client.post(f"/api/routines/{routine_id}/archive", headers=headers)
            assert r.status_code == 200
            assert r.json()["archived_at"] is not None

            r = client.post(f"/api/routines/{routine_id}/restore", headers=headers)
            assert r.status_code == 200
            assert r.json()["archived_at"] is None

        # Should remain visible after all cycles
        r = client.get("/api/routines/", headers=headers)
        ids = [rout["id"] for rout in r.json()]
        assert routine_id in ids

