"""
Tests for exercises endpoint:
  GET   /api/exercises/
  POST  /api/exercises/   (user-created custom exercises)
"""
import pytest
from tests.conftest import register_and_login


class TestExercises:
    def test_list_exercises_authenticated(self, client):
        headers = register_and_login(client)
        r = client.get("/api/exercises/", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_exercises_unauthenticated(self, client):
        r = client.get("/api/exercises/")
        assert r.status_code == 401

    def test_create_custom_exercise(self, client):
        headers = register_and_login(client)
        r = client.post("/api/exercises/", json={
            "name": "Cable Fly",
            "muscle": "chest",
            "muscle_group": "chest",
            "equipment": "cable",
            "type": "isolation",
            "is_bodyweight": False,
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Cable Fly"
        assert data["source"] == "custom"

    def test_custom_exercise_appears_in_list(self, client):
        headers = register_and_login(client)
        client.post("/api/exercises/", json={"name": "MyExercise", "is_bodyweight": False}, headers=headers)
        r = client.get("/api/exercises/", headers=headers)
        names = [x["name"] for x in r.json()]
        assert "MyExercise" in names

    def test_custom_exercises_are_user_isolated(self, client):
        """User A's custom exercises are invisible to User B."""
        headers_a = register_and_login(client, "ua@example.com")
        headers_b = register_and_login(client, "ub@example.com")
        client.post("/api/exercises/", json={"name": "SecretExercise", "is_bodyweight": True}, headers=headers_a)

        r = client.get("/api/exercises/", headers=headers_b)
        names = [x["name"] for x in r.json()]
        assert "SecretExercise" not in names

    def test_list_exercises_search(self, client):
        headers = register_and_login(client)
        client.post("/api/exercises/", json={"name": "Bench Press", "muscle": "Chest", "is_bodyweight": False}, headers=headers)
        r = client.get("/api/exercises/?search=Bench", headers=headers)
        assert r.status_code == 200
        names = [x["name"] for x in r.json()]
        assert "Bench Press" in names

    def test_list_exercises_filter_muscle(self, client):
        headers = register_and_login(client)
        client.post("/api/exercises/", json={"name": "Squat", "muscle": "Legs", "is_bodyweight": False}, headers=headers)
        r = client.get("/api/exercises/?muscle=Legs", headers=headers)
        assert r.status_code == 200
        muscles = {x["muscle"] for x in r.json() if x["muscle"] is not None}
        assert muscles == {"Legs"}
