"""
Gamification engine: XP, levels, quest progression, currency, streaks, and joker tokens.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.models.user import User
from app.models.session import Session as SessionModel, Set as SetModel
from app.models.quest import Quest, UserQuest
from datetime import datetime, timezone, timedelta


# ── XP Constants ─────────────────────────────────────────────────────────────
BASE_SESSION_XP = 50       # Just for completing a session
ROUTINE_COMPLETE_XP = 100  # Bonus for completing all days of a routine cycle
REP_PR_XP       = 10       # Per exercise where you beat your rep PR
WEIGHT_PR_XP    = 25       # Per exercise where you beat your weight PR
WEEKLY_XP_CAP   = 5        # Max sessions per week that earn base XP

# ── Streak Reward Tiers ─────────────────────────────────────────────────────
STREAK_TIERS = [
    (21, 21),   # Week 21+: 21 coins (cap)
    (20, 20),   # Week 20: 20 coins + Joker
    (10, 15),   # Weeks 10-19: 15 coins
    (5, 10),    # Weeks 5-9: 10 coins
    (1, 5),     # Weeks 1-4: 5 coins
]
JOKER_MILESTONE_WEEK = 20


def exp_for_next_level(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    return level * 100


def _get_week_boundaries():
    """Return (monday 00:00, sunday 23:59:59) for the current ISO week in UTC."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday, sunday


def _current_iso_week_str():
    """Return current ISO week as string e.g. '2026-W13'."""
    now = datetime.now(timezone.utc)
    iso = now.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _count_weekly_xp_sessions(db: Session, user_id: int) -> int:
    """Count completed sessions this week using the immutable streak_eligible_at."""
    monday, sunday = _get_week_boundaries()
    return db.query(sa_func.count(SessionModel.id)).filter(
        SessionModel.user_id == user_id,
        SessionModel.streak_eligible_at.isnot(None),
        SessionModel.streak_eligible_at >= monday,
        SessionModel.streak_eligible_at <= sunday,
    ).scalar() or 0


def _streak_coins(streak_weeks: int) -> int:
    """Return coins for a given streak length based on tier table."""
    for min_week, coins in STREAK_TIERS:
        if streak_weeks >= min_week:
            return coins
    return 0


def compute_streak_weeks(db: Session, user_id: int) -> int:
    """
    Compute consecutive weeks with >= 1 completed session, looking back from
    the current week. If the current week has no sessions yet, we still check
    from last week (the streak hasn't died until the week ends).
    """
    now = datetime.now(timezone.utc)
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    # Fetch all streak-eligible session dates (immutable, not editable by user)
    dates = [
        d for (d,) in db.query(SessionModel.streak_eligible_at).filter(
            SessionModel.user_id == user_id,
            SessionModel.streak_eligible_at.isnot(None),
        ).all()
    ]

    streak = 0
    for i in range(52):
        target_start = start_of_week - timedelta(weeks=i)
        target_end = target_start + timedelta(days=6)

        has_session = any(
            target_start.date() <= d.date() <= target_end.date()
            for d in dates
        ) if dates else False

        if has_session:
            streak += 1
        else:
            # Current week with no sessions is OK (streak alive until week ends)
            if i == 0:
                # Check if user used a joker this week
                user = db.query(User).filter(User.id == user_id).first()
                if user and user.streak_reward_week == _current_iso_week_str():
                    streak += 1  # Joker-covered week
                continue
            break

    return streak


