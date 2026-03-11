# AI Personalized Routine Generation: Data Gathering Plan

## Objective
To gather comprehensive user data necessary for generating highly personalized and effective workout routines using Large Language Models (LLMs) in the future. The data collection must be completely optional and designed as a flow ("tree") with a "Fill Later" option.

## Strategy: Dynamic Questionnaire Flow (Tree Structure)
We will implement an onboarding flow (or a "Profile Setup" section) that acts as a structured question tree. This allows us to gather data step-by-step. All questions are **optional**, and the user can skip the entire process by clicking a "Fill Later" button to complete it from the Settings page later. 

In the Settings page, there will be a section to "Take the Routine Questionnaire" so users can retake it at any point.

### Question Tree

**Screen 1: Primary Goal**
- What is your main fitness goal?
  - Muscle Gain (Hypertrophy) (Leads to Screen 2A: Split focus)
  - Strength Progression (Leads to Screen 2B: Programming focus)
  - Weight Loss / Cutting (Leads to Screen 2C: Cardio/Weight balance)
  - General Fitness / Endurance
  - I don't know
  - Other (Text input)

**Screen 2 (Conditional based on Screen 1):**
- *If Muscle Gain:* What kind of training split do you prefer to follow? (e.g., Full Body, Upper/Lower, Push/Pull/Legs, Body Part split)
- *If Strength:* What type of strength progression logic do you prefer? (e.g., Linear Progression, Percentage Based, RPE Based)
- *If Weight Loss:* Do you prefer incorporating high-intensity cardio, steady-state, or purely diet-focused weightlifting?

**Screen 3: Current Experience Level**
- How long have you been lifting consistently?
  - Beginner (0-6 months)
  - Intermediate (6 months - 2 years)
  - Advanced (2+ years)
  - I don't know

**Screen 4: Available Equipment (Multi-Select)**
- What equipment do you have access to? (Check all that apply)
  - Full Commercial Gym (Cable machines, racks, variety of machines)
  - Dumbbells
  - Barbells and Plates
  - Power Rack / Squat Stand
  - Pull-up Bar / Dip Station
  - Resistance Bands
  - Bodyweight Only
  - Other (Text input)

**Screen 5: Time Commitment**
- How many days per week can you realistically train? (Slider 1 to 7, or "I don't know")
- What is your preferred session duration?
  - 30 mins
  - 45 mins
  - 60 mins
  - 90+ mins
  - I don't know

**Screen 6: Recovery and Lifestyle**
- How would you rate your typical sleep and recovery? (e.g., Poor, Average, Excellent)
- Do you have a highly active job outside the gym? (Yes/No)
- How aggressively do you want to progress? (e.g., Slow & Steady, Moderate, Aggressive)

**Screen 7: Physical Limitations & Injuries**
- Do you have any injuries or physical limitations?
  - Yes (Reveals checkboxes: Lower Back, Shoulders, Knees, Wrists, Other: Text input)
  - No

**Screen 8: Open-Ended Details**
- "Tell us any other information that the AI model should take into account when generating your routine." (Optional text box)

## Implementation Steps
1. **Database Schema Update:**
   - Create a `user_preferences` table to store this data linked to `users.id`.
   - Fields should support nullable values reflecting the optional nature of all questions.
2. **Frontend UI:**
   - Develop a multi-step form with Next/Back buttons and a persistent "Fill Later" button.
   - Use engaging UI elements (cards, toggles, multi-select grids).
   - Add a button in the Settings page to allow retaking the questionnaire.
3. **Backend API:**
   - Add endpoints to Get/Update these preferences.
4. **LLM Integration (Future):**
   - Use the gathered data (accounting for "I don't know" or missing values) to construct a detailed context prompt for the LLM. 
