from __future__ import annotations

from typing import Any, Dict


STEP_COINS: Dict[str, int] = {
    "profile": 10,
    "questionnaire_l1": 20,
    "questionnaire_l2": 20,
    "questionnaire_l3": 20,
    "first_routine": 0,
    "first_session": 0,
    "tutorial_complete": 50,
}

DEFAULT_ONBOARDING_PROGRESS: Dict[str, Any] = {
    "profile": False,
    "questionnaire_l1": False,
    "questionnaire_l2": False,
    "questionnaire_l3": False,
    "first_routine": False,
    "first_session": False,
    "tutorial_complete": False,
    "coins_awarded": [],
}

REQUIRED_STEPS = ("profile", "questionnaire_l1", "first_routine", "first_session")


def normalize_onboarding_progress(raw: Dict[str, Any] | None) -> Dict[str, Any]:
    progress = dict(DEFAULT_ONBOARDING_PROGRESS)
    if isinstance(raw, dict):
        for key in DEFAULT_ONBOARDING_PROGRESS.keys():
            if key == "coins_awarded":
                continue
            if key in raw:
                progress[key] = bool(raw.get(key))

        awarded = raw.get("coins_awarded", [])
        if isinstance(awarded, list):
            cleaned = []
            seen = set()
            for step in awarded:
                if step in STEP_COINS and step not in seen:
                    cleaned.append(step)
                    seen.add(step)
            progress["coins_awarded"] = cleaned

    return progress


def _award_step(progress: Dict[str, Any], user: Any, step: str) -> int:
    reward = STEP_COINS.get(step, 0)
    awarded = progress.get("coins_awarded", [])
    if step in awarded:
        return 0

    awarded.append(step)
    progress["coins_awarded"] = awarded

    if reward > 0:
        user.currency = (user.currency or 0) + reward

    return reward


def _auto_complete_if_required_done(progress: Dict[str, Any], user: Any) -> int:
    if all(bool(progress.get(step)) for step in REQUIRED_STEPS) and not progress.get("tutorial_complete"):
        progress["tutorial_complete"] = True
        return _award_step(progress, user, "tutorial_complete")
    return 0


def mark_onboarding_step(user: Any, step: str, completed: bool = True) -> int:
    if step not in STEP_COINS:
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))
    coins_added = 0

    already_completed = bool(progress.get(step))
    progress[step] = bool(completed)

    if completed and not already_completed:
        coins_added += _award_step(progress, user, step)

    coins_added += _auto_complete_if_required_done(progress, user)
    user.onboarding_progress = progress
    return coins_added


def merge_onboarding_progress(user: Any, patch: Dict[str, Any] | None) -> int:
    if not isinstance(patch, dict):
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))
    coins_added = 0

    for key, value in patch.items():
        if key == "coins_awarded" or key not in STEP_COINS:
            continue
        if not isinstance(value, bool):
            continue

        already_completed = bool(progress.get(key))
        progress[key] = value

        if value and not already_completed:
            coins_added += _award_step(progress, user, key)

    coins_added += _auto_complete_if_required_done(progress, user)
    user.onboarding_progress = progress
    return coins_added


def apply_questionnaire_level(user: Any, context_level: int | None) -> int:
    if context_level is None:
        return 0

    try:
        level = int(context_level)
    except (TypeError, ValueError):
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))
    coins_added = 0

    if level >= 1 and not progress.get("questionnaire_l1"):
        progress["questionnaire_l1"] = True
        coins_added += _award_step(progress, user, "questionnaire_l1")

    if level >= 2 and not progress.get("questionnaire_l2"):
        progress["questionnaire_l2"] = True
        coins_added += _award_step(progress, user, "questionnaire_l2")

    if level >= 3 and not progress.get("questionnaire_l3"):
        progress["questionnaire_l3"] = True
        coins_added += _award_step(progress, user, "questionnaire_l3")

    coins_added += _auto_complete_if_required_done(progress, user)
    user.onboarding_progress = progress
    return coins_added