def _check_routine_completion(db: Session, user_id: int, session_obj) -> bool:
    """
    Check if completing this session means all days of the routine are done.
    Returns True if routine cycle is now complete.
    """
    if not session_obj or not session_obj.routine_id:
        return False

    from app.models.routine import Routine
    from app.models.routine_completion import RoutineCompletion

    routine = db.query(Routine).get(session_obj.routine_id)
    if not routine or not routine.days:
        return False

    total_days = len(routine.days)
    if total_days < 1:
        return False

    # Find the most recent completion for this routine
    last_completion = db.query(RoutineCompletion).filter(
        RoutineCompletion.user_id == user_id,
        RoutineCompletion.routine_id == routine.id,
    ).order_by(RoutineCompletion.completed_at.desc()).first()

    # Get all completed sessions for this routine since last completion
    query = db.query(SessionModel.day_index).filter(
        SessionModel.user_id == user_id,
        SessionModel.routine_id == routine.id,
        SessionModel.completed_at.isnot(None),
    )
    if last_completion:
        query = query.filter(SessionModel.completed_at > last_completion.completed_at)

    completed_day_indices = {row[0] for row in query.all() if row[0] is not None}
    expected_indices = set(range(total_days))

    if completed_day_indices >= expected_indices:
        # All days completed! Record the completion using an explicit Python timestamp
        # so the microsecond precision is consistent with session completed_at values.
        new_completion = RoutineCompletion(
            user_id=user_id,
            routine_id=routine.id,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(new_completion)
        return True

    return False


def _detect_prs(db: Session, user_id: int, session_id: int):
    """
    Compare each exercise in `session_id` against all previous sessions
    for this user.  Returns (rep_prs, weight_prs, total_pr_xp_gained).
    """
    # Get all sets in this session, grouped by exercise
    current_sets = db.query(SetModel).filter(SetModel.session_id == session_id).all()
    if not current_sets:
        return 0, 0, 0

    exercises: dict[int, list] = {}
    for s in current_sets:
        exercises.setdefault(s.exercise_id, []).append(s)

    # All completed session ids for this user EXCEPT the current one
    prev_session_ids = [
        sid for (sid,) in db.query(SessionModel.id).filter(
            SessionModel.user_id == user_id,
            SessionModel.completed_at.isnot(None),
            SessionModel.id != session_id
        ).all()
    ]

    rep_prs = 0
    weight_prs = 0
    total_pr_xp = 0

    for ex_id, sets in exercises.items():
        if not prev_session_ids:
            # First session ever → establishing baseline, not a PR
            continue

        # Best previous reps & weight for this exercise
        prev_best = db.query(
            sa_func.max(SetModel.reps).label("max_reps"),
            sa_func.max(SetModel.weight_kg).label("max_weight")
        ).filter(
            SetModel.session_id.in_(prev_session_ids),
            SetModel.exercise_id == ex_id
        ).first()

        prev_max_reps = prev_best.max_reps if prev_best and prev_best.max_reps else 0
        prev_max_weight = prev_best.max_weight if prev_best and prev_best.max_weight else 0

        curr_max_reps = max((s.reps or 0) for s in sets)
        curr_max_weight = max((s.weight_kg or 0) for s in sets)

        # Count how many historical sessions actually had this exercise to scale the PR reward
        prev_sessions_count = db.query(sa_func.count(sa_func.distinct(SetModel.session_id))).filter(
            SetModel.session_id.in_(prev_session_ids),
            SetModel.exercise_id == ex_id
        ).scalar() or 0

        # Scaling multiplier: Starts at 1.0, increases by 0.05 per past session, caps at 5.0x base PR XP
        multiplier = min(5.0, 1.0 + (prev_sessions_count * 0.05))

        # Only count as PR if there was a previous record to beat
        if prev_max_reps > 0 and curr_max_reps > prev_max_reps:
            rep_prs += 1
            total_pr_xp += int(REP_PR_XP * multiplier)
        if prev_max_weight > 0 and curr_max_weight > prev_max_weight:
            weight_prs += 1
            total_pr_xp += int(WEIGHT_PR_XP * multiplier)

    return rep_prs, weight_prs, total_pr_xp


# ── Coin Deduction ──────────────────────────────────────────────────────────

def deduct_coins(db: Session, user: User, amount: int, use_joker: bool = False):
    """
    Deduct coins from user. If use_joker=True and user has tokens, consume
    a joker instead. Raises HTTP 402 if insufficient funds.
    """
    if use_joker and (user.joker_tokens or 0) > 0:
        user.joker_tokens -= 1
        db.flush()
        return  # Free via joker

    balance = user.currency or 0
    if balance < amount:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough coins. Need {amount}, have {balance}."
        )
    user.currency = balance - amount
    db.flush()


# ── Main XP Award ───────────────────────────────────────────────────────────

