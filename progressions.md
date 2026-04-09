# Progression System — Full Reference

## Overview

The progression system has two layers:

1. **Bodyweight chains** — ordered lists of exercises representing a skill ladder for a movement pattern. The engine checks whether you are ready to advance to the next exercise.
2. **Algorithmic engine** — rule-based analysis that runs per-exercise on your session history and produces one of seven suggestion types: `weight_increase`, `rep_increase`, `deload`, `exercise_swap`, `bw_progression`, `cardio_increase`, or `plateau_warning`.

Source files: [progression_chains.py](backend/app/progression_chains.py), [progression_engine.py](backend/app/progression_engine.py).

---

## How a Suggestion Is Triggered

The main entry point is `analyze_exercise_progression()`. It routes each exercise to one of three analysers based on `exercise.type` and `exercise.is_bodyweight`.

```
exercise.type == "cardio"     -> _analyze_cardio()
exercise.is_bodyweight == true -> _analyze_bodyweight()
else                          -> _analyze_strength()
```

History is always fetched from the last **10 completed sessions** for that exact `(user_id, exercise_id, routine_id)` combination.

---

### Bodyweight chain analyser (`_analyze_bodyweight`)

1. Looks up the exercise in the `exercise_progressions` DB table (seeded from `CHAINS`).
2. Reads its advancement criteria from the chain: `target_reps`, `target_sets`. The engine overrides `sessions_to_advance` to **2** (hardcoded) regardless of the DB value.
3. Walks backwards through history (newest first) and counts **consecutive sessions** where every set hit `>= target_reps` AND the total set count was `>= target_sets`.
4. **Chain advancement** (`bw_progression`): `consecutive_count >= 2` -> suggest next exercise in chain with its starting sets/reps.
5. **Rep increase** (`rep_increase`): if the user's avg reps are below `target_reps` (and at least 1 session exists), suggest aiming for `ceil(avg_reps) + 1` next session (capped at `target_reps`).
6. **Plateau** (`exercise_swap`): if 4+ consecutive sessions are within +/-1 rep of the current average -> suggest swapping.
7. **Pre-plateau warning** (`plateau_warning`): if 2-3 consecutive stagnant sessions -> warn the user to push for one more rep before a full plateau triggers.
8. **Not in chain**: if the exercise is bodyweight but has no chain entry, falls back to `_analyze_strength()`.

Priority order: chain advancement > rep increase > plateau swap > pre-plateau warning.

---

### Strength analyser (`_analyze_strength`)

Rules are evaluated **in priority order** — first match wins:

#### 1. Double progression
- Counts consecutive sessions (newest first) where **all sets hit `>= rep_high`** of the routine range AND set count `>= target_sets`, **at the same or higher weight** as the current session.
- Threshold by experience level:
  - Beginner (level 1-3): **2 sessions**
  - Intermediate (level 4-7): **3 sessions**
  - Advanced (level 8-10): **3 sessions**
- Trigger -> suggest `current_weight + increment`, reset reps to `rep_low`.
- Weight increments by equipment/muscle:
  - Barbell / Machine / Cable / default: **2.5 kg**
  - Dumbbell: **2.0 kg**
  - Isolation muscles (Biceps, Triceps, Forearms, Calves, Rear/Lateral Deltoids): **1.0 kg**

#### 2. Plateau detection
- If the last **4+ consecutive sessions** (up to 6) are within +/-0.01 kg of current weight AND within +/-1 rep of current avg -> suggest `exercise_swap`.
- The engine tries to find a substitute with the same primary muscle, preferring same equipment and similar difficulty.

#### 3. Pre-plateau warning
- If 2-3 consecutive stagnant sessions (same weight +/-0.01kg, same reps +/-1) -> suggest `plateau_warning`.
- Encourages the user to add one more rep or try the next weight increment before a full plateau triggers.

---

### Cardio analyser (`_analyze_cardio`)

Requires at least **3 sessions**.

- **Distance-based**: if the last 3 sessions are all within 10% of the average distance -> suggest **+4% distance**.
- **Duration-based**: if no distance data but last 3 sessions are within 10% of avg duration -> suggest **+2 minutes**.

---

## The 12 Chains

