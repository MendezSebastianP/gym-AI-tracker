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


def _auto_complete_if_required_done(progress: Dict[str, Any]) -> bool:
    if all(bool(progress.get(step)) for step in REQUIRED_STEPS) and not progress.get("tutorial_complete"):
        progress["tutorial_complete"] = True
        return True
    return False


def mark_onboarding_step(user: Any, step: str, completed: bool = True) -> int:
    if step not in STEP_COINS:
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))

    already_completed = bool(progress.get(step))
    progress[step] = bool(completed)

    if completed and not already_completed:
        _auto_complete_if_required_done(progress)

    user.onboarding_progress = progress
    return 0


def merge_onboarding_progress(user: Any, patch: Dict[str, Any] | None) -> int:
    if not isinstance(patch, dict):
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))

    for key, value in patch.items():
        if key == "coins_awarded" or key not in STEP_COINS:
            continue
        if not isinstance(value, bool):
            continue

        already_completed = bool(progress.get(key))
        progress[key] = value

        if value and not already_completed:
            _auto_complete_if_required_done(progress)

    user.onboarding_progress = progress
    return 0


def apply_questionnaire_level(user: Any, context_level: int | None) -> int:
    if context_level is None:
        return 0

    try:
        level = int(context_level)
    except (TypeError, ValueError):
        return 0

    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))

    if level >= 1 and not progress.get("questionnaire_l1"):
        progress["questionnaire_l1"] = True

    if level >= 2 and not progress.get("questionnaire_l2"):
        progress["questionnaire_l2"] = True

    if level >= 3 and not progress.get("questionnaire_l3"):
        progress["questionnaire_l3"] = True

    _auto_complete_if_required_done(progress)
    user.onboarding_progress = progress
    return 0


def claim_onboarding_rewards(user: Any, step: str | None = None) -> Dict[str, Any]:
    progress = normalize_onboarding_progress(getattr(user, "onboarding_progress", None))
    _auto_complete_if_required_done(progress)

    claimed_steps = list(progress.get("coins_awarded", []))
    claimed_lookup = set(claimed_steps)
    newly_claimed: list[str] = []
    coins_awarded = 0

    if step is not None:
        reward = STEP_COINS.get(step, 0)
        if reward > 0 and bool(progress.get(step)) and step not in claimed_lookup:
            claimed_steps.append(step)
            claimed_lookup.add(step)
            newly_claimed.append(step)
            coins_awarded += reward
    else:
        for current_step, reward in STEP_COINS.items():
            if reward <= 0 or not progress.get(current_step) or current_step in claimed_lookup:
                continue

            claimed_steps.append(current_step)
            claimed_lookup.add(current_step)
            newly_claimed.append(current_step)
            coins_awarded += reward

    if coins_awarded > 0:
        user.currency = (user.currency or 0) + coins_awarded

    progress["coins_awarded"] = claimed_steps
    user.onboarding_progress = progress

    return {
        "coins_awarded": coins_awarded,
        "claimed_steps": newly_claimed,
        "onboarding_progress": progress,
    }
