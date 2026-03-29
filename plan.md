# Plan: Drop Sets, Failure Tracking, Effort Score & Onboarding Tutorial

## Context

The app currently tracks sets as flat records (weight, reps) with no concept of set type (normal/drop/warmup). There's no way to mark sets as "to failure." No effort measurement exists, and new users land on the full app with zero guidance. These 4 features address training intensity tracking and new user onboarding.

**Confirmed decisions:**
- Failure tracking = simple yes/no toggle per set (no RPE UI)
- Effort score = informational only (no XP bonus)
- Tutorial = non-blocking checklist on Home page
- Warmup sets = included as a set type

---

## Feature 1: Drop Sets, Warmup Sets & Failure Toggle

**What the user sees in ActiveSession:**
- Each set row has a small tappable "F" button. Tap to mark "went to failure" (turns red).
- Below the normal "Add Set" button, two new buttons: "Add Warmup Set" (above working sets) and "Add Drop Set" (below). Warmup sets appear with a blue "WARM" label, drop sets with an orange "DROP" label.
- Warmup/drop sets are visually distinct (colored left border + label pill instead of set number).

### Backend

**[session.py](backend/app/models/session.py)** — Add to `Set` model:
- `set_type = Column(String, default="normal", server_default="normal")` — values: `"normal"`, `"drop"`, `"warmup"`
- `to_failure = Column(Boolean, default=False, server_default="false")`

**[schemas.py](backend/app/schemas.py)** — Add to `SetBase`, `SetCreate`, `SetUpdate`, `SetResponse`, `CompleteSetItem`:
- `set_type: Optional[str] = "normal"`
- `to_failure: Optional[bool] = False`

**[sessions.py](backend/app/routers/sessions.py)** — Pass `set_type` and `to_failure` through in `complete_session_bulk` set creation loop.

**Migration:** `add_set_type_and_to_failure_to_sets`

### Frontend

**[schema.ts](frontend/src/db/schema.ts)** — Add `set_type?: string` and `to_failure?: boolean` to `Set` interface.

**[ActiveSession.tsx](frontend/src/pages/ActiveSession.tsx):**
- Modify `addSet(exerciseId, setType)` to accept type param:
  - `"warmup"`: pre-fill weight at ~50% of first working set, placed before normal sets
  - `"drop"`: pre-fill weight at ~75% of last working set, placed after normal sets
- Render "Add Warmup" button above the first set (only if no warmup exists yet or below limit)
- Render "Add Drop Set" button below last normal set (capped by `max_drop_sets`)
- Failure "F" button on each set row — toggles `to_failure`, calls `updateSet(id, 'to_failure', !current)`
- Visual styling:
  - Warmup rows: blue "WARM" pill, `borderLeft: 3px solid var(--info)`
  - Drop rows: orange "DROP" pill, `borderLeft: 3px solid var(--warning)`
  - Failure active: "F" button turns red/filled

**[sync.ts](frontend/src/db/sync.ts)** — Include `set_type` and `to_failure` in bulk sync payload.

### Important: Warmup/drop set exclusions
- Warmup sets are **excluded** from: PR detection, volume calculations, effort score, progression engine analysis
- Drop sets **count** toward volume and effort but are **excluded** from PR detection

---

## Feature 2: Training Feature Settings

**What the user sees:** A new "Training Features" section in Settings with toggles that control which advanced features appear in ActiveSession.

### Settings in `User.settings` JSON (no migration needed):
- `failure_tracking_enabled` (bool, default false) — shows "F" toggle per set
- `drop_sets_enabled` (bool, default false) — shows "Add Drop Set" button
- `warmup_sets_enabled` (bool, default false) — shows "Add Warmup" button
- `max_drop_sets` (int, 1 or 2, default 1)
- `effort_tracking_enabled` (bool, default false) — shows self-rating modal + effort score gauge

### Frontend

**[Settings.tsx](frontend/src/pages/Settings.tsx)** — New "TRAINING FEATURES" section between Language card and Logout button:

