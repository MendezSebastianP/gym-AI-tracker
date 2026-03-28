"""
Tests for the Economy Overhaul features:
  - deduct_coins() helper (direct unit tests)
  - Weekly XP cap (5 sessions/week earn base XP)
  - Routine completion bonus (+100 XP)
  - Weekly streak check-in rewards (tiered coins)
  - Joker token streak-save endpoint
  - Weekly quest progress scoping (current week only)
"""
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import sessionmaker
from tests.conftest import register_and_login


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_iso():
    """Current UTC datetime as timezone-aware ISO string."""
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture
def db_session(db_engine):
    """Direct SQLAlchemy session for test-database manipulation."""
    Sess = sessionmaker(bind=db_engine)
    s = Sess()
    yield s
    s.close()


def _create_exercise(client, headers, name="Bench Press"):
    r = client.post("/api/exercises", json={
        "name": name, "muscle": "Chest", "equipment": "Barbell", "type": "weighted"
    }, headers=headers)
    assert r.status_code == 200
    return r.json()["id"]


def _create_routine(client, headers, num_days=1):
    days = [{"day_name": f"Day {i + 1}", "exercises": []} for i in range(num_days)]
    r = client.post("/api/routines", json={"name": "Test Routine", "days": days}, headers=headers)
    assert r.status_code == 200
    return r.json()["id"]


def _complete_session(client, headers, exercise_id,
                      routine_id=None, day_index=0,
                      weight=60.0, reps=10, completed_at=None):
    """Create and bulk-complete a session via the API."""
    session_data = {"started_at": _now_iso()}
    if routine_id is not None:
        session_data["routine_id"] = routine_id
        session_data["day_index"] = day_index

    r = client.post("/api/sessions", json=session_data, headers=headers)
    assert r.status_code == 200
    session_id = r.json()["id"]

    ts = completed_at or _now_iso()
    bulk = {
        "completed_at": ts,
        "sets": [{
            "exercise_id": exercise_id,
            "set_number": 1,
            "weight_kg": weight,
            "reps": reps,
            "completed_at": ts,
        }],
    }
    r = client.post(f"/api/sessions/{session_id}/complete_bulk", json=bulk, headers=headers)
    assert r.status_code == 200
    return r.json()


def _get_user(db_session):
    from app.models.user import User
    return db_session.query(User).first()


# ── deduct_coins() unit tests ─────────────────────────────────────────────────

class TestDeductCoins:
    """Direct unit tests for the deduct_coins() helper."""

    def test_sufficient_balance_deducts_correctly(self, db_session):
        from app.models.user import User
        from app.gamification import deduct_coins

        user = User(email="dc1@test.com", password_hash="x", currency=100)
        db_session.add(user)
        db_session.commit()

        deduct_coins(db_session, user, 50)
        assert user.currency == 50

    def test_insufficient_balance_raises_402(self, db_session):
        from fastapi import HTTPException
        from app.models.user import User
        from app.gamification import deduct_coins

        user = User(email="dc2@test.com", password_hash="x", currency=30)
        db_session.add(user)
        db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            deduct_coins(db_session, user, 50)
        assert exc_info.value.status_code == 402
        assert "30" in exc_info.value.detail
        assert "50" in exc_info.value.detail

    def test_joker_bypass_skips_coin_deduction(self, db_session):
        from app.models.user import User
        from app.gamification import deduct_coins

        user = User(email="dc3@test.com", password_hash="x", currency=0, joker_tokens=1)
        db_session.add(user)
        db_session.commit()

        deduct_coins(db_session, user, 50, use_joker=True)
        assert user.currency == 0       # no coins deducted
        assert user.joker_tokens == 0   # joker consumed

    def test_use_joker_false_does_not_consume_token(self, db_session):
        from fastapi import HTTPException
        from app.models.user import User
        from app.gamification import deduct_coins

        user = User(email="dc4@test.com", password_hash="x", currency=0, joker_tokens=1)
        db_session.add(user)
        db_session.commit()

        # use_joker=False: even if tokens available, deduct coins normally
        with pytest.raises(HTTPException) as exc_info:
            deduct_coins(db_session, user, 50, use_joker=False)
        assert exc_info.value.status_code == 402
        assert user.joker_tokens == 1   # joker untouched

    def test_deduct_to_zero(self, db_session):
        from app.models.user import User
        from app.gamification import deduct_coins

        user = User(email="dc5@test.com", password_hash="x", currency=50)
        db_session.add(user)
        db_session.commit()

        deduct_coins(db_session, user, 50)
        assert user.currency == 0


