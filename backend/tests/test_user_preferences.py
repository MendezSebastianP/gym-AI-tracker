import pytest
from tests.conftest import register_and_login

class TestUserPreferences:
    def test_get_preferences_empty(self, client):
        headers = register_and_login(client, "pref1@example.com")
        r = client.get("/api/preferences", headers=headers)
        assert r.status_code == 200
        assert r.json() == {}

    def test_update_and_get_preferences(self, client):
        headers = register_and_login(client, "pref2@example.com")
        
        # Initial update
        payload = {
            "primary_goal": "Muscle Gain (Hypertrophy)",
            "split_preference": "Push/Pull/Legs",
            "experience_level": "Intermediate (6 months - 2 years)",
            "available_equipment": ["Dumbbells", "Barbells and Plates"],
            "training_days": 4,
            "session_duration": "60 mins",
            "sleep_quality": "Average",
            "active_job": "No",
            "progression_pace": "Moderate",
            "has_injuries": "No",
            "other_information": "I prefer morning workouts."
        }
        r = client.put("/api/preferences", json=payload, headers=headers)
        assert r.status_code == 200
        assert r.json()["message"] == "Preferences updated successfully"

        # Verify update
        r = client.get("/api/preferences", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["primary_goal"] == "Muscle Gain (Hypertrophy)"
        assert data["training_days"] == 4
        assert "Dumbbells" in data["available_equipment"]
        assert data["other_information"] == "I prefer morning workouts."
        
        # Second update (partial update)
        payload2 = {
            "sleep_quality": "I don't know",
            "active_job": "I don't know",
            "progression_pace": "I don't know"
        }
        r = client.put("/api/preferences", json=payload2, headers=headers)
        assert r.status_code == 200
        
        # Verify second update applies without wiping other keys
        r = client.get("/api/preferences", headers=headers)
        assert r.status_code == 200
        data2 = r.json()
        assert data2["primary_goal"] == "Muscle Gain (Hypertrophy)" # From first update
        assert data2["sleep_quality"] == "I don't know" # From second update
        assert data2["active_job"] == "I don't know"
        assert data2["progression_pace"] == "I don't know"

    def test_unauthenticated_access(self, client):
        # GET without token
        r_get = client.get("/api/preferences")
        assert r_get.status_code == 401
        
        # PUT without token
        r_put = client.put("/api/preferences", json={"primary_goal": "Weight Loss / Cutting"})
        assert r_put.status_code == 401
