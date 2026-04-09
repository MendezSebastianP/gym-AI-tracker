# Effort Trend

## What it is

The Effort Trend chart shows a 0–100 composite score for each completed session, plotted over time. It tells the user how hard their training has been relative to their own history, combining objective load data with their self-reported feel.

The chart only appears on the Dashboard when the user has enabled **Effort Tracking** in Settings.

---

## How the score is calculated

**Entry point:** `backend/app/effort_score.py` — `compute_effort_score(db, user_id, session)`

**Key rules — when no score is computed (returns `None`):**
1. If the user skipped the self-rating (hit "Skip" at session end), `self_rated_effort` is `None` — no score is stored. The user is not interested in tracking effort for that session.
2. If there are no prior completed sessions at all (the user's very first session), there is nothing meaningful to compare against — no score is stored. The trend starts from session 2 onward.

The score is a weighted average of up to four factors, all normalized to 0–100:

### 1. Volume Factor (weight 0.27 / 0.15 with failure tracking)
Compares current session's total volume (`weight × reps` across all normal sets) against the rolling average of the last 10 completed sessions.

**How `avg_volume` is obtained (`_volume_factor`, lines 32–71):**
1. Query the IDs of the **10 most recent completed sessions** that precede the current one (`completed_at < session.completed_at`, ordered descending, `LIMIT 10`).
2. For each of those session IDs, fetch all normal sets and compute that session's volume: `sum(weight_kg × reps)` for every set where `reps > 0`.
3. `avg_volume = sum(per-session volumes) / count`

If there are no prior sessions, or all prior volumes are zero, `avg_volume` is treated as undefined and the factor defaults to 50.

- Ratio = `current_volume / avg_volume`
- Score = `50 + (ratio - 1.0) × 230`  → clamped to [0, 100]
- At parity (ratio = 1.0) → 50. At +10% → ~73. At +25% → capped at 100.
- No history → defaults to 50 (neutral).

### 2. Self-Rating Factor (weight 0.40 / 0.30)
The user's own 1–10 effort rating entered at session end.

- Score = `rating × 10`  (e.g., 7 → 70)

### 3. Progression Factor (weight 0.33 / 0.25)
Fraction of exercises in the session where the user beat a previous personal best (weight or reps), compared to exercises that have historical data to compare against.

- Score = `10 + (progressed / comparable) × 90`
- 0% progressed → **10** (not pushing beyond history). 100% progressed → 100.
- No comparable history (first time doing those exercises) → defaults to 50 (neutral, no penalty).

### 4. Failure Factor (weight 0.30 — only when failure tracking is enabled)
Measures intensity via sets taken to failure. Ceiling is calibrated for realistic usage: most lifters only go to failure on the last set of an exercise, not every set.

- `cap = total_exercises / 2`  (failing half your exercises' last sets is already very intense)
- `capped_failed = min(failed_exercises, cap)`
- Score = `(capped_failed / cap) × 100`

So if you have 4 exercises and push 2 to failure → score 100. If you push all 4 → same 100 (capped). If you push 1 → score 50.

### Final weights

| Factor | Failure tracking OFF | Failure tracking ON |
|---|---|---|
| Volume | 0.27 | 0.15 |
| Self-rating | 0.40 | 0.30 |
| Progression | 0.33 | 0.25 |
| Failure | — | 0.30 |

Only **normal sets** are counted (warmup and drop sets are excluded via `_is_normal_set_filter()`).

### First session

The first completed session does **not** get an effort score. There is no prior data to compare against, so volume and progression would both be meaningless neutrals. The trend chart starts from session 2 onward.

### When the score is computed

`compute_effort_score` is called inside `award_session_xp` in `backend/app/gamification.py` (lines 342–344), triggered when the session sync endpoint (`POST /api/sessions/{id}/complete_bulk`) fires on completion. The result is stored in `sessions.effort_score`.

It is also recomputed when a user edits `self_rated_effort` on an already-completed session via `PUT /api/sessions/{id}` (`update_session` in `routers/sessions.py`).

---

## Worked example — 3 sessions (failure tracking OFF)

**Setup:** 3 exercises per session, no failure tracking.

### Session 1 — First session ever, user rates 7

**No score computed.** There are no prior completed sessions to compare against. `compute_effort_score` returns `None`. This session is excluded from the trend chart.

---

### Session 2 — Volume up 10% vs S1, 2 of 3 exercises PR'd, user rates 8

| Factor | Calculation | Score |
|---|---|---|
| Volume | avg_volume = S1 volume. ratio = 1.10 → `50 + (0.10 × 230)` | 73 |
| Self-rating | `8 × 10` | 80 |
| Progression | 2/3 progressed → `10 + (2/3 × 90)` | 70 |

**Score = `0.27×73 + 0.40×80 + 0.33×70` = 19.7 + 32.0 + 23.1 = **74.8****

This is the first point on the trend chart.

---

### Session 3 — Volume down 5% vs avg(S1,S2), no PRs, user rates 5

| Factor | Calculation | Score |
|---|---|---|
| Volume | avg_volume = mean(S1, S2). ratio = 0.95 → `50 + (-0.05 × 230)` | 38.5 |
| Self-rating | `5 × 10` | 50 |
| Progression | 0/3 progressed → `10 + (0/3 × 90)` | 10 |

**Score = `0.27×38.5 + 0.40×50 + 0.33×10` = 10.4 + 20.0 + 3.3 = **33.7****

The drop from 74.8 → 33.7 accurately reflects a maintenance/deload session where nothing was pushed.

---

## DB columns involved

`backend/app/models/session.py`:
- `effort_score` — Float, computed on completion and stored. `None` if user skipped the rating.
- `self_rated_effort` — Integer 1–10, sent from the frontend at completion (or updated later via edit).

---

## How the data is fetched

**Endpoint:** `GET /api/stats/effort?limit=12`  
**Handler:** `backend/app/routers/stats.py` — `_compute_effort_trend` (line 260)

The function:
1. Queries the last N completed sessions ordered by `completed_at` ascending.
2. For each row, uses `effort_score` if set; falls back to `self_rated_effort × 10` if not (backward-compatibility for sessions completed before the score was computed server-side).
3. Skips sessions with neither value.
4. Returns `[{ index, date, effort }, ...]` — `index` is sequential (1-based), `date` is ISO date string.

A separate unauthenticated endpoint `GET /api/stats/effort/demo` uses the demo user's data for the landing page and demo mode.

---

## How it is displayed

**Component:** `frontend/src/pages/Dashboard.tsx` — lines 620–646

The chart is rendered using **Recharts** `LineChart` inside a card. It is only shown when:
- `effortTrackingEnabled` is true (`user.settings.effort_tracking_enabled`)
- `effortTrend` array has at least one point

Chart details:
- X-axis: session index (1, 2, 3…)
- Y-axis: fixed domain [0, 100]
- Line: green (`#22c55e`), stroke width 2.5, small dots (r=2)
- Tooltip: shows the numeric effort value on hover
- Subtitle: "Last N sessions (0–100)"

### Data loading (Dashboard.tsx lines 242–301)

A `useEffect` runs on mount (and when `demoMode` or `effortTrackingEnabled` changes):

- **Demo mode:** fetches from `GET /stats/effort/demo?limit=12`; falls back to hardcoded sample data if the API call fails.
- **Normal mode:** reads directly from the local Dexie IndexedDB (`db.sessions`), filters for sessions with a numeric `effort_score`, sorts by `completed_at`, takes the last 12, and maps to `{ index, effort }`.

### Effort rating modal at session end (ActiveSession.tsx lines 451–502, 1420–1503)

When the user finishes a session and effort tracking is enabled, a modal overlay appears (rendered via `createPortal` into `document.body`) showing:
- A large numeric display (`effortValue`, default 7) with a tone label: Easy / Moderate / Hard / All out
- A range slider (1–10) with an accent color matching the green theme
- A row of tap-target numbers below the slider for direct selection
- "Skip" → completes the session with `self_rated_effort = null` (no score will be computed)
- "Done" → completes with the selected value

Tone thresholds: ≤3 Easy, ≤6 Moderate, ≤8 Hard, 9–10 All out.

The value is saved locally to `db.sessions` via `completeSession(effortValue)` and synced to the backend on the next sync cycle, where `compute_effort_score` fires and writes back `sessions.effort_score`.

### Editing the rating after the fact (SessionFeed.tsx — FeedCard)

When effort tracking is enabled, each session card in the history feed shows:
- A green badge **`X/10 · Tone`** with a pencil icon if a rating exists
- A subtle **"Rate effort ✏"** link if no rating was given

Tapping either opens an inline slider (same 1–10 range, same tone labels). Saving calls `PUT /api/sessions/{server_id}` with `{ self_rated_effort: N }`, which recomputes and returns the updated `effort_score`. Both fields are written back to Dexie immediately.

---

## Settings toggle

`frontend/src/pages/Settings.tsx` line 411 — toggle key `effort_tracking_enabled`.  
When disabled: the Dashboard hides the Effort Trend card entirely, the rating modal is skipped at session end, and the edit badge is hidden in the session feed.