# ── Weekly XP cap ─────────────────────────────────────────────────────────────

class TestWeeklyXPCap:
    """Sessions 1-5 in a week earn base XP; sessions 6+ do not."""

    def test_first_five_sessions_earn_base_xp(self, client):
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Cap Ex A")

        for i in range(5):
            result = _complete_session(client, headers, ex_id)
            gam = result.get("gamification", {})
            assert gam.get("base_xp", 0) == 50, f"Session {i + 1} should earn base XP"
            assert not gam.get("xp_capped", False), f"Session {i + 1} should not be capped"

    def test_sixth_session_is_capped(self, client):
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Cap Ex B")

        for _ in range(5):
            _complete_session(client, headers, ex_id)

        result = _complete_session(client, headers, ex_id)
        gam = result.get("gamification", {})
        assert gam.get("xp_capped") is True
        assert gam.get("base_xp", 50) == 0
        assert gam.get("weekly_xp_sessions", 0) > 5

    def test_pr_bonuses_still_awarded_when_capped(self, client):
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Cap Ex C")

        # Session 1 establishes baseline (no PRs on first session)
        _complete_session(client, headers, ex_id, weight=60, reps=10)

        # Sessions 2-5 to reach cap (same weight/reps, no PRs)
        for _ in range(4):
            _complete_session(client, headers, ex_id, weight=60, reps=10)

        # Session 6: capped for base XP, but beat the weight PR
        result = _complete_session(client, headers, ex_id, weight=70, reps=10)
        gam = result.get("gamification", {})
        assert gam.get("xp_capped") is True
        assert gam.get("base_xp", 50) == 0
        assert gam.get("weight_prs", 0) >= 1
        assert gam.get("xp_gained", 0) > 0   # PR XP still applied


# ── Routine completion bonus ──────────────────────────────────────────────────

class TestRoutineCompletion:
    """Completing all days of a routine cycle awards +100 XP."""

    def test_single_day_routine_completes_immediately(self, client):
        headers = register_and_login(client)
        routine_id = _create_routine(client, headers, num_days=1)
        ex_id = _create_exercise(client, headers, "RC 1d")

        result = _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=0)
        gam = result.get("gamification", {})
        assert gam.get("routine_completed") is True
        assert gam.get("routine_bonus", 0) == 100

    def test_two_day_routine_no_bonus_on_first_day(self, client):
        headers = register_and_login(client)
        routine_id = _create_routine(client, headers, num_days=2)
        ex_id = _create_exercise(client, headers, "RC 2d a")

        result = _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=0)
        gam = result.get("gamification", {})
        assert gam.get("routine_completed") is not True
        assert gam.get("routine_bonus", 0) == 0

    def test_two_day_routine_bonus_on_last_day(self, client):
        headers = register_and_login(client)
        routine_id = _create_routine(client, headers, num_days=2)
        ex_id = _create_exercise(client, headers, "RC 2d b")

        _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=0)
        result = _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=1)
        gam = result.get("gamification", {})
        assert gam.get("routine_completed") is True
        assert gam.get("routine_bonus", 0) == 100

    def test_routine_cycle_resets_after_completion(self, client):
        """After completing a cycle, day 0 alone should NOT re-award the bonus."""
        headers = register_and_login(client)
        routine_id = _create_routine(client, headers, num_days=2)
        ex_id = _create_exercise(client, headers, "RC cycle")

        # First cycle: both days done
        _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=0)
        r1 = _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=1)
        assert r1["gamification"]["routine_completed"] is True

        # Second cycle: only day 0 — should not complete yet
        result = _complete_session(client, headers, ex_id, routine_id=routine_id, day_index=0)
        gam = result.get("gamification", {})
        assert gam.get("routine_completed") is not True
        assert gam.get("routine_bonus", 0) == 0

    def test_session_without_routine_no_bonus(self, client):
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "RC no routine")

        result = _complete_session(client, headers, ex_id)
        gam = result.get("gamification", {})
        assert gam.get("routine_completed") is not True
        assert gam.get("routine_bonus", 0) == 0


# ── Streak check-in rewards ───────────────────────────────────────────────────

