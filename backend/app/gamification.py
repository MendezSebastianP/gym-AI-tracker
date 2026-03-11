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


def award_session_xp(db: Session, user: User, session_id: int) -> dict:
    """
    Called when a session is completed. Awards XP, checks level-ups, 
    and updates quest progress.  Returns a summary dict for the frontend.
    """
    rep_prs, weight_prs, pr_xp_gained = _detect_prs(db, user.id, session_id)

    session_obj = db.query(SessionModel).get(session_id)
    base_xp = BASE_SESSION_XP
    
    # 2x XP when the user finishes a routine with >= 2 days
    if session_obj and session_obj.routine_id:
        from app.models.routine import Routine
        routine = db.query(Routine).get(session_obj.routine_id)
        if routine and routine.days and len(routine.days) >= 2:
            if session_obj.day_index == len(routine.days) - 1:
                base_xp = BASE_SESSION_XP * 2

    xp_gained = base_xp + pr_xp_gained

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

def remove_session_xp(db: Session, user: User, session_id: int):
    """
    Reverts the XP and Levels gained from a session. Should be called
    BEFORE the session is physically deleted from the database so we can
    re-run the PR detection and know exactly how much XP it gave.
    """
    # Recalculate what this session theoretically gave
    rep_prs, weight_prs, pr_xp_gained = _detect_prs(db, user.id, session_id)
    
    session_obj = db.query(SessionModel).get(session_id)
    base_xp = BASE_SESSION_XP
    
    if session_obj and session_obj.routine_id:
        from app.models.routine import Routine
        routine = db.query(Routine).get(session_obj.routine_id)
        if routine and routine.days and len(routine.days) >= 2:
            if session_obj.day_index == len(routine.days) - 1:
                base_xp = BASE_SESSION_XP * 2

    xp_to_remove = base_xp + pr_xp_gained

    user.experience -= xp_to_remove

    # Handle De-leveling
    while user.experience < 0 and user.level > 1:
        # Step down a level
        user.level -= 1
        # Give back the experience for the level we just lost (e.g., passing from 2 to 1 means adding 100 to -10 -> 90)
        user.experience += exp_for_next_level(user.level)
        # Deduct the 10 coins given
        user.currency = max(0, user.currency - 10)

    # Floor at 0 if doing something weird down at level 1
    if user.level == 1 and user.experience < 0:
        user.experience = 0

    db.commit()
    return xp_to_remove

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

        elif quest.req_type == "routines":
            # Count of completed routines (sessions that have a routine_id).
            # To count unique routines vs total routines, maybe just count total routines completed.
            count = db.query(sa_func.count(SessionModel.id)).filter(
                SessionModel.user_id == user.id,
                SessionModel.routine_id.isnot(None),
                SessionModel.completed_at.isnot(None)
            ).scalar()
            uq.progress = min(count, quest.req_value)

        elif quest.req_type == "duration":
            # Total duration in minutes (stored in seconds in Sets, but quests expect minutes)
            total_sec = db.query(
                sa_func.coalesce(sa_func.sum(SetModel.duration_sec), 0)
            ).join(SessionModel).filter(
                SessionModel.user_id == user.id,
                SessionModel.completed_at.isnot(None)
            ).scalar()
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
