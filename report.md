# Web App Fixes & Improvements Report

## Context
This report documents the work completed for each requested improvement.  
For every item, include:
- **Status:** (Done / Partially done / Not done)
- **What was changed:** concise technical summary
- **Files/Modules touched:** list of key files (with paths)
- **Database changes (if any):** migrations, schema updates, seed updates
- **UI/UX changes:** what the user will notice
- **Edge cases handled:** offline, logout/login, iOS PWA, etc.
- **How to test:** exact reproduction steps + expected result
- **Notes / follow-ups:** remaining risks or future improvements

## Checklist

### 1) Persist session history after logout (critical)
- **Status:** Done
- **What was changed:** Fixed an issue where `completed_at` was missing from the `SessionCreate` schema, causing the backend to silently drop it. This meant sessions were never fully completed on the server. Also updated the offline sync logic (`frontend/src/db/sync.ts`) to handle sessions/sets that were "updated" offline before ever being sent to the server (missing `server_id`), treating them as a create instead of an update. Finally, explicitly mapped `server_id` when fetching history on login.
- **Files/Modules touched:** `backend/app/schemas.py`, `frontend/src/db/sync.ts`, `frontend/src/App.tsx`
- **Database changes (if any):** Allowed `completed_at` to exist on the Create schema payload.
- **UI/UX changes:** No visible UI change, but history items now survive logout/login.
- **Edge cases handled:** Creating a session while offline, finishing it while offline, and then logging in or reconnecting.
- **How to test:** 1. Start a session offline. 2. Finish session. 3. Go online. 4. Wait for sync. 5. Log out -> Log in. The session should be correctly fetched in History.
- **Notes / follow-ups:** None.

### 2) Add more exercises (especially bodyweight / calisthenics)
- **Status:** Done
- **What was changed:** Appended 10 new advanced bodyweight / calisthenics exercises to the seed data (e.g. Front Lever, Muscle Up, Planche, Human Flag, etc.).
- **Files/Modules touched:** `backend/app/seed_data.py`
- **Database changes (if any):** Added the new exercises to the `exercises` table via a re-seeding script.
- **UI/UX changes:** Users will now see these new calisthenic exercises in the Exercise Picker.
- **Edge cases handled:** Ensured properties like `is_bodyweight = True` and appropriate muscle/equipment tags were used. `name_translations` added where necessary.
- **How to test:** 1. Go to Create Routine -> Manual Builder. 2. Tap Add Exercise. 3. Search for "Front Lever" or "Planche" to confirm they appear.
- **Notes / follow-ups:** None.

### 3) Set realistic default weights for weighted exercises
- **Status:** Done
- **What was changed:** Introduced a `default_weight_kg` attribute to the `Exercise` model. Updated the initial seed data via an AST script to apply heuristics (e.g. Barbell exercises default to 20kg empty bar, Dumbbells default to 5-10kg per hand depending on exercise, cables to 5kg, legs/machine press to 40kg). The UI now pre-fills these weights instead of defaulting everything to 0kg.
- **Files/Modules touched:** `backend/app/models/exercise.py`, `backend/app/seed_data.py`, `frontend/src/db/schema.ts`, `frontend/src/pages/ActiveSession.tsx`
- **Database changes (if any):** Added `default_weight_kg` (Float, nullable) to `exercises` table.
- **UI/UX changes:** When users log a new exercise they haven't done before, it populates with a logical default weight corresponding to the movement, rather than 0kg.
- **Edge cases handled:** Bodyweight exercises have a strict 0kg default. Handled via backend model defaulting and populated down to frontend IndexedDB automatically on sync.
- **How to test:** 1. Start a session. 2. Add an exercise like 'Deadlift' or 'Bench Press' which you have never done. 3. Look at the pre-filled weight on Set 1, it should show 20kg instead of 0kg.
- **Notes / follow-ups:** None.

### 4) Allow users to create custom exercises
- **Status:** Done
- **What was changed:** Added a sticky "Create Custom Exercise" button at the top of the `ExercisePicker`. When clicked, it opens a sub-form allowing the user to enter a Name, Target Zone, Specific Muscle, and Equipment.
- **Files/Modules touched:** `frontend/src/components/ExercisePicker.tsx`, `backend/app/routers/exercises.py` (verified post endpoint)
- **Database changes (if any):** None structurally; backend handles `source="custom"`.
- **UI/UX changes:** Exercise picker has a clear UI flow for creating custom exercises without leaving the workout context.
- **Edge cases handled:** If the user creates an exercise offline (network request fails), we show an alert. Pre-fills the custom name with their existing search term. Automatically selects it and drops it into the routine upon saving.
- **How to test:** 1. Start a routine. 2. Tap Add Exercise. 3. Type "My custom curl". 4. Tap "Create Custom Exercise". 5. Fill out the form and submit. It should immediately appear as a new set.
- **Notes / follow-ups:** Offline creation queues aren't implemented for exercises yet (only sessions/sets), so they must be online to save it. This is considered acceptable for now, but could be enhanced later via the sync service.

### 5) Expand “Target zone” to include individual muscles (DB update)
- **Status:** Done
- **What was changed:** Updated `frontend/src/components/ExercisePicker.tsx` to include an "Specific Muscle" chip filter in addition to the Target Zone (muscle group) and Equipment filters. 
- **Files/Modules touched:** `frontend/src/components/ExercisePicker.tsx`
- **Database changes (if any):** No schema changes required as `muscle` already existed.
- **UI/UX changes:** The filter menu within the exercise picker now displays a third section with chips for every individual muscle (e.g. Biceps, Triceps, Calves, Core). Tapping one filters the list to only those exercises.
- **Edge cases handled:** Extracts unique muscles dynamically from the current list of exercises, avoiding empty states.
- **How to test:** 1. Open Exercise Picker. 2. Tap Filter icon. 3. Scroll to "Specific Muscle" and select "Biceps". 4. Verify only Bicep exercises list.
- **Notes / follow-ups:** None.

### 6) Autosave in-progress workout session (“Resume workout”)
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 7) Improve iPhone PWA tab navigation behavior
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 8) Routines (edit): clear delete icon instead of red dot
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 9) Routines (edit): easy reordering of exercises
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 10) Fix offline → online routine save freeze
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 11) Phone UX: reset scroll to top when switching tabs
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups:

### 12) Home (volume): incorrect displayed value
- Status:
- What was changed:
- Files/Modules touched:
- Database changes:
- UI/UX changes:
- Edge cases handled:
- How to test:
- Notes / follow-ups: