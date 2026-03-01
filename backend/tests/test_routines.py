"""
Tests for routine endpoints:
  GET    /api/routines/
  POST   /api/routines/
  GET    /api/routines/{id}
  PUT    /api/routines/{id}
"""
import pytest
from tests.conftest import register_and_login


SAMPLE_DAYS = [
    {
        "day_name": "Push",
        "exercises": [
            {"exercise_id": 1, "sets": 3, "reps": "8-12", "rest": 90}
        ]
    }
]


class TestRoutineCRUD:
    def test_create_routine(self, client):
        headers = register_and_login(client)
        r = client.post("/api/routines/", json={
            "name": "PPL",
            "description": "Push Pull Legs",
            "is_favorite": False,
            "days": SAMPLE_DAYS,
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "PPL"
        assert data["description"] == "Push Pull Legs"
        assert len(data["days"]) == 1
        assert "id" in data

    def test_list_routines(self, client):
        headers = register_and_login(client)
        client.post("/api/routines/", json={"name": "A", "days": []}, headers=headers)
        client.post("/api/routines/", json={"name": "B", "days": []}, headers=headers)
        r = client.get("/api/routines/", headers=headers)
        assert r.status_code == 200
        names = [x["name"] for x in r.json()]
        assert "A" in names
        assert "B" in names

    def test_get_routine_by_id(self, client):
        headers = register_and_login(client)
        create_r = client.post("/api/routines/", json={"name": "MyRoutine", "days": []}, headers=headers)
        routine_id = create_r.json()["id"]
        r = client.get(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "MyRoutine"

    def test_get_routine_not_found(self, client):
        headers = register_and_login(client)
        r = client.get("/api/routines/9999", headers=headers)
        assert r.status_code == 404

    def test_update_routine(self, client):
        headers = register_and_login(client)
        create_r = client.post("/api/routines/", json={"name": "Old", "days": []}, headers=headers)
        routine_id = create_r.json()["id"]
        r = client.put(f"/api/routines/{routine_id}", json={"name": "New"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "New"

    def test_delete_routine(self, client):
        headers = register_and_login(client)
        create_r = client.post("/api/routines/", json={"name": "ToDelete", "days": []}, headers=headers)
        routine_id = create_r.json()["id"]
        r = client.delete(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["detail"] == "Routine deleted"

        r = client.get(f"/api/routines/{routine_id}", headers=headers)
        assert r.status_code == 404

    def test_delete_routine_not_found(self, client):
        headers = register_and_login(client)
        r = client.delete("/api/routines/9999", headers=headers)
        assert r.status_code == 404

    def test_update_favorite_routine(self, client):
        """Updating a routine to is_favorite = True should mark all other routines as is_favorite = False."""
        headers = register_and_login(client)
        r1 = client.post("/api/routines/", json={"name": "Routine1", "days": [], "is_favorite": True}, headers=headers)
        r2 = client.post("/api/routines/", json={"name": "Routine2", "days": [], "is_favorite": False}, headers=headers)
        
        id1 = r1.json()["id"]
        id2 = r2.json()["id"]
        
        # Now favorite r2
        r = client.put(f"/api/routines/{id2}", json={"is_favorite": True}, headers=headers)
        assert r.status_code == 200
        assert r.json()["is_favorite"] is True
        
        # Verify r1 is no longer favorite
        r = client.get(f"/api/routines/{id1}", headers=headers)
        assert r.status_code == 200
        assert r.json()["is_favorite"] is False

    def test_routines_are_user_isolated(self, client):
        """User A's routines are invisible to User B."""
        headers_a = register_and_login(client, "usera@example.com")
        headers_b = register_and_login(client, "userb@example.com")
        client.post("/api/routines/", json={"name": "PrivateRoutine", "days": []}, headers=headers_a)

        r = client.get("/api/routines/", headers=headers_b)
        names = [x["name"] for x in r.json()]
        assert "PrivateRoutine" not in names

    def test_no_auth_returns_401(self, client):
        r = client.get("/api/routines/")
        assert r.status_code == 401
