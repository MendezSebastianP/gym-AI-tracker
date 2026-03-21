"""
Bodyweight exercise progression chains.

Each chain maps a movement pattern to an ordered list of exercise names
(matching the exercises table). Position 0 = easiest regression.

The migration seeds `exercise_progressions` from these definitions,
resolving names to exercise IDs at migration time.
"""

# (exercise_name, target_reps_to_advance, target_sets_to_advance, sessions_to_advance,
#  suggested_starting_sets, suggested_starting_reps)

CHAINS: dict[str, list[tuple[str, int, int, int, int, str]]] = {
    # ── Horizontal Push (standard) ──────────────────────────────────────
    "horizontal_push_standard": [
        ("Wall Push Up",            10, 3, 3, 3, "4-6"),
        ("Incline Push Up",         10, 3, 3, 3, "4-6"),
        ("Knee Push Up",            10, 3, 3, 3, "4-6"),
        ("Push Up",                 10, 3, 3, 3, "4-6"),
        ("Wide Push Up",            10, 3, 3, 3, "4-6"),
        ("Push Up Diamond",         10, 3, 3, 3, "4-6"),
        ("Pseudo Planche Push Up",  10, 3, 3, 3, "3-5"),
        ("Archer Push Up",          10, 3, 3, 3, "3-5"),
        ("One Arm Push Up",          8, 3, 3, 3, "2-4"),
    ],

    # ── Horizontal Push (decline / overhead) ────────────────────────────
    "horizontal_push_decline": [
        ("Decline Push Up",                 10, 3, 3, 3, "4-6"),
        ("Decline Pike Push Up",            10, 3, 3, 3, "4-6"),
        ("Pike Push Up",                    10, 3, 3, 3, "4-6"),
        ("Handstand Push Up (Wall)",        10, 3, 3, 3, "3-5"),
        ("Handstand Push Up (Freestanding)", 8, 3, 3, 3, "2-4"),
    ],

    # ── Vertical Push (dip) ─────────────────────────────────────────────
    "vertical_push_dip": [
        ("Bench Dips",      10, 3, 3, 3, "4-6"),
        ("Negative Dip",    10, 3, 3, 3, "4-6"),
        ("Dips",            10, 3, 3, 3, "4-6"),
        ("Ring Dips",       10, 3, 3, 3, "4-6"),
        # Weighted Dip not in BW list — chain ends here for bodyweight
    ],

    # ── Pull (vertical) ─────────────────────────────────────────────────
    "pull_vertical": [
        ("Scapular Pull Up",        10, 3, 3, 3, "4-6"),
        ("Negative Pull Up",        10, 3, 3, 3, "4-6"),
        ("Band Assisted Pull Up",   10, 3, 3, 3, "4-6"),
        ("Pull Up",                 10, 3, 3, 3, "4-6"),
        ("L-Sit Pull Up",           10, 3, 3, 3, "3-5"),
        # Weighted Pull-up not BW
        ("Muscle Up (Bar)",          8, 3, 3, 3, "2-3"),
    ],

    # ── Pull (horizontal / rows) ────────────────────────────────────────
    "pull_horizontal": [
        ("Ring Row",         10, 3, 3, 3, "4-6"),
        ("Inverted Row",     10, 3, 3, 3, "4-6"),
        ("Archer Pull Up",   10, 3, 3, 3, "3-5"),
        # Front lever rows not in DB as standalone — chain ends
    ],

    # ── Squat ───────────────────────────────────────────────────────────
    "squat": [
        ("Jumping Squat",         10, 3, 3, 3, "4-6"),  # used as an accessible entry
        ("Cossack Squat",         10, 3, 3, 3, "4-6"),
        ("Lunge",                 10, 3, 3, 3, "4-6"),
        ("Shrimp Squat",          10, 3, 3, 3, "3-5"),
        ("Assisted Pistol Squat", 10, 3, 3, 3, "3-5"),
        ("Pistol Squat",           8, 3, 3, 3, "2-4"),
    ],

    # ── Hinge ───────────────────────────────────────────────────────────
    "hinge": [
        ("Glute Bridge",           10, 3, 3, 3, "4-6"),
        ("Hyperextension",         10, 3, 3, 3, "4-6"),
        ("Nordic Hamstring Curl",  10, 3, 3, 3, "3-5"),
    ],

    # ── Core (anterior) ─────────────────────────────────────────────────
    "core_anterior": [
        ("Crunch",              10, 3, 3, 3, "6-8"),
        ("Plank",               10, 3, 3, 3, "4-6"),  # reps = ~10s holds
        ("Hollow Body Hold",    10, 3, 3, 3, "4-6"),
        ("Ab Wheel Rollout",    10, 3, 3, 3, "4-6"),
        ("Dragon Flag",          8, 3, 3, 3, "2-4"),
    ],

    # ── Core (rotational / oblique) ─────────────────────────────────────
    "core_rotational": [
        ("Russian Twist",         10, 3, 3, 3, "6-8"),
        ("Side Plank",            10, 3, 3, 3, "4-6"),
        ("Bicycle Crunches",      10, 3, 3, 3, "6-8"),
        ("Windshield Wipers",     10, 3, 3, 3, "3-5"),
    ],

    # ── Core (hanging) ──────────────────────────────────────────────────
    "core_hanging": [
        ("Leg Raise",             10, 3, 3, 3, "6-8"),
        ("Hanging Leg Raise",     10, 3, 3, 3, "4-6"),
        ("Tuck L-Sit",            10, 3, 3, 3, "4-6"),
        ("L-Sit",                 10, 3, 3, 3, "4-6"),
        ("V-Ups",                 10, 3, 3, 3, "3-5"),
    ],

    # ── Core (lower back) ──────────────────────────────────────────────
    "core_lower_back": [
        ("Hyperextension",       10, 3, 3, 3, "6-8"),
        ("Hollow Body Rocks",    10, 3, 3, 3, "6-8"),
    ],
}


def get_chain_for_exercise(exercise_name: str) -> tuple[str, int] | None:
    """Return (chain_name, position) if this exercise belongs to any chain."""
    for chain_name, exercises in CHAINS.items():
        for pos, (name, *_) in enumerate(exercises):
            if name == exercise_name:
                return (chain_name, pos)
    return None


def get_next_in_chain(chain_name: str, current_position: int) -> tuple[str, str] | None:
    """Return (exercise_name, suggested_starting_reps) for the next progression, or None."""
    chain = CHAINS.get(chain_name)
    if not chain:
        return None
    next_pos = current_position + 1
    if next_pos >= len(chain):
        return None
    name, _, _, _, _, reps = chain[next_pos]
    return (name, reps)


def get_prev_in_chain(chain_name: str, current_position: int) -> tuple[str, str] | None:
    """Return (exercise_name, suggested_starting_reps) for the previous regression, or None."""
    chain = CHAINS.get(chain_name)
    if not chain:
        return None
    prev_pos = current_position - 1
    if prev_pos < 0:
        return None
    name, _, _, _, _, reps = chain[prev_pos]
    return (name, reps)