Each chain is `(exercise_name, target_reps, target_sets, sessions_needed, starting_sets, starting_reps)`. All entries currently share the same DB defaults: **10 reps, 3 sets, 3 sessions** (but engine overrides to **2 sessions** for advancement).

For each chain below: the **current** table, a difficulty-order analysis, and a **proposed** reordering. Exercises marked with `*` exist in the DB seed; exercises marked with `[MISSING]` would need to be added.

---

### 1. `horizontal_push_standard` — Horizontal Push (Standard)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Wall Push Up | 10 | 3x4-6 | * |
| 1 | Incline Push Up | 10 | 3x4-6 | * |
| 2 | Knee Push Up | 10 | 3x4-6 | * |
| 3 | Push Up | 10 | 3x4-6 | * |
| 4 | Wide Push Up | 10 | 3x4-6 | * |
| 5 | Push Up Diamond | 10 | 3x3-5 | * |
| 6 | Pseudo Planche Push Up | 10 | 3x3-5 | * |
| 7 | Archer Push Up | 10 | 3x3-5 | * |
| 8 | One Arm Push Up | 8 | 3x2-4 | * |

**Issues:**
- **Wide Push Up (pos 4)** is roughly the same difficulty as a regular Push Up — it shifts emphasis to chest but isn't harder. Wasted step.
- **Diamond Push Up (pos 5)** is close to regular push up difficulty. Narrower grip increases tricep demand but isn't a meaningful progression gate. Remove.
- **Pseudo Planche Push Up (pos 6) is harder than Archer Push Up (pos 7)**. PPPU requires extreme forward lean loading the shoulders at a mechanical disadvantage. Archer distributes weight unevenly but the assisting arm helps. The order should be swapped.
- Chain ends at One Arm Push Up — no exercises for advanced/elite users who pass OAP. Missing the entire planche push-up progression which is the endgame of horizontal push.
- Missing intermediate steps between Push Up and Archer: Ring Push Up (stability challenge), Sphinx Push Up (tricep/shoulder intensive), and Clapping Push Up (explosive power) all exist in DB and bridge the gap.

Reference ranking (YouTube calisthenics tier list):
Level 1: Wall -> Incline -> Knee. Level 2: Regular -> Diamond. Level 3: Decline -> Ring -> Spiderman -> Sphinx. Level 4: Archer -> Clapping -> Pseudo Planche. Level 5: One Arm -> Tiger Bend -> Adv Tuck Planche PU -> Planche PU.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Wall Push Up | 10 | 3x4-6 | * |
| 1 | Incline Push Up | 10 | 3x4-6 | * |
| 2 | Knee Push Up | 10 | 3x4-6 | * |
| 3 | Push Up | 10 | 3x4-6 | * |
| 4 | Deficit Push Up | 10 | 3x4-6 | * |
| 5 | Ring Push Up | 10 | 3x4-6 | * |
| 6 | Archer Push Up | 8 | 3x3-5 | * |
| 7 | Clapping Push Up | 8 | 3x3-5 | * |
| 8 | Pseudo Planche Push Up | 8 | 3x3-5 | * |
| 9 | One Arm Push Up | 6 | 3x2-4 | * |
| 10 | Advanced Tuck Planche Push Up | 5 | 3x1-3 | * |
| 11 | Planche Push Up Negatives | 5 | 3x1-3 | * |
| 12 | Planche Push Up | 3 | 3x1-3 | * |

**TODO:**
- [ ] Remove Wide Push Up and Diamond Push Up from chain
- [ ] Insert Deficit Push Up, Ring Push Up as intermediate steps (pos 4-5)
- [ ] Swap Archer (pos 6) before Pseudo Planche (pos 8), insert Clapping Push Up between them (pos 7)
- [ ] Add 3 post-OAP exercises: Advanced Tuck Planche Push Up, Planche Push Up Negatives, Planche Push Up
- [ ] Adjust target reps: Archer/Clapping/PPPU at 8, OAP at 6, Adv Tuck/Negatives at 5, Planche PU at 3

---

