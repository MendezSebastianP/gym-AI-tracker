# Per-exercise difficulty scoring for NSS (Normalised Strength Score)
#
# difficulty_factor: multiplier for weighted exercises (anchor: Bench Press = 1.0)
#   Formula: typical_bench_max / typical_exercise_max
#   Higher = exercise uses less absolute weight at equivalent effort
#
# bw_ratio: fraction of bodyweight engaged per rep for bodyweight exercises
#   (anchor: Pull-up = 1.0)
#
# Only one of the two should be set per exercise (based on is_bodyweight).
# If an exercise is missing from these maps, defaults apply (df=1.0, bw=0.65).

# ── Weighted exercise difficulty factors ─────────────────────────────────────
# Anchor: Bench Press = 1.0 (typical intermediate max ~100 kg)
DIFFICULTY_FACTORS = {
    # CHEST — weighted
    'Bench Press':              1.00,  # anchor
    'Incline Bench Press':      1.10,  # ~90 kg max → 100/90
    'Dumbbell Press':           1.80,  # ~55 kg total max → 100/55 (per hand)
    'Incline Dumbbell Press':   2.00,  # ~50 kg total
    'Chest Fly':                4.00,  # ~25 kg max
    'Cable Crossover':          4.00,  # ~25 kg
    'Decline Bench Press':      0.95,  # ~105 kg max
    'Machine Chest Press':      1.20,  # ~85 kg
    'Pec Deck':                 3.50,  # ~30 kg
    'Cable Fly Low to High':    4.50,  # ~22 kg
    'Incline Dumbbell Fly':     5.00,  # ~20 kg
    'Landmine Press':           1.50,  # ~65 kg
    'Incline Smith Press':      1.05,  # ~95 kg
    'Pec Deck Fly':             3.50,
    'Incline Machine Press':    1.30,
    'Decline Machine Press':    1.15,

    # BACK — weighted
    'Deadlift':                 0.60,  # ~170 kg max
    'Lat Pulldown':             1.40,  # ~70 kg
    'Seated Row':               1.30,  # ~75 kg
    'Bent Over Row':            0.90,  # ~110 kg
    'Dumbbell Row':             1.60,  # ~60 kg per hand
    'T-Bar Row':                0.85,  # ~120 kg
    'Lat Pulldown (Close Grip)':1.40,
    'Straight Arm Pulldown':    3.30,  # ~30 kg
    'Meadows Row':              1.80,  # ~55 kg
    'Pendlay Row':              0.95,  # ~105 kg
    'T-Bar Row Machine':        0.90,
    'Chest Supported Row':      1.40,
    'V-Bar Pulldown':           1.40,
    'Cable T-Bar Row':          1.30,
    'High Row Machine':         1.30,
    'Dumbbell Pullover':        2.50,  # ~40 kg
    'Lat Pulldown (Reverse Grip)': 1.45,
    'Shrug':                    0.50,  # ~200 kg
    'Smith Machine Shrug':      0.55,
    'Deficit Deadlift':         0.65,
    'Snatch Grip Deadlift':     0.70,
    'Yates Row':                0.85,

    # LEGS — weighted
    'Squat':                    0.70,  # ~140 kg
    'Front Squat':              0.85,  # ~120 kg
    'Leg Press':                0.35,  # ~280 kg (machine advantage)
    'Bulgarian Split Squat':    2.00,  # ~50 kg per hand
    'Leg Extension':            2.50,  # ~40 kg
    'Leg Curl':                 2.80,  # ~35 kg
    'Calf Raise':               1.80,  # ~55 kg
    'Romanian Deadlift':        0.75,  # ~130 kg
    'Hack Squat':               0.55,  # ~180 kg machine
    'Hip Thrust':               0.65,  # ~150 kg
    'Sumo Deadlift':            0.60,  # ~170 kg
    'Goblet Squat':             2.50,  # ~40 kg
    'Adductor Machine':         2.00,
    'Abductor Machine':         2.00,
    'Good Morning':             1.50,  # ~65 kg
    'Seated Calf Raise':        2.50,
    'Standing Calf Raise':      1.80,
    'Single Leg Deadlift':      2.50,  # ~40 kg per hand
    'Box Squat':                0.80,
    'Zercher Squat':            0.90,
    'Reverse Lunge':            2.00,
    'Smith Machine Squat':      0.75,
    'Seated Leg Curl':          2.80,
    'Lying Leg Curl':           2.80,
    'Smith Machine Calf Raise': 1.60,
    'Hack Squat (Reverse)':     0.60,
    'Belt Squat':               0.65,
    'Leg Extension (Single Leg)': 4.00,
    'Lying Leg Curl (Single Leg)': 4.50,
    'Seated Calf Raise (Machine)': 2.50,
    'Donkey Calf Raise':        1.80,
    'Trap Bar Deadlift':        0.60,
    'Sled Push':                0.50,

    # SHOULDERS — weighted
    'Overhead Press':           1.25,  # ~80 kg
    'Seated Dumbbell Press':    2.20,  # ~45 kg total
    'Lateral Raise':            5.00,  # ~20 kg
    'Front Raise':              4.50,  # ~22 kg
    'Reverse Fly':              5.00,  # ~20 kg
    'Arnold Press':             2.50,  # ~40 kg total
    'Upright Row':              1.80,  # ~55 kg
    'Cable Lateral Raise':      5.50,  # ~18 kg
    'Machine Shoulder Press':   1.40,  # ~70 kg
    'Face Pull':                4.00,  # ~25 kg
    'Reverse Pec Deck':         3.50,
    'Z Press':                  1.50,  # ~65 kg
    'Behind The Neck Press':    1.40,
    'Cable Lateral Raise (Behind Body)': 5.50,
    'Machine Reverse Fly':      3.50,

    # ARMS — weighted
    'Barbell Curl':             2.50,  # ~40 kg
    'Dumbbell Curl':            4.00,  # ~25 kg total
    'Hammer Curl':              3.50,  # ~28 kg total
    'Tricep Extension':         3.50,  # ~28 kg
    'Skullcrusher':             2.50,  # ~40 kg
    'Preacher Curl':            3.00,  # ~33 kg
    'Concentration Curl':       5.00,  # ~20 kg
    'Cable Curl':               3.50,
    'Tricep Kickback':          5.50,  # ~18 kg
    'Close Grip Bench Press':   1.10,  # ~90 kg
    'Reverse Curl':             3.50,
    'Wrist Curl':               6.00,  # ~16 kg
    'Overhead Tricep Extension':4.00,
    'Rope Tricep Pushdown':     3.50,
    'EZ Bar Skullcrusher':      2.80,
    'Machine Preacher Curl':    3.00,
    'Preacher Curl (Machine)':  3.00,
    'Overhead Cable Extension': 3.50,
    'Cable Kickback':           5.50,

    # CORE — weighted
    'Cable Crunch':             3.00,
    'Cable Woodchopper':        3.50,

    # FULL BODY — weighted
    'Kettlebell Swing':         2.00,  # ~50 kg
    'Farmer Walk':              1.20,  # ~80 kg per hand
    'Turkish Get Up':           3.50,  # ~28 kg

    # CARDIO — weighted (where applicable)
    'Cycling':                  2.00,
    'Rowing Machine':           2.00,
}