def award_session_xp(db: Session, user: User, session_id: int) -> dict:
    """
    Called when a session is completed. Awards XP (with weekly cap),
    checks routine completion, streak rewards, level-ups, and quest progress.
    Returns a summary dict for the frontend.
    """
    rep_prs, weight_prs, pr_xp_gained = _detect_prs(db, user.id, session_id)

    session_obj = db.query(SessionModel).get(session_id)

    # Weekly XP cap: count completed sessions this week (including this one)
    weekly_sessions = _count_weekly_xp_sessions(db, user.id)
    xp_capped = weekly_sessions > WEEKLY_XP_CAP

    # Base XP (0 if capped)
    base_xp = 0 if xp_capped else BASE_SESSION_XP

    # Routine completion bonus
    routine_completed = _check_routine_completion(db, user.id, session_obj)
    routine_bonus = ROUTINE_COMPLETE_XP if (routine_completed and not xp_capped) else 0

    # PR XP always awarded even when capped
    xp_gained = base_xp + routine_bonus + pr_xp_gained

    user.experience += xp_gained

    # Level up loop
    leveled_up = False
    starting_level = user.level
    while user.experience >= exp_for_next_level(user.level):
        user.experience -= exp_for_next_level(user.level)
        user.level += 1
        leveled_up = True
        # Award currency on level up (10 coins per level reached)
        user.currency = (user.currency or 0) + 10

    # Weekly streak check-in reward (no longer auto-awarded on session completion)
    streak_coins = 0
    joker_awarded = False
    streak_weeks = 0

    # Quest progression
    _update_quest_progress(db, user)

    db.commit()
    db.refresh(user)

    return {
        "xp_gained": xp_gained,
        "base_xp": base_xp,
        "routine_bonus": routine_bonus,
        "routine_completed": routine_completed,
        "rep_prs": rep_prs,
        "weight_prs": weight_prs,
        "leveled_up": leveled_up,
        "new_level": user.level,
        "old_level": starting_level,
        "experience": user.experience,
        "exp_to_next": exp_for_next_level(user.level),
        "currency": user.currency,
        "xp_capped": xp_capped,
        "weekly_xp_sessions": weekly_sessions,
        "streak_coins": streak_coins,
        "streak_weeks": streak_weeks,
        "joker_awarded": joker_awarded,
        "joker_tokens": user.joker_tokens or 0,
    }

def _week_str_to_monday(week_str: str) -> datetime:
    """Convert '2026-W13' to Monday 00:00 UTC of that ISO week."""
    year, wnum = week_str.split('-W')
    y, w = int(year), int(wnum)
    jan4 = datetime(y, 1, 4, tzinfo=timezone.utc)
    first_monday = jan4 - timedelta(days=jan4.weekday())
    return first_monday + timedelta(weeks=w - 1)


def compute_unclaimed_streak_data(db: Session, user: User) -> dict:
    """
    Compute unclaimed streak weeks and total coins due.
    Each week with a session after streak_reward_week earns coins based on the
    streak length AS OF that week.
    Returns: unclaimed_weeks, total_coins, current_streak, unclaimed_week_strs, joker_due
    """
    last_claimed = user.streak_reward_week or ""
    current_iso = _current_iso_week_str()

    all_dates = [
        d for (d,) in db.query(SessionModel.streak_eligible_at).filter(
            SessionModel.user_id == user.id,
            SessionModel.streak_eligible_at.isnot(None),
        ).all()
        if d is not None
    ]

    all_weeks_set: set[str] = set()
    for d in all_dates:
        iso = d.isocalendar()
        all_weeks_set.add(f"{iso[0]}-W{iso[1]:02d}")

    all_weeks = sorted(all_weeks_set)
    unclaimed = [w for w in all_weeks if w > last_claimed and w <= current_iso]

    current_streak = compute_streak_weeks(db, user.id)

    if not unclaimed:
        return {
            "unclaimed_weeks": 0,
            "total_coins": 0,
            "current_streak": current_streak,
            "unclaimed_week_strs": [],
            "joker_due": False,
        }

    coins_per_week = []
    total_coins = 0
    for target_week in unclaimed:
        target_monday = _week_str_to_monday(target_week)
        streak_at_week = 0
        check_monday = target_monday
        while True:
            iso = check_monday.isocalendar()
            ws = f"{iso[0]}-W{iso[1]:02d}"
            if ws in all_weeks_set:
                streak_at_week += 1
                check_monday -= timedelta(weeks=1)
            else:
                break
        week_coins = _streak_coins(streak_at_week)
        coins_per_week.append((target_week, week_coins))
        total_coins += week_coins

    joker_due = (
        current_streak >= JOKER_MILESTONE_WEEK
        and (user.joker_tokens or 0) == 0
    )

    return {
        "unclaimed_weeks": len(unclaimed),
        "total_coins": total_coins,
        "coins_per_week": coins_per_week,  # [(week_str, coins), ...] oldest first
        "current_streak": current_streak,
        "unclaimed_week_strs": unclaimed,
        "joker_due": joker_due,
    }


