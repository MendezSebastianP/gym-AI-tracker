"""
Gamification engine: XP, levels, quest progression, and currency.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from app.models.user import User
from app.models.session import Session as SessionModel, Set as SetModel
from app.models.quest import Quest, UserQuest
from datetime import datetime, timezone


# ── XP Constants ─────────────────────────────────────────────────────────────
BASE_SESSION_XP = 50       # Just for completing a session
REP_PR_XP       = 10       # Per exercise where you beat your rep PR
WEIGHT_PR_XP    = 25       # Per exercise where you beat your weight PR


def exp_for_next_level(level: int) -> int:
    """XP needed to go from `level` to `level + 1`."""
    return level * 100


def _detect_prs(db: Session, user_id: int, session_id: int):
    """
    Compare each exercise in `session_id` against all previous sessions
    for this user.  Returns (rep_prs, weight_prs) counts.
    """
    # Get all sets in this session, grouped by exercise
    current_sets = db.query(SetModel).filter(SetModel.session_id == session_id).all()
    if not current_sets:
        return 0, 0

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

    for ex_id, sets in exercises.items():
        if not prev_session_ids:
            # First session ever → every exercise is a PR
            rep_prs += 1
            weight_prs += 1
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

        if curr_max_reps > prev_max_reps and prev_max_reps > 0:
            rep_prs += 1
        if curr_max_weight > prev_max_weight and prev_max_weight > 0:
            weight_prs += 1

    return rep_prs, weight_prs


def award_session_xp(db: Session, user: User, session_id: int) -> dict:
    """
    Called when a session is completed. Awards XP, checks level-ups, 
    and updates quest progress.  Returns a summary dict for the frontend.
    """
    rep_prs, weight_prs = _detect_prs(db, user.id, session_id)

    xp_gained = BASE_SESSION_XP + (rep_prs * REP_PR_XP) + (weight_prs * WEIGHT_PR_XP)

    user.experience += xp_gained

    # Level up loop
    leveled_up = False
    starting_level = user.level
    while user.experience >= exp_for_next_level(user.level):
        user.experience -= exp_for_next_level(user.level)
        user.level += 1
        leveled_up = True
        # Award currency on level up (10 coins per level reached)
        user.currency += 10

    # Quest progression
    _update_quest_progress(db, user)

    db.commit()
    db.refresh(user)

    return {
        "xp_gained": xp_gained,
        "rep_prs": rep_prs,
        "weight_prs": weight_prs,
        "leveled_up": leveled_up,
        "new_level": user.level,
        "old_level": starting_level,
        "experience": user.experience,
        "exp_to_next": exp_for_next_level(user.level),
        "currency": user.currency,
    }


def _update_quest_progress(db: Session, user: User):
    """Update progress on all active (uncompleted) quests for the user."""
    active_quests = db.query(UserQuest).filter(
        UserQuest.user_id == user.id,
        UserQuest.completed == False
    ).all()

    for uq in active_quests:
        quest = db.query(Quest).get(uq.quest_id)
        if not quest:
            continue

        if quest.req_type == "sessions":
            count = db.query(sa_func.count(SessionModel.id)).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None)
            ).scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "sets":
            # Total sets the user has ever done
            count = db.query(sa_func.count(SetModel.id)).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None)
            ).scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "volume":
            # Total volume (weight * reps) across all sessions
            total = db.query(
                sa_func.coalesce(
                    sa_func.sum(SetModel.weight_kg * SetModel.reps), 0
                )
            ).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None)
            ).scalar()
            uq.progress = min(int(total), quest.req_value)

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


def assign_default_quests(db: Session, user_id: int):
    """Assign all available quests to the user if they don't already have them."""
    all_quests = db.query(Quest).all()
    existing_quest_ids = set(
        qid for (qid,) in db.query(UserQuest.quest_id).filter(
            UserQuest.user_id == user_id
        ).all()
    )
    for q in all_quests:
        if q.id not in existing_quest_ids:
            db.add(UserQuest(user_id=user_id, quest_id=q.id))
    db.commit()
