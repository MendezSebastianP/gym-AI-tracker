# Plan for Handling Assisted Exercises and Drop Sets

## 1. Difficulty in Assisted & Easiest Variations
Currently, the app uses a Normalised Strength Score (NSS) through `bw_ratio` (for bodyweight exercises) and `difficulty_factor` (for weighted exercises). 

- **Normal Pull-Ups/Dips**: A standard Pull-Up has a `bw_ratio` of 1.0 (meaning 100% of your body weight is moved). A standard Dip has a `bw_ratio` of 0.85 (moving slightly less body mass relative to the fulcrum).
- **Assisted Variations**: Assisted Pull-Ups and Assisted Dips have pre-defined `bw_ratio`s of 0.50 and 0.45, respectively, assuming they are about half the difficulty of an unassisted rep. 
- **The "Assistance Weight" Problem**: On assisted machines, adding weight means adding *assistance* (making the exercise easier). However, standard fitness trackers calculate volume as `Weight × Reps`. If you log "20kg" for an Assisted Pull-Up, standard logic inherently views that as *more work* than "10kg", which is backwards. 
- **Solution Strategy**: We need to treat "Assisted" exercises uniquely in our statistics engine. If an exercise is tagged as "Assisted Machine", the logged weight should be subtracted from an assumed body weight, or statistically inverted, so that logging 0kg (0 assistance) generates a higher score than logging 20kg (20kg of assistance). 

## 2. Handling Mixed Sets (e.g., 2 Pull Ups + 6 Assisted Pull Ups)
When you combine unassisted reps with assisted reps in the same continuous series (a drop set), keeping the UI clean is paramount.

**Recommended Approach:**
Log the entire series under a single exercise block (e.g., `Assisted Pull Up`) as multiple sets, or as a single set with variable weights:
* **Option A (Drop Sets within one exercise)**: Since we established `0kg` represents "0kg of assistance" (equivalent to a normal pull-up), you can map the transition in the same block.
   - Set 1: 2 reps at 0kg (meaning pure unassisted pull-ups)
   - Set 2: 6 reps at 20kg (the assisted portion)
   *This keeps the routine clean without adding a separate "Pull Up" exercise card just for those 2 reps.*
* **Option B (Note/Tagging system)**: Allow users to log `8 reps` on Pull-Ups but add a tag or note like `Drop set: 6 reps assisted`. While cleaner visually, this makes the back-end statistics less accurate regarding the real volume lifted.

**Developer Conclusion:** Option A is the optimal way moving forward. We will rely on logging "0kg" for the unassisted portion and "20kg" for the assisted portion within the exact same exercise card (Assisted Pull Up) to prevent interface clutter.

## 3. The Issue of Statistics Inflation with Option A

While "Option A" keeps the UI extremely clean, it introduces a mathematical quirk that can **inflate your statistics** if we don't handle the internal difficulty multipliers carefully.

Let's look at a concrete example using our `BW_RATIOS`:
- A normal **Pull Up** has a `bw_ratio` of **1.00** (Full difficulty).
- An **Assisted Pull Up** has a `bw_ratio` of **0.50** (Half difficulty relative to a full pull up).

By logging the *entire* drop set under the "Assisted Pull Up" card (Option A), the system will apply the `0.50` multiplier to *all* reps in that card, even the reps you logged with 0kg assistance (which are technically full pull-ups).

### Example Scenario
Assume a user weighs 80kg. The goal is to calculate the **Volume Score**.

**Scenario 1: True Logging (Separated Cards)**
- Card 1: **Pull Up** (bw_ratio: 1.0)
  - 4 reps
  - Formula: (80kg * 1.0) * 4 reps = **320 points**
- **Total Score for 4 pure pull ups: 320**

**Scenario 2: Drop Set via Option A**
- Card 1: **Assisted Pull Up** (bw_ratio: 0.50)
  - Set 1: 2 reps at 0kg (Pure pull ups)
  - Set 2: 6 reps at 20kg (Assisted)
- *The Math (if unadjusted):*
  - Set 1: Since it's under "Assisted Pull Up", the system incorrectly applies the 0.50 ratio. (80kg - 0kg assistance = 80kg) * 0.50 * 2 reps = **80 points** (it robbed the user of 80 points because it degraded the pull-up!).
  - Set 2: (80kg - 20kg assistance = 60kg) * 0.50 * 6 reps = **180 points**.
- **Total Score for 2 normal + 6 assisted: 260**

**Wait, where is the inflation?**
The inflation actually happens in the reverse scenario if the user chooses to log the entire drop-set under the **Unassisted Pull Up** card.
If the user added a normal "Pull Up" card and logged:
- Set 1: 2 reps @ 0kg (Pure pull up)
- Set 2: 6 reps @ -20kg (Assisted)
Because the "Pull Up" card has a `1.0` multiplier, the math becomes:
- Set 1: 80 * 1.0 * 2 = 160 points.
- Set 2: (80 - 20 = 60) * 1.0 * 6 = 360 points.
- **Total Score: 520 points!** 

The user just generated 520 points using assistance, vastly out-scoring the person who did 4 pure, extremely difficult pull-ups (320 points).

### The Fix
To prevent this massive statistical inflation (or unfair deflation), the back-end statistics processor must **dynamically shift the `bw_ratio` within the dataset if assistance is detected.**

1. If an exercise is "Assisted Pull Up" but logged at **0kg assistance**, the processor must temporarily override the `bw_ratio` from `0.50` to `1.0` (matching a normal pull-up) for that specific set.
2. If an exercise is a normal "Pull Up" but logged with **negative weight or band assistance**, the processor must dynamically drop the `bw_ratio` proportionally depending on the level of assistance.

This ensures option A remains visually clean for the user in the app, but mathematically truthful in the background.