# ── Bodyweight exercise ratios ───────────────────────────────────────────────
# Anchor: Pull-up = 1.0 (full bodyweight)
BW_RATIOS = {
    # CHEST bodyweight
    'Push Up':                  0.65,
    'Dips':                     0.85,
    'Deficit Push Up':          0.70,
    'Archer Push Up':           1.10,
    'Pseudo Planche Push Up':   1.00,
    'Clapping Push Up':         0.80,
    'Spiderman Push Up':        0.70,
    'Typewriter Push Up':       1.05,
    'Ring Push Up':             0.80,
    'Hindu Push Up':            0.70,
    'Iron Cross':               4.00,  # elite rings
    'Assisted Dips':            0.45,  # machine assisted

    # BACK bodyweight
    'Pull Up':                  1.00,  # anchor
    'Chin Up':                  0.95,
    'Inverted Row':             0.55,
    'L-Sit Pull Up':            1.20,
    'Commando Pull Up':         1.10,
    'Archer Pull Up':           1.40,
    'One Arm Pull Up Negative': 1.80,
    'Wide Grip Pull Up':        1.05,
    'Close Grip Pull Up':       0.95,
    'Behind the Neck Pull Up':  1.10,
    'Typewriter Pull Up':       1.30,
    'Explosive Pull Up':        1.15,
    'Hyperextension':           0.45,
    'Assisted Pull Up':         0.50,  # machine assisted
    'Victorian Cross':          4.00,  # elite rings

    # ARMS bodyweight
    'Push Up Diamond':          0.75,
    'Tricep Dip':               0.80,
    'Korean Dips':              0.90,
    'Ring Dips':                1.00,
    'L-Sit Dips':               1.10,
    'Bulgarian Ring Dips':      1.30,
    'Tiger Bend Push Up':       1.20,
    'Impossible Dip':           1.50,
    'Hefesto':                  1.60,
    'Pelican Curl':             1.30,
    'Ring Tricep Extension':    0.70,
    'Ring Bicep Curl':          0.65,

    # SHOULDERS bodyweight
    'Pike Push Up':             0.75,
    'Planche Lean':             1.20,
    'Pseudo Planche Lean':      1.00,
    'Tuck Planche':             2.50,
    'Advanced Tuck Planche':    3.00,
    'Straddle Planche':         3.80,
    'Planche Push Up Negatives':3.20,
    'Handstand Hold':           1.00,
    'Handstand Push Up (Wall)': 1.10,
    'Handstand Push Up (Freestanding)': 1.40,
    'Handstand Walk':           1.20,
    'One Arm Handstand':        2.00,
    'Maltese Lean':             3.50,

    # LEGS bodyweight
    'Lunge':                    0.55,
    'Walking Lunge':            0.55,
    'Glute Bridge':             0.40,
    'Pistol Squat':             1.20,
    'Sissy Squat':              0.70,
    'Step Up':                  0.50,
    'Nordic Hamstring Curl':    1.10,
    'Shrimp Squat':             1.00,
    'Cossack Squat':            0.65,
    'Jumping Lunges':           0.60,

    # CORE bodyweight
    'Plank':                    0.35,
    'Crunch':                   0.30,
    'Leg Raise':                0.40,
    'Russian Twist':            0.35,
    'Mountain Climber':         0.35,
    'Ab Wheel Rollout':         0.70,
    'Hanging Leg Raise':        0.55,
    'Side Plank':               0.30,
    'Hollow Body Hold':         0.40,
    'Front Lever Raise':        1.50,
    'Back Lever Raise':         1.40,
    'Tuck Front Lever':         1.20,
    'Advanced Tuck Front Lever':1.60,
    'Half Lay Front Lever':     2.00,
    'Tuck Back Lever':          1.10,
    'Advanced Tuck Back Lever': 1.50,
    'Half Lay Back Lever':      1.80,
    'Dragon Flag':              1.30,
    'L-Sit':                    0.60,
    'Human Flag':               4.00,
    'Clutch Flag':              3.50,
    'Neck Bridge':              0.40,
    'Superman':                 0.30,
    'Back Extension':           0.45,

    # FULL BODY bodyweight
    'Muscle Up (Bar)':          2.00,
    'Muscle Up (Rings)':        2.30,
    'Calisthenics Burpee':      0.50,
    'Glute Ham Raise':          0.80,

    # CARDIO bodyweight
    'Running':                  0.30,
    'Running (Treadmill)':      0.30,
    'Jump Rope':                0.30,
}


def apply_scoring(exercise_dict: dict) -> dict:
    """Apply difficulty_factor and bw_ratio to an exercise dict based on its name."""
    name = exercise_dict.get('name', '')
    is_bw = exercise_dict.get('is_bodyweight', False)

    if is_bw and name in BW_RATIOS:
        exercise_dict['bw_ratio'] = BW_RATIOS[name]
    elif not is_bw and name in DIFFICULTY_FACTORS:
        exercise_dict['difficulty_factor'] = DIFFICULTY_FACTORS[name]
    else:
        # Defaults
        if is_bw:
            exercise_dict.setdefault('bw_ratio', 0.65)
        else:
            exercise_dict.setdefault('difficulty_factor', 1.0)

    return exercise_dict