### 2. `horizontal_push_decline` — Horizontal Push (Decline / Overhead)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Decline Push Up | 10 | 3x4-6 | * |
| 1 | Decline Pike Push Up | 10 | 3x4-6 | * |
| 2 | Pike Push Up | 10 | 3x4-6 | * |
| 3 | Handstand Push Up (Wall) | 10 | 3x3-5 | * |
| 4 | Handstand Push Up (Freestanding) | 8 | 3x2-4 | * |

**Issues:**
- **The first three exercises are in reverse difficulty order.** Pike Push Up (hips raised, feet flat) is the easiest overhead-loading movement. Decline Push Up loads the shoulders more than a regular push up but less than pike. Decline Pike Push Up (feet elevated + pike position) is the hardest of the three. Current order: Decline -> Decline Pike -> Pike. Correct order: Pike -> Decline -> Decline Pike.
- There's a huge gap between Decline Pike Push Up and Wall HSPU. Half Range Handstand Push Up exists in the DB and fills that gap.
- Pike Push Up (Knees) also exists and is easier than Pike Push Up — good regression for people who can't pike yet.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Pike Push Up (Knees) | 10 | 3x4-6 | * |
| 1 | Pike Push Up | 10 | 3x4-6 | * |
| 2 | Decline Push Up | 10 | 3x4-6 | * |
| 3 | Decline Pike Push Up | 10 | 3x4-6 | * |
| 4 | Half Range Handstand Push Up | 10 | 3x3-5 | * |
| 5 | Handstand Push Up (Wall) | 8 | 3x3-5 | * |
| 6 | Handstand Push Up (Freestanding) | 6 | 3x2-4 | * |

**TODO:**
- [ ] Reorder: Pike (Knees) -> Pike -> Decline -> Decline Pike -> Half Range HSPU -> Wall HSPU -> Freestanding HSPU
- [ ] Add Pike Push Up (Knees) at position 0
- [ ] Add Half Range Handstand Push Up between Decline Pike and Wall HSPU
- [ ] Lower target reps for Wall HSPU to 8 and Freestanding to 6

---

### 3. `vertical_push_dip` — Vertical Push (Dips)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Bench Dips | 10 | 3x4-6 | * |
| 1 | Negative Dip | 10 | 3x4-6 | * |
| 2 | Dips | 10 | 3x4-6 | * |
| 3 | Ring Dips | 10 | 3x4-6 | * |

**Issues:**
- Order is correct (Bench -> Negative -> Full -> Ring).
- Missing exercises in the DB that could extend the chain: L-Sit Dips, Straight Bar Dips, Korean Dips, Russian Dips, Bulgarian Ring Dips, and Impossible Dip are all in the DB.
- The chain ends too early for advanced users.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Bench Dips | 10 | 3x4-6 | * |
| 1 | Negative Dip | 10 | 3x4-6 | * |
| 2 | Dips | 10 | 3x4-6 | * |
| 3 | Straight Bar Dips | 10 | 3x3-5 | * |
| 4 | Ring Dips | 10 | 3x3-5 | * |
| 5 | Bulgarian Ring Dips | 6 | 3x2-4 | * |
| 6 | Impossible Dip | 5 | 3x1-3 | * |

**TODO:**
- [ ] Insert Straight Bar Dips at position 3
- [ ] Move Ring Dips to position 4
- [ ] Add Bulgarian Ring Dips and Impossible Dip to extend the chain
- [ ] Lower target reps for advanced entries (Bulgarian 6, Impossible 5)

---

### 4. `pull_vertical` — Pull (Vertical)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Scapular Pull Up | 10 | 3x4-6 | * |
| 1 | Negative Pull Up | 10 | 3x4-6 | * |
| 2 | Band Assisted Pull Up | 10 | 3x4-6 | * |
| 3 | Pull Up | 10 | 3x4-6 | * |
| 4 | L-Sit Pull Up | 10 | 3x3-5 | * |
| 5 | Muscle Up (Bar) | 8 | 3x2-3 | * |

