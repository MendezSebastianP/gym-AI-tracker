# Gym AI Tracker Algorithm & Statistics Deep Dive

This document details the mathematical algorithms and database logic powering the statistics and Gamification progression inside the Gym AI Tracker. The primary engine behind session-to-session progression is the **Normalised Strength Score (NSS)**.

---

## 1. Database Architecture & Context

The progression tracking relies on four primary database models:
1. **User**: Stores the user's logged `weight` (in kg). If the user hasn't supplied a weight, it defaults to $70\text{kg}$ (male), $60\text{kg}$ (female), or $65\text{kg}$ otherwise.
2. **Exercise**: Defines whether a movement is bodyweight (`is_bodyweight = True` or `False`), and sets fixed algorithmic multipliers:
   - `difficulty_factor` (for weighted exercises)
   - `bw_ratio` (for bodyweight exercises)
3. **Session**: A singular workout logging instance (`completed_at`). 
4. **Set**: Belongs to a Session and an Exercise. Logs `reps` and `weight_kg`.

---

## 2. Core Mathematical Algorithm: NSS (Normalised Strength Score)

Unlike basic apps that only track volume ($V = \text{weight} \times \text{reps}$), our tracker normalizes all effort into a universal **NSS** scale. A 10kg Bicep Curl should not be mathematically defeated by a 15kg Leg Press when you put in maximum effort.

The baseline of the NSS engine is an adaptation of the **Epley 1RM Formula**, capped at an effective repetition threshold of $R_{max} = 30$ to prevent cardio-set inflation.

For any given set, the estimated 1-Rep Max (1RM) equivalent is:
$$E_{1RM} = W_{eff} \cdot \left(1 + \frac{\min(R, 30)}{30}\right)$$

Where:
- $W_{eff}$ = The "Effective Weight" lifted.
- $R$ = Number of repetitions.

The total NSS for a single session is the sum of all set equivalent outputs:
$$NSS_{session} = \sum_{i=1}^{n} \left[ E_{1RM\_i} \cdot D_{i} \right]$$

Where:
- $D_i$ denotes the difficulty factor modifier for the specific exercise.

---

## 3. Handling Weighted vs. Bodyweight Sets

Calculating $W_{eff}$ and applying $D_i$ varies drastically between standardized free weights and bodyweight mechanisms.

### A. Standard Weighted Exercises (`is_bodyweight = False`)
Standard weighted exercises rely on the `difficulty_factor` ($D$). Exercises are mapped relative to the **Bench Press** anchor ($D = 1.0$). If an average lifter benches 100kg but overhead presses 80kg, the Overhead Press receives a difficulty factor of $\frac{100}{80}$ = $1.25$. 

For these exercises, the logged weight is the effective weight:
$$W_{eff} = W_{logged}$$

The final NSS output for a weighted set becomes:
$$NSS_{set} = W_{logged} \cdot \left(1 + \frac{R}{30}\right) \cdot D$$

**Example: 10 reps of Overhead Press at 50kg.**
- $D_{overhead} = 1.25$
- $NSS_{set} = 50 \cdot (1 + \frac{10}{30}) \cdot 1.25 = 50 \cdot 1.333 \cdot 1.25 \approx \mathbf{83.33}$

---

### B. Standard Bodyweight Exercises (`is_bodyweight = True`)
In bodyweight exercises, the logged weight is typically zero, or positive if using a weighted belt. The engine utilizes the `bw_ratio` ($\beta$), anchored against the standard **Pull Up** ($\beta = 1.0$, indicating $100\%$ of body mass is engaged). A Push Up only engages about $65\%$ of your mass ($\beta = 0.65$).

The effective weight integrates the user's body weight ($BW$):
$$W_{eff} = (BW \cdot \beta) + W_{logged}$$

And because the difficulty scaler is already built into $\beta$, the multiplier $D$ defaults to $1.0$:
$$NSS_{set} = W_{eff} \cdot \left(1 + \frac{R}{30}\right)$$

**Example: 80kg User doing 15 Push Ups wearing a 10kg vest.**
- $\beta = 0.65$
- $W_{eff} = (80 \cdot 0.65) + 10 = 52 + 10 = 62\text{kg}$
- $NSS_{set} = 62 \cdot (1 + \frac{15}{30}) = 62 \cdot 1.5 = \mathbf{93.00}$

---

## 4. The "Assistance" Variable Sub-Engine