class TestStreakCheckIn:
    """Streak coins are earned per eligible week and must be claimed manually."""

    def test_completing_session_does_not_auto_award_coins(self, client):
        """Session completion no longer auto-awards streak coins."""
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Streak no-auto")
        result = _complete_session(client, headers, ex_id)
        gam = result.get("gamification", {})
        # streak_coins in the response should be 0 (no auto-award)
        assert gam.get("streak_coins", 0) == 0

    def test_manual_claim_awards_coins_for_one_week(self, client):
        """After completing a session, manual /streak/claim gives coins."""
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Streak claim1")
        _complete_session(client, headers, ex_id)

        r = client.post("/api/gamification/streak/claim", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["claimed_weeks"] == 1
        assert data["streak_coins"] == 5  # week 1 → tier 1 = 5 coins
        assert data["streak_weeks"] >= 1

    def test_claim_idempotent_no_double_award(self, client):
        """Claiming twice in the same week gives 0 on second claim."""
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Streak idem")
        _complete_session(client, headers, ex_id)

        r1 = client.post("/api/gamification/streak/claim", headers=headers)
        assert r1.json()["streak_coins"] == 5

        r2 = client.post("/api/gamification/streak/claim", headers=headers)
        assert r2.json()["claimed_weeks"] == 0
        assert r2.json()["streak_coins"] == 0

    def test_claim_nothing_if_no_sessions(self, client):
        """Claim with no sessions this week returns 0."""
        headers = register_and_login(client)
        r = client.post("/api/gamification/streak/claim", headers=headers)
        assert r.status_code == 200
        assert r.json()["claimed_weeks"] == 0

    def test_claim_coins_reflected_in_currency(self, client):
        """After claiming, currency should include streak coins."""
        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Streak currency")
        _complete_session(client, headers, ex_id)

        r_before = client.get("/api/gamification/stats", headers=headers)
        currency_before = r_before.json()["currency"]

        client.post("/api/gamification/streak/claim", headers=headers)

        r_after = client.get("/api/gamification/stats", headers=headers)
        currency_after = r_after.json()["currency"]
        assert currency_after == currency_before + 5

    def test_five_week_streak_claim_awards_correct_tier(self, client, db_engine):
        """After 5 consecutive weeks, claiming gives 10 coins for week 5."""
        from app.models.session import Session as SessionModel
        from app.models.user import User

        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Streak tier")

        # Complete session this week
        _complete_session(client, headers, ex_id)

        # Seed 4 prior weeks
        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            now = datetime.now(timezone.utc)
            for weeks_back in range(4, 0, -1):
                past_date = now - timedelta(weeks=weeks_back)
                s.add(SessionModel(user_id=user.id, started_at=past_date, completed_at=past_date, streak_eligible_at=past_date))
            user.streak_reward_week = None
            s.commit()
        finally:
            s.close()

        # Claim all 5 weeks at once
        r = client.post("/api/gamification/streak/claim", headers=headers)
        data = r.json()
        assert data["claimed_weeks"] == 5
        assert data["streak_weeks"] >= 5
        # Coins: weeks 1-4 @ 5 coins each + week 5 @ 10 coins = 30
        assert data["streak_coins"] == 30


# ── Joker streak-save endpoint ────────────────────────────────────────────────

class TestJokerStreak:
    """POST /api/gamification/joker-streak — save a dying streak."""

    def test_no_tokens_returns_400(self, client):
        headers = register_and_login(client)
        r = client.post("/api/gamification/joker-streak", headers=headers)
        assert r.status_code == 400
        assert "no joker" in r.json()["detail"].lower()

    def test_has_sessions_this_week_returns_400(self, client, db_engine):
        from app.models.user import User

        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Joker sessions")

        # Complete a session this week
        _complete_session(client, headers, ex_id)

        # Give the user a joker token
        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            user.joker_tokens = 1
            s.commit()
        finally:
            s.close()

        r = client.post("/api/gamification/joker-streak", headers=headers)
        assert r.status_code == 400
        # Completing a session this week marks streak_reward_week as active
        assert "already" in r.json()["detail"].lower()

    def test_saves_streak_and_consumes_token(self, client, db_engine):
        from app.models.session import Session as SessionModel
        from app.models.user import User

        headers = register_and_login(client)

        # Give joker token + seed a past-week session for an active streak
        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            user.joker_tokens = 2
            last_week = datetime.now(timezone.utc) - timedelta(weeks=1)
            s.add(SessionModel(user_id=user.id, started_at=last_week, completed_at=last_week))
            user.streak_reward_week = None
            s.commit()
        finally:
            s.close()

        r = client.post("/api/gamification/joker-streak", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["streak_saved"] is True
        assert data["joker_tokens"] == 1   # consumed one of the two
        assert data["streak_weeks"] >= 1

    def test_joker_twice_same_week_fails(self, client, db_engine):
        from app.models.session import Session as SessionModel
        from app.models.user import User

        headers = register_and_login(client)

        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            user.joker_tokens = 2
            last_week = datetime.now(timezone.utc) - timedelta(weeks=1)
            s.add(SessionModel(user_id=user.id, started_at=last_week, completed_at=last_week))
            user.streak_reward_week = None
            s.commit()
        finally:
            s.close()

        r1 = client.post("/api/gamification/joker-streak", headers=headers)
        assert r1.status_code == 200

        r2 = client.post("/api/gamification/joker-streak", headers=headers)
        assert r2.status_code == 400
        assert "already active" in r2.json()["detail"].lower()

    def test_unauthenticated_returns_401(self, client):
        r = client.post("/api/gamification/joker-streak")
        assert r.status_code == 401


# ── Weekly quest scoping ──────────────────────────────────────────────────────

class TestWeeklyQuestScoping:
    """Weekly quests count only current-week activity; lifetime quests count all time."""

    def _seed_quests(self, db_engine):
        """Seed one lifetime quest + one weekly quest matching the current week group."""
        from app.models.quest import Quest

        # Determine current week group (A/B/C/D)
        current_iso_week = datetime.now(timezone.utc).isocalendar()[1]
        current_group = ["A", "B", "C", "D"][current_iso_week % 4]

        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            lifetime_q = Quest(
                name="Lifetime Sessions", description="Complete 2 sessions (all time)",
                req_type="sessions", req_value=2,
                exp_reward=10, currency_reward=5,
                is_weekly=False, week_group=None,
            )
            weekly_q = Quest(
                name="Weekly Sessions", description="Complete 2 sessions this week",
                req_type="sessions", req_value=2,
                exp_reward=10, currency_reward=5,
                is_weekly=True, week_group=current_group,
            )
            s.add_all([lifetime_q, weekly_q])
            s.commit()
            lifetime_id = lifetime_q.id
            weekly_id = weekly_q.id
        finally:
            s.close()

        return lifetime_id, weekly_id

    def test_lifetime_quest_counts_past_week_sessions(self, client, db_engine):
        from app.models.session import Session as SessionModel
        from app.models.user import User

        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Quest lt ex")
        lifetime_id, _ = self._seed_quests(db_engine)

        # Seed one session from last week
        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            last_week = datetime.now(timezone.utc) - timedelta(weeks=1)
            s.add(SessionModel(user_id=user.id, started_at=last_week, completed_at=last_week))
            s.commit()
        finally:
            s.close()

        # Assign quests to the user BEFORE completing the session (so _update_quest_progress sees them)
        client.get("/api/gamification/quests", headers=headers)

        # Complete 1 more session this week → total all-time = 2
        _complete_session(client, headers, ex_id)

        r = client.get("/api/gamification/quests", headers=headers)
        assert r.status_code == 200
        quests = r.json()
        lt_quest = next((q for q in quests if q.get("quest_id") == lifetime_id), None)
        assert lt_quest is not None, "Lifetime quest should be assigned"
        assert lt_quest["progress"] >= 2, "Lifetime quest should see the past-week session"

    def test_weekly_quest_ignores_previous_week_sessions(self, client, db_engine):
        from app.models.session import Session as SessionModel
        from app.models.user import User

        headers = register_and_login(client)
        ex_id = _create_exercise(client, headers, "Quest wk ex")
        _, weekly_id = self._seed_quests(db_engine)

        # Seed one session from last week
        Sess = sessionmaker(bind=db_engine)
        s = Sess()
        try:
            user = s.query(User).first()
            last_week = datetime.now(timezone.utc) - timedelta(weeks=1)
            s.add(SessionModel(user_id=user.id, started_at=last_week, completed_at=last_week))
            s.commit()
        finally:
            s.close()

        # Assign quests to the user BEFORE completing the session
        client.get("/api/gamification/quests", headers=headers)

        # Complete only 1 session this week
        _complete_session(client, headers, ex_id)

        r = client.get("/api/gamification/quests", headers=headers)
        assert r.status_code == 200
        quests = r.json()
        wk_quest = next((q for q in quests if q.get("quest_id") == weekly_id), None)
        assert wk_quest is not None, "Weekly quest should be assigned"
        assert wk_quest["progress"] == 1, "Weekly quest should only count this week's 1 session"
        assert not wk_quest["completed"], "Weekly quest should not be completed yet (needs 2)"