**Issues:**
- Scapular -> Negative -> Band Assisted -> Pull Up is solid. However Chin Up (in DB) is easier than Pull Up for most people due to bicep involvement and shorter moment arm. It should come before Pull Up.
- **L-Sit Pull Up to Muscle Up is a massive gap.** A Muscle Up is not just a harder pull-up — it requires explosive power and a pressing transition through the top. Intermediate steps exist in the DB: Close Grip Pull Up, Wide Grip Pull Up, Explosive Pull Up, Typewriter Pull Up, Around the World Pull Up, and Commando Pull Up. The right bridge is Explosive Pull Up (trains the power needed for the transition) and Band Assisted Muscle Up.
- After Muscle Up (Bar), Muscle Up (Rings) exists in the DB — harder due to ring instability.
- One Arm Pull Up Negative and One Arm Pull Up exist in DB for extreme end.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Scapular Pull Up | 10 | 3x4-6 | * |
| 1 | Negative Pull Up | 10 | 3x4-6 | * |
| 2 | Band Assisted Pull Up | 10 | 3x4-6 | * |
| 3 | Chin Up | 10 | 3x4-6 | * |
| 4 | Pull Up | 10 | 3x4-6 | * |
| 5 | Wide Grip Pull Up | 10 | 3x3-5 | * |
| 6 | L-Sit Pull Up | 10 | 3x3-5 | * |
| 7 | Typewriter Pull Up | 8 | 3x3-5 | * |
| 8 | Explosive Pull Up | 8 | 3x3-5 | * |
| 9 | Band Assisted Muscle Up | 8 | 3x2-4 | * |
| 10 | Muscle Up (Bar) | 6 | 3x2-3 | * |
| 11 | Muscle Up (Rings) | 5 | 3x1-3 | * |

**TODO:**
- [ ] Insert Chin Up at position 3 (before Pull Up)
- [ ] Insert Wide Grip Pull Up at position 5
- [ ] Insert Typewriter Pull Up at position 7
- [ ] Insert Explosive Pull Up at position 8 (trains power for muscle-up transition)
- [ ] Insert Band Assisted Muscle Up at position 9
- [ ] Add Muscle Up (Rings) at the end
- [ ] Lower target reps for Typewriter/Explosive to 8, Muscle Up (Bar) to 6, Rings to 5

---

### 5. `pull_horizontal` — Pull (Horizontal / Rows)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Ring Row | 10 | 3x4-6 | * |
| 1 | Inverted Row | 10 | 3x4-6 | * |
| 2 | Archer Pull Up | 10 | 3x3-5 | * |

**Issues:**
- **Archer Pull Up doesn't belong here.** It's a vertical pulling movement (hanging from a bar, pulling up), not a horizontal row. It belongs in `pull_vertical`.
- The chain has only 3 exercises and ends abruptly. Front lever progressions are the natural horizontal pull endgame and exist in the DB: Tuck Front Lever, Advanced Tuck Front Lever, Half Lay Front Lever, Front Lever Pull Up, Front Lever Raise.
- Ring Row -> Inverted Row order is debatable. Ring Row is harder due to instability. Should be swapped.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Inverted Row | 10 | 3x4-6 | * |
| 1 | Ring Row | 10 | 3x4-6 | * |
| 2 | Tuck Front Lever | 10 | 3x4-6 | * |
| 3 | Advanced Tuck Front Lever | 10 | 3x3-5 | * |
| 4 | Half Lay Front Lever | 8 | 3x3-5 | * |
| 5 | Front Lever Hold | 6 | 3x2-4 | [MISSING] |
| 6 | Front Lever Pull Up | 5 | 3x2-3 | * |
| 7 | Front Lever Raise | 5 | 3x2-3 | * |

**TODO:**
- [ ] Swap Ring Row and Inverted Row (Inverted Row is easier)
- [ ] Remove Archer Pull Up (move it to pull_vertical chain if desired)
- [ ] Add Tuck Front Lever, Advanced Tuck Front Lever, Half Lay Front Lever, Front Lever Pull Up, Front Lever Raise
- [ ] **Add "Front Lever Hold" exercise to seed_data.py** (muscle: Back, secondary: Abdominals, is_bodyweight, equipment: None (Bodyweight))
- [ ] Lower target reps for advanced entries

---

### 6. `squat` — Squat

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Jumping Squat | 10 | 3x4-6 | * |
| 1 | Cossack Squat | 10 | 3x4-6 | * |
| 2 | Lunge | 10 | 3x4-6 | * |
| 3 | Shrimp Squat | 10 | 3x3-5 | * |
| 4 | Assisted Pistol Squat | 10 | 3x3-5 | * |
| 5 | Pistol Squat | 8 | 3x2-4 | * |