def get_streak_week_slots(db: Session, user_id: int, last_claimed_week: str) -> list:
    """
    Return 7 weekly slot dicts for the streak flame row based on streak_eligible_at.
    Index 0 = 6 weeks ago, index 6 = current week.
    """
    now = datetime.now(timezone.utc)
    start_of_current_week = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    session_dates = [
        d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
        for (d,) in db.query(SessionModel.streak_eligible_at).filter(
            SessionModel.user_id == user_id,
            SessionModel.streak_eligible_at.isnot(None),
        ).all()
        if d is not None
    ]

    slots = []
    for i in range(7):
        weeks_back = 6 - i
        week_start = start_of_current_week - timedelta(weeks=weeks_back)
        week_end = week_start + timedelta(days=7)

        count = sum(1 for d in session_dates if week_start <= d < week_end)
        iso = week_start.isocalendar()
        week_str = f"{iso[0]}-W{iso[1]:02d}"
        claimed = bool(last_claimed_week) and week_str <= last_claimed_week

        slots.append({
            "week": week_str,
            "start_date": week_start.date().isoformat(),
            "sessions": count,
            "claimed": claimed,
        })

    return slots


def remove_session_xp(db: Session, user: User, session_id: int):
    """
    Reverts the XP and Levels gained from a session. Should be called
    BEFORE the session is physically deleted from the database so we can
    re-run the PR detection and know exactly how much XP it gave.
    """
    # Recalculate what this session theoretically gave
    rep_prs, weight_prs, pr_xp_gained = _detect_prs(db, user.id, session_id)

    base_xp = BASE_SESSION_XP
    # Note: we don't try to figure out if it was capped at the time — just use base

    xp_to_remove = base_xp + pr_xp_gained

    user.experience -= xp_to_remove

    # Handle De-leveling
    while user.experience < 0 and user.level > 1:
        user.level -= 1
        user.experience += exp_for_next_level(user.level)
        user.currency = max(0, (user.currency or 0) - 10)

    # Floor at 0 if doing something weird down at level 1
    if user.level == 1 and user.experience < 0:
        user.experience = 0

    db.commit()
    return xp_to_remove


# ── Quest Progress ──────────────────────────────────────────────────────────

def _update_quest_progress(db: Session, user: User):
    """Update progress on all active (uncompleted) quests for the user."""
    active_quests = db.query(UserQuest).filter(
        UserQuest.user_id == user.id,
        UserQuest.completed == False  # noqa: E712
    ).all()

    for uq in active_quests:
        quest = db.query(Quest).get(uq.quest_id)
        if not quest:
            continue

        # Weekly quests scope to current Monday-Sunday
        if quest.is_weekly:
            monday, sunday = _get_week_boundaries()
            date_filter = [
                SessionModel.completed_at >= monday,
                SessionModel.completed_at <= sunday,
            ]
        else:
            date_filter = []

        if quest.req_type == "sessions":
            q = db.query(sa_func.count(SessionModel.id)).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None),
                *date_filter,
            )
            count = q.scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "sets":
            q = db.query(sa_func.count(SetModel.id)).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None),
                *date_filter,
            )
            count = q.scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "volume":
            q = db.query(
                sa_func.coalesce(
                    sa_func.sum(SetModel.weight_kg * SetModel.reps), 0
                )
            ).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None),
                *date_filter,
            )
            total = q.scalar()
            uq.progress = min(int(total), quest.req_value)

        elif quest.req_type == "routines":
            q = db.query(sa_func.count(SessionModel.id)).filter(
                SessionModel.user_id == user.id,
                SessionModel.routine_id.isnot(None),
                SessionModel.completed_at.isnot(None),
                *date_filter,
            )
            count = q.scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "duration":
            q = db.query(
                sa_func.coalesce(sa_func.sum(SetModel.duration_sec), 0)
            ).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None),
                *date_filter,
            )
            total_sec = q.scalar()
            minutes = int(total_sec) // 60
            uq.progress = min(minutes, quest.req_value)

        if uq.progress >= quest.req_value:
            uq.completed = True
            uq.completed_at = datetime.now(timezone.utc)


