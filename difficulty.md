# Exercise Difficulty System (1-10)

This document outlines the heuristic scoring used by the Gym AI Tracker to classify exercises and prevent beginners from being assigned dangerous or demotivating movements.

## Evaluation Criteria
Exercises are scored from 1 to 10 based on:
1. **Stability Requirement**: Machines (1) vs. Free Weights (3) vs. Unilateral/Rings (5+).
2. **Strength Floor**: Is there a minimum strength required just to perform 1 rep? (e.g., Pull-ups require lifting 100% bodyweight, whereas Lat Pulldowns can be scaled to 5kg).
3. **Skill & Technique**: Requires coaching/proprioception (e.g., Olympic lifts, single-leg balancing).

## Baseline Scoring Matrix

### Level 1 (Universal / Scalable)
- All Pin-loaded Machines (Leg Press, Chest Press, Pec Deck)
- Cables (Lat Pulldown, Tricep Extension, Cable Curl)
- Basic Core (Crunch)

### Level 2 (Basic Free Weights & Bodyweight)
- Basic Bodyweight (Push Up, Glute Bridge, Plank)
- Un-intimidating Free Weights (Goblet Squat, Dumbbell Press, Bicep Curls)
- Simple Barbell Movements (Squat, Deadlift - Note: these have steep ceilings but low floors for 1 rep if taught)

### Level 3 (Intermediate Free Weights & Minor Skill)
- Bilateral Bodyweight with minor strength floors (Dips)
- Dumbbell Lunges, Bulgarian Split Squats
- Assisted variations of advanced movements (Assisted Pull-ups, Assisted Dips)

### Level 4 (High Strength Floor & Coordination)
- Pull Ups / Chin Ups (Requires moving 100% BW)
- Barbell Rows, T-Bar Rows, Overhead Press

### Level 5 (High Skill / Balance / Unilateral)
- Single Leg Deadlift
- Ring Dips
- Olympic Lifts (Power Clean, Snatch)

### Level 6-10 (Elite / Near-Impossible)
- Muscle Ups (6-8)
- Planche, Front Lever (8-9)
- One Arm Pull-up (10)

## Dynamic User Scaling

When the AI generates a routine, it fetches the user's `experience_level`. We map this to a numeric value:
- **Beginner** = 1
- **Intermediate** = 2
- **Advanced** = 3

### The Filter Formula
`max_allowed_difficulty = user_numeric_level + 1.5`

#### What does this mean in practice?
* **Beginners (1)** get a limit of **2.5**. They have access to all machines (1), cables (1), basic push-ups (2), and goblet squats (2). They are completely blocked from Dips (3) and Pull-ups (4), receiving Assisted alternatives instead.
* **Intermediates (2)** get a limit of **3.5**. They unlock Dips (3), Lunges (3), and Bulgarian Split Squats (3), but are still protected from strict Pull-ups (4) and Single Leg Deadlifts (5). 
* **Advanced (3)** get a limit of **4.5**. They unlock Pull-Ups (4), Barbell Rows (4), and can theoretically be given higher ceilings if their feedback overrides the DB. *(Note: To allow advanced users to see Level 10 elements like Muscle Ups, the final tier should either jump heavily or the formula scales non-linearly. We will map Advanced to max `10` directly to allow full access).*

### Revised Filter Formula (Final)
We want a linear mathematical progression but unbounded for Advanced users:
* **Beginner:** `max = 2.5`
* **Intermediate:** `max = 4.5`
* **Advanced:** `max = 10`
