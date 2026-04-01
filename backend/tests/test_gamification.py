"""
Tests for gamification endpoints:
  GET  /api/gamification/stats
  GET  /api/gamification/quests
  POST /api/gamification/quests/{id}/claim
  GET  /api/gamification/shop
  POST /api/gamification/shop/buy
  POST /api/gamification/shop/activate
  POST /api/gamification/shop/promo
  POST /api/sessions/{id}/complete_bulk  (gamification integration)
"""
import pytest
from datetime import datetime, timedelta
from tests.conftest import register_and_login


class TestGamificationStats:
    def test_get_stats_unauthenticated(self, client):
        r = client.get("/api/gamification/stats")
        assert r.status_code == 401

    def test_get_stats_default(self, client):
        headers = register_and_login(client)
        r = client.get("/api/gamification/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["level"] == 1
        assert data["experience"] == 0
        assert data["currency"] == 10
        assert data["exp_to_next"] > 0

    def test_get_stats_demo(self, client):
        r = client.get("/api/gamification/stats/demo")
        assert r.status_code == 200
        data = r.json()
        assert "level" in data
        assert "experience" in data


class TestQuests:
    def test_get_quests_unauthenticated(self, client):
        r = client.get("/api/gamification/quests")
        assert r.status_code == 401

    def test_get_quests_assigned(self, client):
        headers = register_and_login(client)
        r = client.get("/api/gamification/quests", headers=headers)
        assert r.status_code == 200
        data = r.json()
        # Quests should be auto-assigned
        assert isinstance(data, list)

    def test_get_quests_demo(self, client):
        r = client.get("/api/gamification/quests/demo")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestShop:
    def test_get_shop_unauthenticated(self, client):
        r = client.get("/api/gamification/shop")
        assert r.status_code == 401

    def test_get_shop_items(self, client):
        headers = register_and_login(client)
        r = client.get("/api/gamification/shop", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "currency" in data
        assert "active_theme" in data
        # Default theme should be dark
        assert data["active_theme"] == "dark"
        # Should have at least 3 items (dark, light, gold)
        assert len(data["items"]) >= 3
        # Dark is always owned
        dark = next(i for i in data["items"] if i["id"] == "theme_dark")
        assert dark["owned"] is True

    def test_buy_item_not_enough_coins(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/buy", json={"item_id": "theme_light"}, headers=headers)
        assert r.status_code == 400
        assert "not enough" in r.json()["detail"].lower()

    def test_buy_item_not_found(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/buy", json={"item_id": "nonexistent"}, headers=headers)
        assert r.status_code == 404

    def test_activate_theme_not_owned(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/activate", json={"theme": "light"}, headers=headers)
        assert r.status_code == 400
        assert "not owned" in r.json()["detail"].lower()

    def test_activate_dark_always_works(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/activate", json={"theme": "dark"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["active_theme"] == "dark"

    def test_get_shop_demo(self, client):
        r = client.get("/api/gamification/shop/demo")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "active_theme" in data


class TestPromoCode:
    def test_redeem_invalid_code(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/promo", json={"code": "INVALID"}, headers=headers)
        assert r.status_code == 400

    def test_redeem_valid_code(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["coins_awarded"] == 2_000
        assert data["currency"] == 2_010  # 10 initial + 2000 promo

    def test_redeem_duplicate_code(self, client):
        headers = register_and_login(client)
        client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        r = client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        assert r.status_code == 400
        assert "already redeemed" in r.json()["detail"].lower()

    def test_redeem_duplicate_still_blocked_after_settings_update(self, client):
        headers = register_and_login(client, "promo-settings@example.com")

        first = client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        assert first.status_code == 200

        # Generic /auth/me settings update must not wipe server-managed redeemed_codes.
        r_update = client.put("/api/auth/me", json={"settings": {"language": "en"}}, headers=headers)
        assert r_update.status_code == 200

        second = client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        assert second.status_code == 400
        assert "already redeemed" in second.json()["detail"].lower()


class TestBuyAndActivateTheme:
    def test_full_theme_flow(self, client):
        """Buy a theme with promo coins, activate it, verify active."""
        headers = register_and_login(client)

        # Step 1: Get coins via promo
        r = client.post("/api/gamification/shop/promo", json={"code": "PACHO"}, headers=headers)
        assert r.status_code == 200

        # Step 2: Buy light theme (costs 50 coins)
        r = client.post("/api/gamification/shop/buy", json={"item_id": "theme_light"}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "theme_light" in data["purchased_themes"]

        # Step 3: Activate light theme
        r = client.post("/api/gamification/shop/activate", json={"theme": "light"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["active_theme"] == "light"

        # Step 4: Verify shop reflects the active theme
        r = client.get("/api/gamification/shop", headers=headers)
        assert r.status_code == 200
        assert r.json()["active_theme"] == "light"

        # Step 5: Switch back to dark
        r = client.post("/api/gamification/shop/activate", json={"theme": "dark"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["active_theme"] == "dark"


class TestBulkCompletionGamification:
    def _create_routine_and_session(self, client, headers):
        """Helper to create a routine + session for testing."""
        # Create routine
        routine_data = {
            "name": "Test Routine",
            "days": [{"day_name": "Day 1", "exercises": [{"exercise_id": 1, "sets": 3, "reps": 10}]}]
        }
        r = client.post("/api/routines", json=routine_data, headers=headers)
        assert r.status_code == 200
        routine_id = r.json()["id"]

        # Create session
        session_data = {
            "routine_id": routine_id,
            "day_index": 0,
            "started_at": datetime.utcnow().isoformat()
        }
        r = client.post("/api/sessions", json=session_data, headers=headers)
        assert r.status_code == 200
        session_id = r.json()["id"]

        return routine_id, session_id

    def test_complete_bulk_returns_gamification(self, client):
        """Bulk completing a session should return gamification rewards."""
        headers = register_and_login(client)
        _, session_id = self._create_routine_and_session(client, headers)

        # Create an exercise
        r = client.post("/api/exercises", json={
            "name": "Test Bench Press",
            "muscle": "Chest",
            "equipment": "Barbell",
            "type": "weighted"
        }, headers=headers)
        assert r.status_code == 200
        exercise_id = r.json()["id"]

        bulk_data = {
            "completed_at": datetime.utcnow().isoformat(),
            "sets": [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 60,
                    "reps": 10,
                    "completed_at": datetime.utcnow().isoformat()
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 2,
                    "weight_kg": 70,
                    "reps": 8,
                    "completed_at": datetime.utcnow().isoformat()
                }
            ]
        }

        r = client.post(f"/api/sessions/{session_id}/complete_bulk", json=bulk_data, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "gamification" in data
        assert data["gamification"]["xp_gained"] > 0
        assert data["completed_at"] is not None

    def test_complete_bulk_no_double_reward(self, client):
        """Completing an already-completed session should NOT give duplicate rewards."""
        headers = register_and_login(client)
        _, session_id = self._create_routine_and_session(client, headers)

        r = client.post("/api/exercises", json={
            "name": "Test Squat",
            "muscle": "Legs",
            "equipment": "Barbell",
            "type": "weighted"
        }, headers=headers)
        exercise_id = r.json()["id"]

        bulk_data = {
            "completed_at": datetime.utcnow().isoformat(),
            "sets": [{
                "exercise_id": exercise_id,
                "set_number": 1,
                "weight_kg": 100,
                "reps": 5,
                "completed_at": datetime.utcnow().isoformat()
            }]
        }

        # First completion
        r1 = client.post(f"/api/sessions/{session_id}/complete_bulk", json=bulk_data, headers=headers)
        assert r1.status_code == 200
        xp_first = r1.json().get("gamification", {}).get("xp_gained", 0)

        # Second completion (should not re-award XP)
        r2 = client.post(f"/api/sessions/{session_id}/complete_bulk", json=bulk_data, headers=headers)
        assert r2.status_code == 200
        # gamification key should be absent or xp_gained == 0 on second run
        gam = r2.json().get("gamification")
        if gam:
            assert gam.get("xp_gained", 0) == 0 or gam is None