def claim_quest_reward(db: Session, user: User, user_quest_id: int) -> dict:
    """Claim reward for a completed quest. Returns the rewards granted."""
    uq = db.query(UserQuest).filter(
        UserQuest.id == user_quest_id,
        UserQuest.user_id == user.id
    ).first()
    if not uq:
        return {"error": "Quest not found"}
    if not uq.completed:
        return {"error": "Quest not completed yet"}
    if uq.claimed:
        return {"error": "Already claimed"}

    quest = db.query(Quest).get(uq.quest_id)

    uq.claimed = True
    user.experience += quest.exp_reward
    user.currency += quest.currency_reward

    # Check for level ups from quest XP
    leveled_up = False
    while user.experience >= exp_for_next_level(user.level):
        user.experience -= exp_for_next_level(user.level)
        user.level += 1
        leveled_up = True
        user.currency += 10

    db.commit()
    db.refresh(user)

    return {
        "exp_reward": quest.exp_reward,
        "currency_reward": quest.currency_reward,
        "leveled_up": leveled_up,
        "new_level": user.level,
        "experience": user.experience,
        "exp_to_next": exp_for_next_level(user.level),
        "currency": user.currency,
    }


def assign_quests(db: Session, user_id: int):
    """
    Assign lifetime quests.
    Rotate weekly quests: assign current week, delete old weeks.
    """
    # Calculate current week group A, B, C, or D
    current_iso_week = datetime.now(timezone.utc).isocalendar()[1]
    week_letters = ["A", "B", "C", "D"]
    current_week_group = week_letters[current_iso_week % 4]

    all_quests = db.query(Quest).all()
    user_quests = db.query(UserQuest).filter(UserQuest.user_id == user_id).all()

    # Track existing IDs
    existing_quest_ids = {uq.quest_id for uq in user_quests}

    # Delete old out-of-season weekly quests
    for uq in user_quests:
        q = next((q for q in all_quests if q.id == uq.quest_id), None)
        if q and q.is_weekly and q.week_group != current_week_group:
            db.delete(uq)
            existing_quest_ids.remove(uq.quest_id)

    # Assign missing quests
    new_assignments = []
    for q in all_quests:
        if q.id not in existing_quest_ids:
            if not q.is_weekly or (q.is_weekly and q.week_group == current_week_group):
                new_assignments.append(UserQuest(user_id=user_id, quest_id=q.id))

    if new_assignments:
        db.add_all(new_assignments)

    db.commit()


# ── Joker: Save Streak ──────────────────────────────────────────────────────

def use_joker_for_streak(db: Session, user: User) -> dict:
    """
    Use a joker token to save the current streak. Must be used during
    the week the streak would break (no sessions this week).
    """
    if (user.joker_tokens or 0) <= 0:
        raise HTTPException(status_code=400, detail="No joker tokens available")

    current_week = _current_iso_week_str()

    # Check if already rewarded this week (streak already saved or had a session)
    if user.streak_reward_week == current_week:
        raise HTTPException(status_code=400, detail="Streak already active this week")

    # Check that no sessions exist this week (using immutable streak_eligible_at)
    monday, sunday = _get_week_boundaries()
    sessions_this_week = db.query(sa_func.count(SessionModel.id)).filter(
        SessionModel.user_id == user.id,
        SessionModel.streak_eligible_at.isnot(None),
        SessionModel.streak_eligible_at >= monday,
        SessionModel.streak_eligible_at <= sunday,
    ).scalar() or 0

    if sessions_this_week > 0:
        raise HTTPException(status_code=400, detail="You already have sessions this week — no need for a joker")

    # Use the joker
    user.joker_tokens -= 1
    user.streak_reward_week = current_week  # Marks this week as "covered"

    # Award streak coins for this joker-covered week too
    streak_weeks = compute_streak_weeks(db, user.id)
    streak_coins = _streak_coins(streak_weeks) if streak_weeks > 0 else 0
    user.currency = (user.currency or 0) + streak_coins

    db.commit()
    db.refresh(user)

    return {
        "streak_saved": True,
        "streak_weeks": streak_weeks,
        "streak_coins": streak_coins,
        "joker_tokens": user.joker_tokens,
        "currency": user.currency,
    }
