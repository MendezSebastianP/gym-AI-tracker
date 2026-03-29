# Gym AI Tracker Audit Report
Date: 2026-03-29

Scope:
- Backend audit focused on EXP/coins abuse vectors and legacy risk
- Concrete checks on: session completion, promo/shop, onboarding rewards, claims, admin exposure

Verification status:
- Backend tests were updated and rerun: `189 passed`
- Top exploit findings below were validated with local `TestClient` repro scripts

## Findings

### 1) Critical - Session completion can be replayed for repeated XP/level gains
Where:
- `backend/app/routers/sessions.py:73-96`
- `backend/app/routers/sessions.py:118-168`

Problem:
- A completed session can be set back to `completed_at = null` via `PUT /api/sessions/{id}`.
- Completing it again re-triggers `award_session_xp(...)` as if it were the first completion.
- This allows repeated XP gains from the same session, bypassing intended progression.

Validated behavior:
- Repro output: `xp1: 50`, `xp2: 50` after reopen/re-complete of the same session.

Impact:
- Unlimited XP farming from a single workout
- Indirect coin farming via repeated level-ups

How to solve:
1. Make completion immutable in generic update routes:
   - If `was_completed` is `True`, reject `completed_at=None` and reject re-completion through this route.
2. If reopening sessions is required, add a dedicated endpoint that:
   - reverses prior rewards exactly,
   - resets completion state safely,
   - logs audit trail.
3. Add regression tests for:
   - reopen + re-complete should not mint XP twice.

---

### 2) Critical - Promo code rewards can be redeemed repeatedly by overwriting settings
Where:
- `backend/app/routers/auth.py:160-163` (blind overwrite of `current_user.settings`)
- `backend/app/routers/gamification.py:486-495` (promo redemption state stored in `settings.redeemed_codes`)

Problem:
- Promo redemption uses `settings["redeemed_codes"]` as source of truth.
- User can call `PUT /api/auth/me` with custom `settings` to clear that list.
- Same promo can then be redeemed again for more coins.

Validated behavior:
- Repro output: promo redeem succeeded twice:
  - first call currency `2110`
  - after settings overwrite, second call currency `4110`

Impact:
- Unlimited coin minting
- Shop/economy integrity fully broken

How to solve:
1. Stop allowing full settings replacement from `/api/auth/me`.
2. Split settings into:
   - user-editable keys (UI preferences),
   - server-managed keys (purchases, redeemed codes, streak skin ownership).
3. Move promo redemptions to a dedicated table with DB uniqueness:
   - unique `(user_id, code)` constraint.
4. Keep a server-side merge allowlist for editable settings keys.

---

### 3) High - Deleting completed sessions does not rollback rewards correctly
Where:
- `backend/app/gamification.py:456-483`
- `backend/app/routers/sessions.py:188-195`

Problem:
- `remove_session_xp` subtracts `BASE_SESSION_XP + pr_xp`, but does not reverse:
  - routine completion bonus (`+100`),
  - exact cap state,
  - all side-effects consistently (level-up currency can remain).
- Comment in code confirms approximation (`line 466`).

Validated behavior:
- Repro output:
  - before: `level 1 / exp 0 / currency 100`
  - after completion: `level 2 / exp 50 / currency 110`
  - after delete: `level 2 / exp 0 / currency 110`
- Session removed, but level and 10 coins remained.

Impact:
- Farmable level/coin gain by complete-delete cycles

How to solve:
1. Persist exact reward breakdown per completed session (base/pr/routine/level-up deltas).
2. On delete/reopen, reverse exact persisted deltas, not recomputed heuristics.
3. Add tests for:
   - complete then delete should return user to exact pre-session state.

---

### 4) High - Onboarding coin rewards can be self-completed via profile patch
Where:
- `backend/app/routers/auth.py:162-163`
- `backend/app/onboarding.py:92-113`