**Issues — muscle analysis:**

Every exercise in a bodyweight squat chain should primarily target **Quadriceps** (the defining muscle of the squat pattern). Here's what's in the DB:

| Exercise | Primary Muscle | is_bodyweight | Equipment | Verdict |
|---|---|---|---|---|
| Jumping Squat | Quadriceps | yes | BW | Plyometric, not a regression |
| Cossack Squat | Quadriceps | yes | BW | Mobility-heavy, adductor-dependent |
| Shrimp Squat | Quadriceps | yes | BW | Good — pure quad single-leg |
| Box Pistol Squat | Quadriceps | yes | BW | Good — depth-limited pistol |
| Assisted Pistol Squat | Quadriceps | yes | BW | Good — support-limited pistol |
| Pistol Squat | Quadriceps | yes | BW | Good — the goal |
| Sissy Squat | Quadriceps | yes | BW | Good — pure quad isolation |
| **Lunge** | **Glutes** | yes | BW | **Wrong muscle — glute dominant** |
| **Bulgarian Split Squat** | **Glutes** | no | Dumbbell | **Wrong muscle + not bodyweight** |
| **Step Up** | **Glutes** | yes | Other | **Wrong muscle** |
| **Box Squat** | Quadriceps | no | Other | **Not bodyweight** |
| **Squat** | Quadriceps | no | Barbell | **Not bodyweight** |

**Problems with the current chain:**
- **Jumping Squat (pos 0)** is a plyometric — requires explosive power and good knee tracking. Wrong entry point for someone who can't squat.
- **Lunge (pos 2)** has Glutes as primary muscle — it's a hip-dominant stepping movement, not a squat progression. It doesn't build toward pistol squats.
- **Cossack Squat (pos 1)** is technically quad-primary but in practice it's an adductor/hip mobility exercise. The limiting factor is hip flexibility, not quad strength. Placing it before Lunge implies it's easier, but it requires deep lateral hip mobility most beginners don't have.
- **No basic bodyweight squat exists in the DB.** "Squat" is barbell, "Box Squat" is equipment:Other. A "Bodyweight Squat" needs to be added.

**The correct progression logic for a bodyweight squat chain:**
The movement pattern is bilateral squat -> unilateral squat -> full single-leg squat. Every step should be limited by **quad strength** (not hip mobility, not balance, not explosiveness). Each exercise reduces the base of support or increases the range of motion.

1. Bodyweight Squat (bilateral, full ROM, learn the pattern)
2. Cossack Squat (introduces weight shift to one leg, but both feet stay grounded)
3. Shrimp Squat (true single-leg, rear foot grabbed — quad-dominant, no balance component from the free leg)
4. Box Pistol Squat (single-leg to a box — limits depth, so quad demand is controlled)
5. Assisted Pistol Squat (full ROM single-leg, but with support to reduce balance/strength demand)
6. Pistol Squat (full single-leg, the endgame)
7. Sissy Squat (extreme knee-over-toe quad isolation — a different axis of difficulty, extends the chain)

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Bodyweight Squat | 10 | 3x6-8 | [MISSING] |
| 1 | Cossack Squat | 10 | 3x4-6 | * |
| 2 | Shrimp Squat | 8 | 3x3-5 | * |
| 3 | Box Pistol Squat | 8 | 3x3-5 | * |
| 4 | Assisted Pistol Squat | 8 | 3x3-5 | * |
| 5 | Pistol Squat | 6 | 3x2-4 | * |
| 6 | Sissy Squat | 8 | 3x3-5 | * |

**TODO:**
- [ ] **Add "Bodyweight Squat" exercise to seed_data.py** (muscle: Quadriceps, secondary: Glutes, is_bodyweight: true, equipment: None (Bodyweight))
- [ ] Remove Jumping Squat (plyometric, not a squat regression)
- [ ] Remove Lunge (Glutes primary, different movement pattern)
- [ ] Keep Cossack Squat at position 1 (quad-primary in DB, introduces weight shift)
- [ ] Lower target reps: Shrimp 8, Box Pistol 8, Assisted 8, Pistol 6, Sissy 8
- [ ] Add Sissy Squat at the end (pure quad isolation — extends chain beyond pistol)

