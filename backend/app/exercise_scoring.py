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


# ── Exercise difficulty levels (1=beginner/machine, 10=elite) ──────────────
DIFFICULTY_LEVELS = {
    'Ab Wheel Rollout': 5,
    'Abductor Machine': 1,
    'Adductor Machine': 1,
    'Advanced Tuck Back Lever': 8,
    'Advanced Tuck Front Lever': 8,
    'Advanced Tuck Planche': 9,
    'Advanced Tuck Planche Push Up': 10,
    'Archer Pull Up': 7,
    'Archer Push Up': 8,
    'Arnold Press': 3,
    'Around the World Pull Up': 7,
    'Assisted Dips': 5,
    'Assisted Pistol Squat': 7,
    'Assisted Pull Up': 5,
    'Back Extension': 1,
    'Back Lever Raise': 9,
    'Band Assisted Back Lever': 8,
    'Band Assisted Chin Up': 5,
    'Band Assisted Dip': 5,
    'Band Assisted Front Lever': 8,
    'Band Assisted Muscle Up': 8,
    'Band Assisted Planche': 8,
    'Band Assisted Pull Up': 5,
    'Barbell Curl': 3,
    'Behind The Neck Press': 4,
    'Behind the Neck Pull Up': 7,
    'Belt Squat': 2,
    'Bench Dips': 5,
    'Bench Press': 4,
    'Bent Over Row': 5,
    'Bicycle Crunches': 2,
    'Box Pistol Squat': 7,
    'Box Squat': 2,
    'Bulgarian Ring Dips': 8,
    'Bulgarian Split Squat': 5,
    'Cable Crossover': 1,
    'Cable Crunch': 2,
    'Cable Curl': 1,
    'Cable Fly Low to High': 1,
    'Cable Kickback': 1,
    'Cable Lateral Raise': 1,
    'Cable Lateral Raise (Behind Body)': 1,
    'Cable T-Bar Row': 5,
    'Cable Woodchopper': 1,
    'Calf Jumps': 3,
    'Calf Raise': 3,
    'Calisthenics Burpee': 2,
    'Chest Fly': 3,
    'Chest Supported Row': 1,
    'Chin Up': 4,
    'Clapping Pull Up': 8,
    'Clapping Push Up': 2,
    'Close Grip Bench Press': 4,
    'Close Grip Pull Up': 6,
    'Clutch Flag': 10,
    'Commando Pull Up': 7,
    'Concentration Curl': 3,
    'Cossack Squat': 2,
    'Crunch': 2,
    'Cycling': 1,
    'Cycling (Outdoor)': 1,
    'Deadlift': 4,
    'Decline Bench Press': 4,
    'Decline Knee Push Up': 2,
    'Decline Machine Press': 1,
    'Decline Pike Push Up': 6,
    'Decline Push Up': 6,
    'Deficit Deadlift': 6,
    'Deficit Push Up': 2,
    'Diamond Knee Push Up': 2,
    'Dips': 3,
    'Dive Bomber Push Up': 2,
    'Donkey Calf Raise': 3,
    'Dragon Flag': 8,
    'Dumbbell Curl': 3,
    'Dumbbell Press': 3,
    'Dumbbell Pullover': 3,
    'Dumbbell Row': 3,
    'EZ Bar Skullcrusher': 4,
    'Elliptical': 1,
    'Explosive Pull Up': 8,
    'Face Pull': 1,
    'Farmer Walk': 3,
    'Fingertip Push Up': 2,
    'Frog Stand': 3,
    'Front Lever Pull Up': 9,
    'Front Lever Raise': 9,
    'Front Raise': 3,
    'Front Squat': 6,
    'Glute Bridge': 2,
    'Glute Ham Raise': 1,
    'Goblet Squat': 3,
    'Good Morning': 4,
    'Hack Squat': 2,
    'Hack Squat (Reverse)': 2,
    'Half Lay Back Lever': 8,
    'Half Lay Front Lever': 8,
    'Half Range Handstand Push Up': 9,
    'Hammer Curl': 3,
    'Handstand Hold': 3,
    'Handstand Push Up (Freestanding)': 9,
    'Handstand Push Up (Wall)': 9,
    'Handstand Walk': 3,
    'Hanging Leg Raise': 6,
    'Hefesto': 3,
    'High Row Machine': 1,
    'Hiking': 1,
    'Hindu Knee Push Up': 2,
    'Hindu Push Up': 6,
    'Hip Thrust': 5,
    'Hollow Body Hold': 3,
    'Hollow Body Rocks': 6,
    'Human Flag': 10,
    'Hyperextension': 3,
    'Impossible Dip': 10,
    'Incline Bench Press': 4,
    'Incline Dumbbell Fly': 3,
    'Incline Dumbbell Press': 3,
    'Incline Machine Press': 1,
    'Incline Push Up': 2,
    'Incline Smith Press': 1,
    'Inverted Row': 4,
    'Iron Cross': 10,
    'Isometric Chin Up Hold': 5,
    'Isometric Pull Up Hold': 5,
    'Jackknife Abs': 3,
    'Jackknife Pull Up': 6,
    'Judo Push Up': 2,
    'Jump Rope': 3,
    'Jumping Lunges': 3,
    'Jumping Squat': 2,
    'Kettlebell Swing': 2,
    'Knee Push Up': 2,
    'Knuckle Push Up': 2,
    'Korean Dips': 8,
    'L-Sit': 6,
    'L-Sit Dips': 8,
    'L-Sit Flutter Kicks': 6,
    'L-Sit Pull Up': 7,
    'Landmine Press': 4,
    'Lat Pulldown': 1,
    'Lat Pulldown (Close Grip)': 1,
    'Lat Pulldown (Reverse Grip)': 1,
    'Lateral Raise': 3,
    'Leg Curl': 1,
    'Leg Extension': 1,
    'Leg Extension (Single Leg)': 1,
    'Leg Press': 1,
    'Leg Raise': 2,
    'Lunge': 3,
    'Lunge Jumps': 3,
    'Lying Leg Curl': 1,
    'Lying Leg Curl (Single Leg)': 1,
    'Machine Assisted Chin Up': 5,
    'Machine Chest Press': 1,
    'Machine Preacher Curl': 1,
    'Machine Reverse Fly': 1,
    'Machine Shoulder Press': 1,
    'Maltese Lean': 10,
    'Meadows Row': 6,
    'Mixed Grip Pull Up': 7,
    'Mountain Climber': 2,
    'Muscle Up (Bar)': 8,
    'Muscle Up (Rings)': 8,
    'Neck Bridge': 3,
    'Negative Chin Up': 6,
    'Negative Dip': 6,
    'Negative Pull Up': 6,
    'Neutral Grip Pull Up': 6,
    'Nordic Hamstring Curl': 3,
    'One Arm Handstand': 10,
    'One Arm Pull Up': 10,
    'One Arm Pull Up Negative': 10,
    'One Arm Push Up': 8,
    'Overhead Cable Extension': 1,
    'Overhead Press': 6,
    'Overhead Tricep Extension': 3,
    'Pec Deck': 1,
    'Pec Deck Fly': 1,
    'Pelican Curl': 3,
    'Pendlay Row': 6,
    'Pike Push Up': 6,
    'Pike Push Up (Knees)': 6,
    'Pistol Squat': 7,
    'Planche Lean': 8,
    'Planche Lean Push Up': 8,
    'Planche Push Up': 10,
    'Planche Push Up Negatives': 10,
    'Plank': 2,
    'Preacher Curl': 1,
    'Preacher Curl (Machine)': 1,
    'Pseudo Planche Lean': 8,
    'Pseudo Planche Push Up': 10,
    'Pull Up': 4,
    'Push Up': 2,
    'Push Up Diamond': 2,
    'Reverse Curl': 3,
    'Reverse Fly': 3,
    'Reverse Lunge': 3,
    'Reverse Pec Deck': 1,
    'Ring Bicep Curl': 3,
    'Ring Dips': 7,
    'Ring Push Up': 2,
    'Ring Row': 4,
    'Ring Tricep Extension': 3,
    'Romanian Deadlift': 6,
    'Rope Tricep Pushdown': 1,
    'Rowing Machine': 1,
    'Running': 3,
    'Running (Treadmill)': 1,
    'Russian Dips': 8,
    'Russian Twist': 2,
    'Scapular Pull Up': 5,
    'Scapular Push Up': 2,
    'Seated Calf Raise': 3,
    'Seated Calf Raise (Machine)': 3,
    'Seated Dumbbell Press': 3,
    'Seated Leg Curl': 1,
    'Seated Pike Leg Raises': 2,
    'Seated Row': 1,
    'Seated Straddle Leg Raises': 2,
    'Shrimp Squat': 7,
    'Shrug': 4,
    'Side Plank': 2,
    'Single Leg Deadlift': 5,
    'Sissy Squat': 2,
    'Skater Jump': 3,
    'Skullcrusher': 4,
    'Sled Push': 2,
    'Smith Machine Calf Raise': 3,
    'Smith Machine Shrug': 1,
    'Smith Machine Squat': 2,
    'Snatch Grip Deadlift': 6,
    'Sphinx Push Up': 2,
    'Spiderman Push Up': 2,
    'Squat': 2,
    'Staggered Push Up': 2,
    'Stair Climber': 1,
    'Standing Calf Raise': 3,
    'Step Up': 3,
    'Sternum Pull Up': 5,
    'Straddle L-Sit': 7,
    'Straddle Planche': 9,
    'Straight Arm Pulldown': 1,
    'Straight Bar Dips': 7,
    'Sumo Deadlift': 6,
    'Superman': 2,
    'Swimming': 1,
    'T-Bar Row': 5,
    'T-Bar Row Machine': 5,
    'Tiger Bend Push Up': 2,
    'Towel Pull Up': 5,
    'Trap Bar Deadlift': 4,
    'Tricep Dip': 5,
    'Tricep Extension': 1,
    'Tricep Kickback': 3,
    'Tuck Back Lever': 8,
    'Tuck Crunches': 2,
    'Tuck Front Lever': 8,
    'Tuck Jump': 3,
    'Tuck L-Sit': 6,
    'Tuck Planche': 8,
    'Tuck V-Ups': 6,
    'Turkish Get Up': 2,
    'Typewriter Pull Up': 5,
    'Typewriter Push Up': 8,
    'Upright Row': 4,
    'V-Bar Pulldown': 1,
    'V-Up Hold': 7,
    'V-Ups': 5,
    'Victorian Cross': 3,
    'Walking': 1,
    'Walking Lunge': 3,
    'Wall Handstand Hold': 3,
    'Wall Push Up': 2,
    'Wall Walk': 3,
    'Wide Grip Pull Up': 5,
    'Wide Knee Push Up': 2,
    'Wide Push Up': 2,
    'Windshield Wipers': 8,
    'Wrist Curl': 3,
    'Yates Row': 4,
    'Z Press': 4,
    'Zercher Squat': 2,
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

    # Set difficulty_level (1-10 integer)
    exercise_dict['difficulty_level'] = DIFFICULTY_LEVELS.get(name, 1)
    return exercise_dict
