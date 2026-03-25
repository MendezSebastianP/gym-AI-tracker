"""
Tests for AI routine generation endpoint.

Uses mocked OpenAI responses to avoid actual API calls.
"""
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tests.conftest import register_and_login


MOCK_AI_RESPONSE = {
    "name": "PPL Routine",
    "description": "Push Pull Legs split for hypertrophy",
    "days": [
        {
            "day_name": "Push",
            "exercises": [
                {"exercise_id": 1, "sets": 4, "reps": "8-12", "rest": 90, "notes": "Control the eccentric"},
                {"exercise_id": 3, "sets": 3, "reps": "10-12", "rest": 60, "notes": None},
            ]
        },
        {
            "day_name": "Pull",
            "exercises": [
                {"exercise_id": 16, "sets": 4, "reps": "6-10", "rest": 120, "notes": "Full range of motion"},
            ]
        },
        {
            "day_name": "Legs",
            "exercises": [
                {"exercise_id": 31, "sets": 4, "reps": "6-8", "rest": 120, "notes": None},
            ]
        }
    ]
}


def _seed_exercises(client, headers):
    """Seed a few exercises so the AI can reference valid IDs."""
    from app.database import get_db
    from app.models.exercise import Exercise
    from app.main import app

    # Get the overridden DB session
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)

    exercises = [
        Exercise(id=1, name="Bench Press", muscle="Chest", equipment="Barbell", source="system"),
        Exercise(id=3, name="Incline Bench Press", muscle="Chest", equipment="Barbell", source="system"),
        Exercise(id=16, name="Pull Up", muscle="Back", equipment="None (Bodyweight)", source="system", is_bodyweight=True),
        Exercise(id=31, name="Squat", muscle="Legs", equipment="Barbell", source="system"),
    ]
    for ex in exercises:
        db.add(ex)
    db.commit()
    db.close()


def _mock_openai_response(content: dict):
    """Create a mock OpenAI ChatCompletion response."""
    mock_message = MagicMock()
    mock_message.content = json.dumps(content)

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 100
    mock_usage.completion_tokens = 50
    mock_usage.total_tokens = 150

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage

    return mock_response


class TestAIRoutineGeneration:
    def test_no_auth_returns_401(self, client):
        r = client.post("/api/ai/generate-routine")
        assert r.status_code == 401

    def test_missing_api_key_returns_503(self, client):
        """When OPENAI_API_KEY is not set, should return 503."""
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            r = client.post("/api/ai/generate-routine", json={}, headers=headers)
            assert r.status_code == 503
            assert "not configured" in r.json()["detail"].lower()

    def test_generate_routine_success(self, client):
        """With a mocked OpenAI response, endpoint should return a valid routine."""
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        mock_response = _mock_openai_response(MOCK_AI_RESPONSE)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post(
                    "/api/ai/generate-routine",
                    json={"extra_prompt": "Focus on chest growth"},
                    headers=headers,
                )

        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "PPL Routine"
        assert len(data["days"]) == 3
        assert data["days"][0]["day_name"] == "Push"
        assert len(data["days"][0]["exercises"]) == 2
        assert data["days"][0]["exercises"][0]["exercise_id"] == 1

    def test_generate_routine_filters_invalid_exercise_ids(self, client):
        """Exercise IDs not in our DB should be silently removed."""
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        bad_response = {
            "name": "Test",
            "description": "Test",
            "days": [
                {
                    "day_name": "Day 1",
                    "exercises": [
                        {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60},
                        {"exercise_id": 99999, "sets": 3, "reps": "10", "rest": 60},  # Invalid ID
                    ]
                }
            ]
        }

        mock_response = _mock_openai_response(bad_response)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post("/api/ai/generate-routine", json={}, headers=headers)

        assert r.status_code == 200
        data = r.json()
        # Invalid exercise should have been removed
        assert len(data["days"][0]["exercises"]) == 1
        assert data["days"][0]["exercises"][0]["exercise_id"] == 1

    def test_generate_routine_with_extra_prompt(self, client):
        """Extra prompt should be passed through to the API call."""
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        mock_response = _mock_openai_response(MOCK_AI_RESPONSE)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post(
                    "/api/ai/generate-routine",
                    json={"extra_prompt": "Add supersets for efficiency"},
                    headers=headers,
                )

        assert r.status_code == 200
        # Verify the OpenAI call was made with the extra prompt in the user message
        call_args = mock_create.call_args
        messages = call_args.kwargs["messages"]
        user_msg = messages[1]["content"]
        assert "Add supersets for efficiency" in user_msg

    def test_generate_routine_no_body(self, client):
        """Endpoint should work with no request body (extra_prompt is optional)."""
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        mock_response = _mock_openai_response(MOCK_AI_RESPONSE)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post("/api/ai/generate-routine", headers=headers)

        assert r.status_code == 200


MOCK_FILL_DAY_RESPONSE = {
    "exercises": [
        {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60, "notes": None},
        {"exercise_id": 3, "sets": 3, "reps": "12", "rest": 60, "notes": "Incline angle"},
    ]
}


class TestAIFillDay:
    """Tests for POST /api/ai/fill-day endpoint."""

    def test_no_auth_returns_401(self, client):
        r = client.post("/api/ai/fill-day", json={"prompt": "add chest exercises"})
        assert r.status_code == 401

    def test_missing_api_key_returns_503(self, client):
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            r = client.post(
                "/api/ai/fill-day",
                json={"prompt": "add chest exercises"},
                headers=headers,
            )
            assert r.status_code == 503

    def test_fill_day_success(self, client):
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        mock_response = _mock_openai_response(MOCK_FILL_DAY_RESPONSE)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post(
                    "/api/ai/fill-day",
                    json={
                        "prompt": "add 2 chest exercises with barbell",
                        "existing_exercise_ids": [],
                        "day_name": "Push Day",
                    },
                    headers=headers,
                )

        assert r.status_code == 200
        data = r.json()
        assert len(data["exercises"]) == 2
        assert data["exercises"][0]["exercise_id"] == 1

    def test_fill_day_filters_invalid_ids(self, client):
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        bad_response = {
            "exercises": [
                {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60},
                {"exercise_id": 99999, "sets": 3, "reps": "10", "rest": 60},
            ]
        }

        mock_response = _mock_openai_response(bad_response)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post(
                    "/api/ai/fill-day",
                    json={"prompt": "add exercises"},
                    headers=headers,
                )

        assert r.status_code == 200
        data = r.json()
        assert len(data["exercises"]) == 1
        assert data["exercises"][0]["exercise_id"] == 1

    def test_fill_day_excludes_existing(self, client):
        headers = register_and_login(client)
        _seed_exercises(client, headers)

        response_with_existing = {
            "exercises": [
                {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60},
                {"exercise_id": 3, "sets": 3, "reps": "12", "rest": 60},
            ]
        }

        mock_response = _mock_openai_response(response_with_existing)
        mock_create = AsyncMock(return_value=mock_response)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
            with patch("app.openai_service.AsyncOpenAI") as MockClient:
                instance = MockClient.return_value
                instance.chat.completions.create = mock_create

                r = client.post(
                    "/api/ai/fill-day",
                    json={
                        "prompt": "add exercises",
                        "existing_exercise_ids": [1],
                    },
                    headers=headers,
                )

        assert r.status_code == 200
        data = r.json()
        # Exercise 1 should be excluded since it's in existing_exercise_ids
        ids = [ex["exercise_id"] for ex in data["exercises"]]
        assert 1 not in ids
        assert 3 in ids