---

### 7. `hinge` — Hinge

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Glute Bridge | 10 | 3x4-6 | * |
| 1 | Hyperextension | 10 | 3x4-6 | * |
| 2 | Nordic Hamstring Curl | 10 | 3x3-5 | * |

**Issues:**
- **Only 3 exercises with an enormous difficulty gap.** Going from Hyperextension to Nordic Hamstring Curl is one of the biggest jumps in any chain. NHCs generate extreme eccentric force on the hamstrings; most intermediates can't do a single full rep.
- **These exercises target different muscles.** Glute Bridge = glutes. Hyperextension = spinal erectors. NHC = hamstrings eccentrically. A good chain should have a consistent movement pattern.
- Hyperextension appears in both `hinge` and `core_lower_back` — duplicate.
- Hip Thrust (in DB), Good Morning (in DB x2), Glute Ham Raise (in DB), and Single Leg Deadlift (in DB) all exist and fill the gaps.

**Note on equipment:** Unlike the push/pull/squat chains which are pure bodyweight, the hinge pattern has very few bodyweight-only options. Some exercises below use bands or a machine, but they are the closest available to fill the difficulty gap. The alternative is a 3-exercise chain with a huge jump.

| Exercise | Primary Muscle | is_bodyweight | Equipment |
|---|---|---|---|
| Glute Bridge | Glutes | yes | BW |
| Band Hip Thrust | Glutes | yes | Bands |
| Hyperextension | Back | yes | Machine |
| Glute Ham Raise | Hamstrings | no | Machine |
| Nordic Hamstring Curl | Hamstrings | yes | BW |

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Glute Bridge | 10 | 3x6-8 | * |
| 1 | Band Hip Thrust | 10 | 3x4-6 | * |
| 2 | Hyperextension | 10 | 3x4-6 | * |
| 3 | Glute Ham Raise | 8 | 3x3-5 | * |
| 4 | Nordic Hamstring Curl | 6 | 3x2-4 | * |

