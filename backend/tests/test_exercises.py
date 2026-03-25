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


class TestExerciseSuggest:
    """Tests for GET /api/exercises/suggest endpoint."""

    def _seed_exercises(self, client, headers):
        """Seed system exercises by inserting them directly into the DB."""
        from app.database import get_db
        from app.models.exercise import Exercise

        db = next(client.app.dependency_overrides[get_db]())
        exercises = [
            Exercise(id=1, name="Bench Press", muscle="Chest", muscle_group="Chest", equipment="Barbell", type="Strength", difficulty_level=3),
            Exercise(id=2, name="Overhead Press", muscle="Shoulders", muscle_group="Shoulders", equipment="Barbell", type="Strength", difficulty_level=3),
            Exercise(id=3, name="Tricep Pushdown", muscle="Triceps", muscle_group="Arms", equipment="Cable", type="Strength", difficulty_level=2),
            Exercise(id=4, name="Lat Pulldown", muscle="Lats", muscle_group="Back", equipment="Cable", type="Strength", difficulty_level=2),
            Exercise(id=5, name="Barbell Curl", muscle="Biceps", muscle_group="Arms", equipment="Barbell", type="Strength", difficulty_level=2),
            Exercise(id=6, name="Lateral Raise", muscle="Shoulders", muscle_group="Shoulders", equipment="Dumbbell", type="Strength", difficulty_level=2),
            Exercise(id=7, name="Squat", muscle="Quadriceps", muscle_group="Legs", equipment="Barbell", type="Strength", difficulty_level=3),
            Exercise(id=8, name="Romanian Deadlift", muscle="Hamstrings", muscle_group="Legs", equipment="Barbell", type="Strength", difficulty_level=3),
        ]
        for ex in exercises:
            db.add(ex)
        db.commit()

    def test_suggest_no_auth(self, client):
        r = client.get("/api/exercises/suggest")
        assert r.status_code == 401

    def test_suggest_with_chest_exercises(self, client):
        headers = register_and_login(client)
        self._seed_exercises(client, headers)

        r = client.get("/api/exercises/suggest?existing_ids=1", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        # Should suggest complementary muscles like Triceps or Shoulders
        muscles = {ex["muscle"] for ex in data}
        assert muscles & {"Triceps", "Shoulders"}, f"Expected triceps/shoulders, got {muscles}"

    def test_suggest_excludes_existing(self, client):
        headers = register_and_login(client)
        self._seed_exercises(client, headers)

        r = client.get("/api/exercises/suggest?existing_ids=1,2,3", headers=headers)
        assert r.status_code == 200
        ids = {ex["id"] for ex in r.json()}
        assert 1 not in ids
        assert 2 not in ids
        assert 3 not in ids

    def test_suggest_empty_existing(self, client):
        headers = register_and_login(client)
        self._seed_exercises(client, headers)

        r = client.get("/api/exercises/suggest?existing_ids=", headers=headers)
        assert r.status_code == 200
        data = r.json()
        # Should return some suggestions from default muscle groups
        assert isinstance(data, list)

    def test_suggest_respects_limit(self, client):
        headers = register_and_login(client)
        self._seed_exercises(client, headers)

        r = client.get("/api/exercises/suggest?existing_ids=1&limit=2", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) <= 2