```
TRAINING FEATURES
┌─────────────────────────────────────────┐
│ 🔴 Failure Tracking              [OFF]  │
│    Mark sets where you went to failure  │
├─────────────────────────────────────────┤
│ 🟠 Drop Sets                     [OFF]  │
│    Add reduced-weight sets after work   │
├─────────────────────────────────────────┤
│ 🔵 Warmup Sets                   [OFF]  │
│    Add lighter warmup sets before work  │
├─────────────────────────────────────────┤
│    Max Drop Sets          [ 1 ] [ 2 ]   │
│    (only visible when Drop Sets is on)  │
├─────────────────────────────────────────┤
│ 📊 Effort Tracking               [OFF]  │
│    Rate sessions & track effort score   │
└─────────────────────────────────────────┘
```

Each toggle saves immediately via `api.put('/auth/me', { settings: {...} })` + `updateUser(...)` — same pattern as `changeLanguage`.

---

## Feature 3: Effort Measurement (Informational)

**What the user sees:** If enabled in Settings (`effort_tracking_enabled`, off by default), after finishing a workout the GamificationToast includes an "Effort Score" gauge (0-100). A trend chart on Stats shows effort over time. Purely informational — no XP impact.

### Session-End Self-Rating

When effort tracking is enabled and the user taps "Finish" in ActiveSession, before completing a quick modal/sheet asks:

```
┌─ How hard was this session? ─────────┐
│                                       │
│   1  2  3  4  5  6  7  8  9  10      │
│            ○  ○  ○  ●  ○  ○          │
│          easy     ↑    hard           │
│              [Skip]  [Done]           │
└───────────────────────────────────────┘
```

Stored as `self_rated_effort` (int 1-10, nullable) on the Session model. Skipping = null (factor uses neutral default).

### Effort Score Formula (0-100):

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Volume | 15% | Session volume vs avg of last 10 sessions |
| Failure | 30% | % of exercises with at least one failure set |
| Self-Rated | 30% | User's 1-10 session rating, mapped to 0-100 |
| Progression | 25% | Did user match/beat previous weights or reps? |

**Fallback behavior:**
- Failure tracking disabled → failure factor = 0, weights redistribute: Volume 27%, Self-Rated 40%, Progression 33%
- Self-rating skipped → self-rated factor = 50 (neutral)
- First session (no history) → volume = 50, progression = 50 (neutral)

### Concrete Examples

**Example A — Casual / easy session (score ~22):**
- 3 exercises, 3 sets each at usual weight and reps
- No failure sets (0/3 exercises)
- Self-rated: 4/10
- Volume matches average (ratio 1.0 → 50/100)
- No progression (same weight/reps → 0/100)
- Score: (50 × 0.15) + (0 × 0.30) + (40 × 0.30) + (0 × 0.25) = 7.5 + 0 + 12 + 0 = **19.5**

**Example B — Solid session, some effort (score ~60):**
- 4 exercises, hit failure on 2 of them (50%)
- Self-rated: 7/10
- Volume 10% above average (ratio 1.1 → 73/100)
- Progressed weight on 2/4 exercises (50% → 50/100)
- Score: (73 × 0.15) + (50 × 0.30) + (70 × 0.30) + (50 × 0.25) = 11 + 15 + 21 + 12.5 = **59.5**

**Example C — All-out session (score ~94):**
- 5 exercises, all to failure (100%)
- Self-rated: 9/10
- Volume 25% above average (→ 100/100, capped)
- Progressed on 4/5 exercises (80% → 80/100)
- Score: (100 × 0.15) + (100 × 0.30) + (90 × 0.30) + (80 × 0.25) = 15 + 30 + 27 + 20 = **92**

**Example D — Only self-rating enabled, no failure tracking (score ~50):**
- Volume matches average, self-rated 5/10, progressed on half
- Redistributed: Volume 27%, Self-Rated 40%, Progression 33%
- Score: (50 × 0.27) + (50 × 0.40) + (50 × 0.33) = 13.5 + 20 + 16.5 = **50** (neutral)