Problem:
- Client may submit arbitrary `onboarding_progress` booleans in `PUT /api/auth/me`.
- Server grants rewards when those booleans flip to `true`.
- User can mark profile/questionnaire/routine/session complete without doing real actions.

Validated behavior:
- Repro output: currency moved from `100` to `220` in one request by sending onboarding flags.

Impact:
- Fast-start coin inflation without completing intended milestones

How to solve:
1. Do not accept coin-bearing onboarding steps from client payload.
2. Mark rewarded steps only from trusted server-side events:
   - profile fields updated, routine actually created, session actually completed, etc.
3. If client patch is kept for UX, allow only non-reward display flags.

---

### 5) High - Admin endpoints are accessible to any authenticated user
Where:
- `backend/app/routers/admin.py:14-141`

Problem:
- Admin routes require authentication but do not enforce admin authorization.
- Any user can access:
  - `/api/admin/users`,
  - `/api/admin/ai/report`,
  - global exercise create/update/delete endpoints.

Validated behavior:
- Fresh normal user could call `/api/admin/users` and got HTTP `200`.

Impact:
- Unauthorized access to sensitive user metadata and global catalog mutation

How to solve:
1. Add `require_admin` dependency and enforce it on all `/api/admin/*` routes.
2. Define explicit admin role in DB (not inferred from email string).
3. Add authorization tests for non-admin `403`.

---

### 6) Medium - Reward claims are vulnerable to race-condition double grants
Where:
- `backend/app/gamification.py:569-607` (`claim_quest_reward`)
- `backend/app/routers/gamification.py:141-180` (`/streak/claim`)
- `backend/app/routers/gamification.py:473-504` (`/shop/promo`)

Problem:
- Reward claim checks are read-then-write without locking/atomic guards.
- Parallel requests can pass checks before commit and grant rewards twice.

Impact:
- Duplicate XP/coins under concurrent request abuse

How to solve:
1. Use atomic SQL updates (`... WHERE claimed=false RETURNING ...`) or row locks.
2. Add DB constraints where possible (e.g., promo redemptions in dedicated unique table).
3. Add concurrency tests for double-submit scenarios.

---

### 7) Medium - Legacy/compatibility debt in critical paths
Where:
- `backend/app/gamification.py` (`Query.get()` usages: lines `125`, `269`, `496`, `582`)
- `backend/app/routers/gamification.py` (`Query.get()` usages: lines `67`, `103`)
- `backend/app/routers/progression.py` (`Query.get()` usages: lines `75`, `129`)
- `backend/app/db_export_import.py:32` (`datetime.utcnow()`)

Problem:
- SQLAlchemy `Query.get()` is legacy/deprecated in 2.x.
- `datetime.utcnow()` is deprecated in modern Python.

Impact:
- Upgrade fragility, noisy runtime warnings, eventual break risk

How to solve:
1. Replace `db.query(Model).get(id)` with `db.get(Model, id)`.
2. Replace `datetime.utcnow()` with `datetime.now(timezone.utc)`.
3. Add a CI rule to fail on new deprecation warnings in backend tests.

---

### 8) Medium - Legacy export/import script is out of sync with current models
Where:
- `backend/app/db_export_import.py:43`, `109-111`
- Model uses `password_hash`, script uses `hashed_password`

Problem:
- Script references non-existent user fields (`hashed_password`) and omits newer gamification fields.
- Import/export likely fails or silently produces incomplete/misaligned data.

Impact:
- Backup/restore unreliability and data integrity risk during migrations

How to solve:
1. Align script with current models (`password_hash` and new fields).
2. Add round-trip tests: export -> fresh DB import -> integrity assertions.
3. Mark script as deprecated until updated, to avoid accidental use.

## Recommended Priority Order
1. Fix session replay and promo/settings overwrite (Findings 1-2)
2. Fix delete rollback correctness (Finding 3)
3. Lock down admin authorization (Finding 5)
4. Harden onboarding reward writes and claim race conditions (Findings 4, 6)
5. Complete legacy cleanup (Findings 7-8)
