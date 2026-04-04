import pytest
from unittest.mock import patch, AsyncMock
import json
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from tests.conftest import register_and_login
from tests.test_ai_routine import _seed_exercises, _mock_openai_response, MOCK_AI_RESPONSE

def test_ai_usage_tracking_flow(client, db_engine):
    headers = register_and_login(client, initial_coins=1000)
    _seed_exercises(client, headers)

    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    with Session() as db:
        db_user = db.query(User).filter(User.email == "test@example.com").first()
        assert db_user is not None
        db_user.is_admin = True
        db.commit()
    
    # 1. Generate an AI Routine
    mock_response = _mock_openai_response(MOCK_AI_RESPONSE)
    # Give it some token usage
    mock_response.usage.prompt_tokens = 1000
    mock_response.usage.completion_tokens = 500
    mock_response.usage.total_tokens = 1500
    
    mock_create = AsyncMock(return_value=mock_response)
    
    with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key-123"}):
        with patch("app.openai_service.AsyncOpenAI") as MockClient:
            instance = MockClient.return_value
            instance.chat.completions.create = mock_create
            
            gen_resp = client.post(
                "/api/ai/generate-routine",
                json={"extra_prompt": "Help"},
                headers=headers
            )
            
    assert gen_resp.status_code == 200
    data = gen_resp.json()
    assert "ai_usage_id" in data
    ai_usage_id = data["ai_usage_id"]
    
    # 2. Save the routine, keeping only 2 of the 4 exercises
    # MOCK_AI_RESPONSE has exercises 1, 3, 16, 31 (Total: 4)
    # We will save a routine with exercises 1, 3 and a new one (e.g. 99)
    save_payload = {
        "name": "My Saved Routine",
        "description": "Customized",
        "ai_usage_id": ai_usage_id,
        "days": [
            {
                "day_name": "Day 1",
                "exercises": [
                    {"exercise_id": 1, "sets": 3, "reps": "10", "rest": 60},
                    {"exercise_id": 3, "sets": 3, "reps": "10", "rest": 60},
                    {"exercise_id": 99, "sets": 3, "reps": "10", "rest": 60} # completely different
                ]
            }
        ]
    }
    
    save_resp = client.post("/api/routines", json=save_payload, headers=headers)
    assert save_resp.status_code == 200
    
    # 3. Request the Admin Report
    admin_resp = client.get("/api/admin/ai/report", headers=headers)
    assert admin_resp.status_code == 200
    report = admin_resp.json()
    
    # Cost should be correctly calculated (gpt-4o pricing):
    # prompt (1000 * 2.50 / 1M) + completion (500 * 10.00 / 1M) = $0.0025 + $0.005 = $0.0075
    assert report["financials"]["total_cost_usd"] == 0.0075
    assert report["financials"]["total_tokens"] == 1500
    
    # Conversion should show 1 generation, 1 save = 100%
    assert report["conversion"]["total_generations"] == 1
    assert report["conversion"]["total_saved"] == 1
    assert report["conversion"]["conversion_rate_percentage"] == 100.0
    
    # Retention: Original had 4 exercises. We kept 2 (IDs 1, 3). So 2/4 = 50%
    assert report["conversion"]["average_retention_percentage"] == 50.0
    
    # The user should be in top users
    assert len(report["top_users"]) == 1
    assert report["top_users"][0]["generations"] == 1