In gamification apps, users frequently record drop-sets spanning unassisted and assisted states within the same exercise block (e.g., doing 2 pull ups, moving the machine pin, and doing 6 assisted pull ups). To ensure statistical truthfulness, the system dynamically mutates algorithmic parameters inside `stats.py`.

### Case 1: Assisted Machines (e.g. "Assisted Pull Up")
For exercises explicitly flagged as `Assisted`, the logged $W_{logged}$ represents **subtractive assistance**, breaking traditional logic. The base $\beta$ for an Assisted Pull Up is intentionally low (e.g. $0.50$).

The backend uses a conditional tensor:

1. **Pure Drop-set overriding (Logged weight = 0)**
   If you log $0\text{kg}$ on an Assisted machine, it dynamically overrides $\beta$ back to $1.0$ (or $0.85$ for dips). 
   $$W_{eff} = BW \cdot 1.0$$
   *(It treats the set exactly as an elite unassisted movement).*

2. **Standard Machine Use (Logged weight > 0)**
   The weight logged is subtracted from body mass.
   $$W_{eff} = \max(0, BW - W_{logged}) \cdot \beta$$

**Example: 80kg User logging a clean drop set under "Assisted Pull Up":**
*Set 1: 2 reps @ 0kg*
- Engine sees 0kg, overrides $\beta$ to 1.0.
- $W_{eff} = (80 \cdot 1.0) = 80$
- $NSS_{set1} = 80 \cdot (1 + \frac{2}{30}) = 80 \cdot 1.066 = \mathbf{85.33}$
 
*Set 2: 6 reps @ 20kg*
- Engine sees standard assistance (20kg subtracted). Standard Assisted Pull Up $\beta = 0.50$.
- $W_{eff} = (80 - 20) \cdot 0.50 = 60 \cdot 0.50 = 30$
- $NSS_{set2} = 30 \cdot (1 + \frac{6}{30}) = 30 \cdot 1.20 = \mathbf{36.00}$

**Drop Set Total NSS:** $85.33 + 36.00 = \mathbf{121.33}$

### Case 2: Banded Assistance on Strict Bodyweight
If a user logs $W_{logged} < 0$ on a standard Pure **Pull Up** ($\beta = 1.0$), they are denoting resistance band assist. The engine mathematically deducts the assist while retaining the pure $\beta$:
$$W_{eff} = \max(0, BW + W_{logged}) \cdot \beta$$
*Note: Since the input is negative, $BW + (-20) = BW - 20$.*

---

## 5. Historical Accuracy & Bodyweight Snapshotting

To guarantee the integrity of past statistics, the engine protects users against retroactive data inflation caused by bodyweight fluctuations.

If a user weighs **50kg** for two months, all of their previous bodyweight stats (e.g., Pull-Ups) are logged relative to that 50kg mass. If the user then bulks to **70kg** and updates their profile weight, calculating historical NSS purely off the live `User.weight` variable would artificially spike the scores of their old 50kg sessions, generating phantom progress.

**The Solution:**
To prevent this, the engine performs a **state snapshot**:
1. When a user creates a new `Session`, the database leaves `bodyweight_kg` empty.
2. The exact moment the user taps "Finish Workout", the backend looks at the user's active profile weight and **burns it permanently** into `Session.bodyweight_kg`.
3. During any future growth chart generation, `stats.py` ignores the live profile weight and forces the algorithm to use the snapshot:
   $$BW_{session} = \text{Session.bodyweight\_kg} \text{ (with fallback to User.weight)}$$

This ensures that a 50kg rep remains mathematically scored as a 50kg rep for the rest of time, regardless of how the user's body fluctuates.

---

## 6. Standard Volume & Experience (XP) Progression

While the NSS represents universal progress tracked in the "Growth Charts", basic total metrics are also calculated:

* **Lifetime Volume**: $\sum (W_{logged} \cdot R)$ for all $W_{logged} > 0$. Bodyweight is *not* included in lifetime volume stat numbers, as it would cause massive inflation vs traditional lifters.
* **Experience Points (XP)**: 
  * $+50$ Base Session Completion. (Double XP if the session dictates Day 2+ of a routine).
  * Rep PRs ($+10 \text{ XP}$) and Weight PRs ($+25 \text{ XP}$).
  * PR Multiplier evaluates previous session occurrences. Base $1.0\text{x}$, scalar $+0.05$ per session containing that exercise. Cap = $5.0\text{x}$.
  * Formula: $XP_{gained} = Base\_XP + (PR\_Count \cdot Target\_XP \cdot Multiplier)$.