### Backend

**[session.py](backend/app/models/session.py)** — Add to `Session`:
- `effort_score = Column(Float, nullable=True)`
- `self_rated_effort = Column(Integer, nullable=True)` — 1-10 scale

**New file: [effort_score.py](backend/app/effort_score.py):**
```python
def compute_effort_score(db, user_id, session) -> float:
	# Volume: current vs avg of last 10 sessions (excluding warmup sets)
	# Failure: % of exercises with ≥1 to_failure set (excluding warmups)
	# Self-rated: session.self_rated_effort mapped to 0-100
	# Progression: % of exercises matching/beating previous session
	# Returns 0-100 float, handles missing factors with redistribution
```

**[gamification.py](backend/app/gamification.py)** — After PR calculation, call `compute_effort_score()` and store on session. Include in response dict as `effort_score` (informational, no XP bonus).

**[schemas.py](backend/app/schemas.py):**
- Add `effort_score: Optional[float]` and `self_rated_effort: Optional[int]` to `SessionResponse`
- Add `self_rated_effort: Optional[int]` to `CompleteSessionBulk`

**[sessions.py](backend/app/routers/sessions.py)** — In `complete_session_bulk`, read `self_rated_effort` from payload and store on session.

**Migration:** `add_effort_score_and_self_rating_to_sessions`

### Frontend

**[ActiveSession.tsx](frontend/src/pages/ActiveSession.tsx):**
- On "Finish" tap, before completing: show a bottom sheet / modal with 1-10 tappable circles for self-rating. "Skip" dismisses with null, "Done" saves the value.
- Pass `self_rated_effort` in the complete_bulk payload.

**[GamificationToast.tsx](frontend/src/components/GamificationToast.tsx):**
- Show effort score: colored horizontal bar (red <40, yellow 40-60, green 60-80, bright green 80+) with numeric score.
- Informational only — no XP line for effort.

**[Stats.tsx](frontend/src/pages/Stats.tsx) or [Dashboard.tsx](frontend/src/pages/Dashboard.tsx):**
- Effort trend line chart (same style as existing charts) showing effort score over recent sessions.

---

## Feature 4: New User Tutorial (Checklist) + Questionnaire Rewards

**What the user sees:** A "Getting Started" card at the top of the Home page with steps including questionnaire levels. Completing steps earns coins. All tabs remain accessible — this is a guide, not a gate.

### Checklist Steps & Coin Rewards

```
┌─ Getting Started ──────────── 2/7 ──┐
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                      │
│ ✅ Set up your profile    +10 coins  │
│ ✅ Basic questionnaire    +20 coins  │
│ ○  Intermediate quest.    +20 coins  │
│ ○  Advanced quest.        +20 coins  │
│ 👉 Create your first routine  →     │
│ 🔒 Complete your first workout      │
│ 🔒 Check your stats                 │
│                                      │
│   Total: 30/120 coins earned         │
│              [Dismiss]               │
└──────────────────────────────────────┘
```

| Step | Trigger | Coins | Required? |
|------|---------|-------|-----------|
| 1. Set up your profile | Onboarding bio page | +10 | Yes |
| 2. Basic questionnaire (L1) | Level 1 context done | +20 | Yes |
| 3. Intermediate questionnaire (L2) | Level 2 context done | +20 | Optional |
| 4. Advanced questionnaire (L3) | Level 3 context done | +20 | Optional |
| 5. Create your first routine | First routine created | +0 | Yes |
| 6. Complete your first workout | First session completed | +0 | Yes |
| 7. Complete tutorial | Dismiss or all required done | +50 | — |
| **Total** | | **120 coins** | |

**Questionnaire levels are available right after the basic one.** They're shown as optional steps (empty circle, not locked). The user can do them anytime — during onboarding or later from Settings > Training Context.

