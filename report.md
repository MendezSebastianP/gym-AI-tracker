# Gym AI Tracker — Change Report

## Session: Phone Navigation & UX Fixes (2026-03-01)

### Summary

This session focused on improving the mobile UX for session filling, fixing archive/delete bugs, adding in-app help tooltips, and adjusting the dashboard.

---

### Changes by Item

| #      | Issue                                      | Status | Files Modified                         |
| ------ | ------------------------------------------ | ------ | -------------------------------------- |
| **1**  | Mobile-friendly number input (stepper −/+) | ✅      | `ActiveSession.tsx`                    |
| **2**  | Auto-advance to next input (Enter/Tab)     | ✅      | `ActiveSession.tsx`                    |
| **3**  | Lock help tooltip shows actual explanation | ✅      | `RoutineDetails.tsx`                   |
| **4**  | Help (?) tooltip on Sessions page          | ✅      | `Sessions.tsx`                         |
| **5**  | Help (?) tooltip on Routines page          | ✅      | `Routines.tsx`                         |
| **6**  | Dashboard text spacing when no routines    | ✅      | `Stats.tsx`                            |
| **7**  | Archive delete bug — routine reappeared    | ✅      | `Routines.tsx`, `routines.py`          |
| **8**  | Don't resume session for archived routine  | ✅      | `Sessions.tsx`                         |
| **9**  | Volume shows total (not "this week")       | ✅      | `Stats.tsx`                            |
| **10** | Know when Docker is ready after `make up`  | ✅      | `Makefile`                             |
| **11** | New tests, run, fix, clean report          | ✅      | `test_routine_archive.py`, `report.md` |

---

### Detailed Changes

#### 1. Mobile Number Stepper (ActiveSession.tsx)

Replaced raw `<input type="number">` with a custom `NumberStepper` component:
- **−** and **+** tap buttons on each side for quick increment/decrement on touch screens
- Hold-to-repeat (fires every 120ms while pressed)
- Weight increments by 2.5kg (or 1kg for bodyweight), reps by 1
- `inputMode="decimal"` for a numeric keyboard on mobile
- Tap-to-select for easy overwriting

#### 2. Auto-Advance Between Fields (ActiveSession.tsx)

- Each input gets a unique ID (`set-{id}-weight` / `set-{id}-reps`)
- Pressing **Enter** or **Tab** on a weight field → focuses the reps field of the same set
- Pressing **Enter** or **Tab** on a reps field → focuses the weight field of the **next** set
- Sets are ordered by exercise position, then set number

#### 3. Lock Help Text (RoutineDetails.tsx)

Replaced placeholder `"Lock HELP"` with:
> "When locked, sets/reps will always be pre-filled exactly from this plan. Unlocked exercises will dynamically pre-fill based on your latest workout."

#### 4. Sessions Help Tooltip (Sessions.tsx)

Added a `?` (HelpCircle) icon next to the "Sessions" title. Clicking it shows:
- How sessions work (one workout per session)
- How the active routine determines "Up Next"
- Auto-cycling through routine days
- Resume/discard logic for unfinished sessions
- Dismissible with an ✕ button

#### 5. Routines Help Tooltip (Routines.tsx)

Added a `?` icon next to the "Routines" title. Explains:
- What a routine is (plan with days)
- How to set an active routine (⭐)
- Archive = soft delete (10-day recovery)
- How to edit exercises, sets, reps, and lock configurations

#### 6. Dashboard No-Routines Spacing (Stats.tsx)

Fixed tight line spacing when no routines exist:
- Changed from utility classes (`mb-4`, `mb-8`, `mt-8`) to explicit `style` with `marginBottom: '16px'/'32px'` and `lineHeight: '1.6'/'1.5'`
- Text is now more readable on mobile

#### 7. Archive Delete Bug Fix (Routines.tsx + routines.py)

**Problem:** After deleting an archived routine, the sync service would re-add it from the server response.

**Root cause:** The frontend was:
1. Deleting locally from Dexie
2. Sending `DELETE` to server
3. But the next sync cycle re-fetched all routines (including the deleted one, which was cached or returning stale data)

**Fix (frontend):** After each archive/restore/delete operation, we now:
1. Send the action to the server
2. Re-fetch the full routine list from server (`GET /routines?include_archived=true`)
3. Clear local Dexie and bulk-put the fresh data
4. This ensures frontend and server are always in sync

**Fix (backend):** When deleting a routine, we now set `routine_id = NULL` on all sessions referencing it **before** deleting. This:
- Prevents foreign key constraint errors
- Preserves session history (sessions still exist, just unlinked)

#### 8. No Resume for Archived Routines (Sessions.tsx)

The "Up Next" / "Resume" section now filters out archived routines:
```typescript
const nonArchivedRoutines = routines.filter(r => !r.archived_at);
const activeRoutine = nonArchivedRoutines.find(r => r.is_favorite) || nonArchivedRoutines[0];
```

This prevents users from starting or resuming sessions for an archived routine.

#### 9. Total Volume (Stats.tsx)

- Changed volume calculation from "this week" to **all-time total**
- Volume is computed for every completed session (not just current week)
- Label changed from `(This Week)` to `(Total)`
- Smart formatting preserved: `kg` → `t` (tonnes) → `kt` (kilotonnes)

#### 10. Docker Ready Check (Makefile)

Added `make ready` target:
```bash
make up && make ready
```

The `ready` target polls `http://localhost:8000/docs` once per second until the API responds, then prints:
```
✅ API is ready at http://localhost:8000
✅ Frontend is ready at http://localhost:5173
```

#### 11. Tests (test_routine_archive.py)

Added 3 new tests (total: **73 tests passing**):

| Test                                   | Description                                                            |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `test_delete_unlinks_sessions`         | Deleting a routine sets session.routine_id to NULL (history preserved) |
| `test_delete_without_archive_first`    | Direct delete (without archiving first) works correctly                |
| `test_multiple_archive_restore_cycles` | 3 archive/restore cycles don't corrupt the routine state               |

---

### Files Modified

| File                                    | Changes                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `frontend/src/pages/ActiveSession.tsx`  | Full rewrite: NumberStepper, auto-advance, help tooltip      |
| `frontend/src/pages/Sessions.tsx`       | Help tooltip, filter archived routines from active selection |
| `frontend/src/pages/Routines.tsx`       | Help tooltip, server re-fetch after archive/restore/delete   |
| `frontend/src/pages/RoutineDetails.tsx` | Lock help text fix                                           |
| `frontend/src/pages/Stats.tsx`          | Total volume calculation, no-routine spacing fix             |
| `backend/app/routers/routines.py`       | Delete now unlinks sessions (SET routine_id = NULL)          |
| `backend/tests/test_routine_archive.py` | 3 new tests                                                  |
| `Makefile`                              | Added `make ready` target                                    |
| `report.md`                             | This file                                                    |

---

### Test Results

```
======================== 73 passed, 1 warning in 20.05s ========================
```

All existing tests continue to pass. No regressions.

### IDE Lint Notes

All "Cannot find module" lint errors are cosmetic — they appear because `node_modules` are inside the Docker container, not on the host filesystem. The application compiles and runs correctly inside Docker.