**TODO:**
- [ ] Add Band Hip Thrust at position 1 (bodyweight + bands, Glutes primary)
- [ ] Keep Hyperextension at position 2
- [ ] Add Glute Ham Raise at position 3 (machine, bridges the gap to NHC)
- [ ] Lower NHC target reps to 6 (most people can't do 10 reps of these)
- [ ] Note: Hip Thrust (Barbell), Good Morning (Barbell), Single Leg Deadlift (Dumbbell) were removed from proposal — they are not bodyweight exercises

---

### 8. `core_anterior` — Core (Anterior)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Crunch | 10 | 3x6-8 | * |
| 1 | Plank | 10 | 3x4-6 | * |
| 2 | Hollow Body Hold | 10 | 3x4-6 | * |
| 3 | Ab Wheel Rollout | 10 | 3x4-6 | * |
| 4 | Dragon Flag | 8 | 3x2-4 | * |

**Issues:**
- **Crunch before Plank is backwards.** Plank is an anti-extension isometric that builds the foundational core stability needed for everything else. It should come first. Hollow Body Hold is a progression of the plank concept (anti-extension under hip flexion).
- **Crunch is the easiest exercise here, not the foundation.** Crunches are spinal flexion under low load. They don't build toward Dragon Flags.
- The logical progression is: anti-extension (Plank -> Hollow Body) -> dynamic flexion (Crunch -> Tuck Crunches) -> loaded extension (Ab Wheel -> Dragon Flag).
- Tuck Crunches (in DB) bridge the gap between Crunch and Ab Wheel Rollout.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Plank | 10 | 3x6-8 | * |
| 1 | Crunch | 10 | 3x6-8 | * |
| 2 | Hollow Body Hold | 10 | 3x4-6 | * |
| 3 | Tuck Crunches | 10 | 3x4-6 | * |
| 4 | Ab Wheel Rollout | 10 | 3x4-6 | * |
| 5 | Dragon Flag | 6 | 3x2-4 | * |

**TODO:**
- [ ] Swap Plank to position 0, Crunch to position 1
- [ ] Add Tuck Crunches at position 3
- [ ] Lower Dragon Flag target reps to 6

---

### 9. `core_rotational` — Core (Rotational / Oblique)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Russian Twist | 10 | 3x6-8 | * |
| 1 | Side Plank | 10 | 3x4-6 | * |
| 2 | Bicycle Crunches | 10 | 3x6-8 | * |
| 3 | Windshield Wipers | 10 | 3x3-5 | * |

**Issues:**
- **Side Plank (pos 1) -> Bicycle Crunches (pos 2) steps backwards in difficulty.** A Side Plank hold is harder than Bicycle Crunches. Bicycle Crunches are a dynamic low-resistance movement; Side Plank is an isometric hold requiring lateral core stability under full body weight.
- Correct difficulty order: Russian Twist (low) -> Bicycle Crunches (low-medium) -> Side Plank (medium) -> Windshield Wipers (high).
- Cable Woodchopper (in DB) could be added as a weighted rotational option at the end.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Russian Twist | 10 | 3x6-8 | * |
| 1 | Bicycle Crunches | 10 | 3x6-8 | * |
| 2 | Side Plank | 10 | 3x4-6 | * |
| 3 | Windshield Wipers | 8 | 3x3-5 | * |

**TODO:**
- [ ] Swap Bicycle Crunches to position 1, Side Plank to position 2
- [ ] Lower Windshield Wipers target reps to 8

---

### 10. `core_hanging` — Core (Hanging)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Leg Raise | 10 | 3x6-8 | * |
| 1 | Hanging Leg Raise | 10 | 3x4-6 | * |
| 2 | Tuck L-Sit | 10 | 3x4-6 | * |
| 3 | L-Sit | 10 | 3x4-6 | * |
| 4 | V-Ups | 10 | 3x3-5 | * |

**Issues:**
- **V-Ups (pos 4) after L-Sit (pos 3) is backwards.** V-Ups are a supine dynamic movement (lying on the floor) that is significantly easier than a full L-Sit hold (isometric hold on parallettes/floor requiring hip flexor and core strength to maintain extended legs off the ground). The chain steps down in difficulty at the end.
- The chain mixes floor and hanging exercises inconsistently. Leg Raise (floor) -> Hanging Leg Raise (bar) -> Tuck L-Sit (parallettes) -> L-Sit (parallettes) is fine, but V-Ups go back to the floor.
- Straddle L-Sit (in DB) is a natural progression after L-Sit (wider stance = harder lever).
- L-Sit Flutter Kicks (in DB) and Seated Pike Leg Raises / Seated Straddle Leg Raises (in DB) could help.
- V-Up Hold (in DB) is an isometric version that's actually harder and makes more sense as a progression.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Leg Raise | 10 | 3x6-8 | * |
| 1 | V-Ups | 10 | 3x6-8 | * |
| 2 | Hanging Leg Raise | 10 | 3x4-6 | * |
| 3 | Tuck L-Sit | 10 | 3x4-6 | * |
| 4 | L-Sit | 8 | 3x3-5 | * |
| 5 | Straddle L-Sit | 6 | 3x2-4 | * |

**TODO:**
- [ ] Move V-Ups to position 1 (after Leg Raise, before Hanging Leg Raise)
- [ ] Add Straddle L-Sit at position 5
- [ ] Lower target reps: L-Sit to 8, Straddle L-Sit to 6

---

### 11. `core_lower_back` — Core (Lower Back)

**Current chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Hyperextension | 10 | 3x6-8 | * |
| 1 | Hollow Body Rocks | 10 | 3x6-8 | * |

**Issues:**
- **This is not a progression.** Hyperextension (spinal extension) and Hollow Body Rocks (anti-extension, core anterior) are antagonistic movements. Hollow Body Rocks belongs in `core_anterior`, not here.
- Only 2 exercises — too short to be a useful chain.
- Hyperextension already appears in the `hinge` chain — duplicate.
- Superman (in DB) is a floor-based lower back exercise that's easier than Hyperextension (which requires a bench/machine). Back Extension (in DB) is also available.
- Neck Bridge (in DB) targets posterior chain/cervical spine — too specialized for this chain.

**Proposed chain:**

| # | Exercise | Target | Starting | In DB? |
|---|---|---|---|---|
| 0 | Superman | 10 | 3x6-8 | * |
| 1 | Back Extension | 10 | 3x6-8 | * |
| 2 | Hyperextension | 10 | 3x4-6 | * |

**TODO:**
- [ ] Remove Hollow Body Rocks (belongs in core_anterior)
- [ ] Add Superman at position 0
- [ ] Add Back Extension at position 1
- [ ] Keep Hyperextension as the final position

---

## Critical Analysis

### Algorithm issues

**Purely consecutive streak**: The advancement counter breaks the moment one session misses the target. Five great sessions followed by one bad day resets the count to zero. For bodyweight skills this is especially punishing — fatigue, stress, and daily variation are real. A better rule would be "2 of the last 4 sessions at target," which is resilient to outliers.

**Same criteria for everything**: Every exercise in every chain uses 10 reps / 3 sets. A Crunch and a Tuck L-Sit are not the same. L-Sit progressions are isometric holds that take months to advance; treating them like crunches produces either constant wrong suggestions or permanent silence. Harder exercises (Pseudo Planche Push Up, Pistol Squat, Muscle Up) should have lower target reps (6-8).

**Isometric exercises are faked as reps**: Plank, Side Plank, Tuck L-Sit, L-Sit, and Hollow Body Hold are time-based. The code comment notes "reps = ~10s holds" for Plank but the engine has no special handling for this. Users naturally enter actual seconds or actual reps, making the threshold meaningless.

**History is per-routine**: `_get_session_history` filters by `routine_id`. If you restructure a routine or move an exercise to a new routine, all history is invisible to the engine. A user who has done 30 pull-up sessions still appears as a beginner to the engine if they're on a new routine. History should be per-exercise, per-user, regardless of routine.

**No regression suggestions**: The engine only looks forward. If a user is stalled far below the advancement target (averaging 3 reps when the target is 10) there is no suggestion to regress to the previous exercise in the chain, which might be the correct intervention.

**Plateau detection uses consecutive break too**: The plateau counter breaks on the first non-matching session, so one unusually good day hides the plateau.

**Bodyweight fallback is dangerous**: If an exercise is flagged `is_bodyweight` but has no chain entry, it falls into `_analyze_strength()`, which may generate a `weight_increase` suggestion for an exercise with `weight=0`. The math produces `0 + 2.5 = 2.5 kg` which makes sense only if the exercise is actually loaded.

---

## Master TODO — Chain Refactoring

Summary of all chain changes to implement:

- [ ] **Add missing exercises to seed_data.py**: "Bodyweight Squat" (Quadriceps/Glutes, BW), "Front Lever Hold" (Back/Abdominals, BW)
- [ ] **horizontal_push_standard**: Remove Wide + Diamond, add Deficit/Ring/Clapping as intermediates, swap Archer before PPPU, add Adv Tuck Planche PU/Planche PU Negatives/Planche PU after OAP
- [ ] **horizontal_push_decline**: Full reorder (Pike Knees -> Pike -> Decline -> Decline Pike -> Half Range HSPU -> Wall HSPU -> Freestanding HSPU)
- [ ] **vertical_push_dip**: Extend with Straight Bar Dips, Bulgarian Ring Dips, Impossible Dip
- [ ] **pull_vertical**: Add Chin Up, Wide Grip, Typewriter, Explosive Pull Up, Band Assisted Muscle Up, Muscle Up (Rings)
- [ ] **pull_horizontal**: Swap Ring/Inverted Row, remove Archer Pull Up, add full Front Lever progression + Front Lever Hold
- [ ] **squat**: Remove Jumping Squat + Lunge, add Bodyweight Squat [MISSING], keep Cossack, add Box Pistol Squat + Sissy Squat
- [ ] **hinge**: Add Band Hip Thrust + Glute Ham Raise; lower NHC target reps to 6
- [ ] **core_anterior**: Swap Plank/Crunch order, add Tuck Crunches, lower Dragon Flag target reps
- [ ] **core_rotational**: Swap Side Plank/Bicycle Crunches order
- [ ] **core_hanging**: Move V-Ups to position 1, add Straddle L-Sit at end, adjust target reps
- [ ] **core_lower_back**: Remove Hollow Body Rocks, add Superman and Back Extension