**Shortcut:** If user picks L3 during onboarding (which includes L1+L2 content), steps 2, 3, and 4 all complete at once = +60 coins. Same for L2 = steps 2+3 = +40 coins.

**Tutorial completion:** The +50 coin reward triggers when the user dismisses the card OR when all *required* steps (1, 2, 5, 6) are done — the optional questionnaire steps don't block completion.

### Backend

**[user.py](backend/app/models/user.py)** — Add `onboarding_phase = Column(Integer, default=0, server_default="0")`:
- 0 = fresh account
- 1 = profile set up
- 2 = L1 questionnaire done
- 3 = first routine created
- 4 = first session completed
- 5 = L2 questionnaire done
- 6 = L3 questionnaire done
- 7 = tutorial complete/dismissed

Note: Phase tracks the *highest completed step*, not strict order. Steps can be completed out of order (e.g., L3 questionnaire before first session). The checklist shows all steps with their individual completion status.

**Better approach — use a JSON field instead of single int:**
- `onboarding_progress = Column(JSON, default={}, server_default="{}")` — stores completion per step:
  ```json
  {
	"profile": true,
	"questionnaire_l1": true,
	"questionnaire_l2": false,
	"questionnaire_l3": false,
	"first_routine": true,
	"first_session": false,
	"tutorial_complete": false,
	"coins_awarded": ["profile", "questionnaire_l1"]
  }
  ```
- `coins_awarded` array prevents double-awarding coins for the same step.

**Auto-advance triggers + coin awards:**
- **Onboarding page** → `profile: true` → +10 coins
- **TrainingContext questionnaire** → set `questionnaire_l1/l2/l3: true` based on level completed. Award coins for each newly completed level.
- **Routines router** → `first_routine: true` on first routine creation
- **Sessions router** → `first_session: true` on first session completion
- **Dismiss / all done** → `tutorial_complete: true` → +50 coins

**[schemas.py](backend/app/schemas.py)** — Add `onboarding_progress: Optional[dict]` to `UserResponse` and `UserUpdate`.

**Migration:** `add_onboarding_progress_to_users`

### Frontend

**[Stats.tsx](frontend/src/pages/Stats.tsx)** — At top of page, when `!user.onboarding_progress?.tutorial_complete`:
- Render "Getting Started" card with progress bar (N/7 steps)
- Each step shows: completion icon, label, coin reward badge
- Active step highlighted, locked steps grayed out
- Running total of coins earned
- "Dismiss" → marks `tutorial_complete: true`, awards +50 coins, hides card

**[TrainingContext.tsx](frontend/src/pages/TrainingContext.tsx)** — After questionnaire submission, update `onboarding_progress` with completed levels and trigger coin awards.

**[schema.ts](frontend/src/db/schema.ts)** — Add `onboarding_progress?: Record<string, any>` to User interface.

**Coin award toast:** When coins are awarded for a tutorial step, show a small toast: "+20 coins for completing the questionnaire!"

---

## Implementation Order

1. **Feature 2** (Settings toggles) — no migration, UI only, unblocks Features 1 & 3
2. **Feature 1** (Set types + failure) — 1 migration, needed by Feature 3
3. **Feature 3** (Effort score) — 1 migration, depends on 1 & 2
4. **Feature 4** (Tutorial) — 1 migration, independent

**Total: 3 Alembic migrations**

---

## Testing

- `test_set_types.py` — drop/warmup sets persist correctly via complete_bulk; warmups excluded from PR detection
- `test_effort_score.py` — score computation with known inputs; edge cases (no history, no failure data, first session)
- `test_onboarding_phase.py` — auto-advance on routine creation and session completion; manual dismiss via PUT /auth/me
- Run `make test` after each feature

## Verification
1. Enable failure + drop sets + warmup in Settings → start session → verify buttons appear
2. Mark sets to failure, add drop/warmup sets → finish session → verify effort score in toast
3. Check Stats page for effort trend chart
4. Register new user → verify Getting Started card → complete steps → verify auto-advance → dismiss
`