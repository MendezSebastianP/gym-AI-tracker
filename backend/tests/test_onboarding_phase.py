from datetime import datetime, timezone

from tests.conftest import register_and_login


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_exercise(client, headers) -> int:
    r = client.post(
        "/api/exercises",
        json={
            "name": "Onboarding Squat",
            "muscle": "Legs",
            "equipment": "Barbell",
            "type": "Strength",
        },
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestOnboardingProgress:
    def test_rewards_can_be_claimed_step_by_step(self, client):
        headers = register_and_login(client, "onboard-step-claim@example.com")

        r = client.put("/api/auth/me", json={"height": 180}, headers=headers)
        assert r.status_code == 200
        assert r.json()["currency"] == 10

        r = client.put("/api/preferences", json={"context_level": 2}, headers=headers)
        assert r.status_code == 200

        claim_profile = client.post(
            "/api/gamification/onboarding/claim",
            json={"step": "profile"},
            headers=headers,
        )
        assert claim_profile.status_code == 200
        assert claim_profile.json()["coins_awarded"] == 10
        assert claim_profile.json()["claimed_steps"] == ["profile"]
        assert claim_profile.json()["currency"] == 20

        claim_q1 = client.post(
            "/api/gamification/onboarding/claim",
            json={"step": "questionnaire_l1"},
            headers=headers,
        )
        assert claim_q1.status_code == 200
        assert claim_q1.json()["coins_awarded"] == 20
        assert claim_q1.json()["claimed_steps"] == ["questionnaire_l1"]
        assert claim_q1.json()["currency"] == 40

        duplicate = client.post(
            "/api/gamification/onboarding/claim",
            json={"step": "profile"},
            headers=headers,
        )
        assert duplicate.status_code == 200
        assert duplicate.json()["coins_awarded"] == 0
        assert duplicate.json()["claimed_steps"] == []
        assert duplicate.json()["currency"] == 40

    def test_auto_advance_profile_questionnaire_routine_session(self, client):
        headers = register_and_login(client, "onboard-auto@example.com")

        # 1) Profile setup (claimable later, no instant coins)
        r = client.put("/api/auth/me", json={"height": 180}, headers=headers)
        assert r.status_code == 200
        assert r.json()["currency"] == 10
        assert r.json()["onboarding_progress"]["profile"] is True

        # 2) Context level 2 marks L1+L2 (claimable later, no instant coins)
        r = client.put("/api/preferences", json={"context_level": 2}, headers=headers)
        assert r.status_code == 200
        me = client.get("/api/auth/me", headers=headers).json()
        assert me["currency"] == 10
        assert me["onboarding_progress"]["questionnaire_l1"] is True
        assert me["onboarding_progress"]["questionnaire_l2"] is True
        assert me["onboarding_progress"]["questionnaire_l3"] is False

        # 3) First routine (no coins)
        r = client.post("/api/routines", json={"name": "My First", "days": []}, headers=headers)
        assert r.status_code == 200
        me = client.get("/api/auth/me", headers=headers).json()
        assert me["onboarding_progress"]["first_routine"] is True
        assert me["currency"] == 10

        # 4) First completed session (no coins) auto-completes tutorial state only
        ex_id = _create_exercise(client, headers)
        s = client.post("/api/sessions", json={"started_at": _now_iso()}, headers=headers)
        assert s.status_code == 200
        session_id = s.json()["id"]

        r = client.post(
            f"/api/sessions/{session_id}/complete_bulk",
            json={
                "completed_at": _now_iso(),
                "sets": [
                    {
                        "exercise_id": ex_id,
                        "set_number": 1,
                        "weight_kg": 80,
                        "reps": 8,
                        "set_type": "normal",
                        "to_failure": False,
                        "completed_at": _now_iso(),
                    }
                ],
            },
            headers=headers,
        )
        assert r.status_code == 200

        me = client.get("/api/auth/me", headers=headers).json()
        progress = me["onboarding_progress"]
        assert progress["first_session"] is True
        assert progress["tutorial_complete"] is True
        assert "tutorial_complete" not in progress.get("coins_awarded", [])
        assert me["currency"] == 10

        # 5) Claim from Home awards the accumulated onboarding coins exactly once
        claim = client.post("/api/gamification/onboarding/claim", headers=headers)
        assert claim.status_code == 200
        assert claim.json()["coins_awarded"] == 100
        assert claim.json()["currency"] == 110
        assert set(claim.json()["claimed_steps"]) == {"profile", "questionnaire_l1", "questionnaire_l2", "tutorial_complete"}

        me = client.get("/api/auth/me", headers=headers).json()
        assert me["currency"] == 110
        assert "tutorial_complete" in me["onboarding_progress"].get("coins_awarded", [])

        duplicate_claim = client.post("/api/gamification/onboarding/claim", headers=headers)
        assert duplicate_claim.status_code == 200
        assert duplicate_claim.json()["coins_awarded"] == 0
        assert duplicate_claim.json()["currency"] == 110

    def test_manual_tutorial_complete_is_ignored(self, client):
        headers = register_and_login(client, "onboard-dismiss@example.com")

        r1 = client.put(
            "/api/auth/me",
            json={"onboarding_progress": {"tutorial_complete": True}},
            headers=headers,
        )
        assert r1.status_code == 200
        assert r1.json()["currency"] == 10
        progress1 = r1.json().get("onboarding_progress") or {}
        assert progress1.get("tutorial_complete") is not True

        r2 = client.put(
            "/api/auth/me",
            json={"onboarding_progress": {"tutorial_complete": True}},
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["currency"] == 10
        progress2 = r2.json().get("onboarding_progress") or {}
        coins_awarded = progress2.get("coins_awarded", [])
        assert "tutorial_complete" not in coins_awarded

    def test_first_routine_backfilled_when_user_already_has_routines(self, client):
        headers = register_and_login(client, "onboard-backfill@example.com")

        r = client.post("/api/routines", json={"name": "Backfill Routine", "days": []}, headers=headers)
        assert r.status_code == 200

        # Simulate a stale account state where this flag was never set.
        r = client.put(
            "/api/auth/me",
            json={"onboarding_progress": {"first_routine": False}},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["onboarding_progress"]["first_routine"] is False

        # /auth/me should auto-repair onboarding state if at least one routine exists.
        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["onboarding_progress"]["first_routine"] is True
