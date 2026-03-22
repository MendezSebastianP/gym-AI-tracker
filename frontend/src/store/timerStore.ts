/**
 * Module-level timer state — survives page navigation (React unmount/remount).
 * Uses wall-clock timestamps so timers keep counting even when components are unmounted.
 */

// ── Rest Timer ────────────────────────────────────────────────────────────────
interface RestTimerState {
	total: number;
	remainingAtStart: number; // remaining seconds when last started
	startedAt: number | null; // Date.now() when last started (null if paused/stopped)
	finished: boolean;
}

const restTimer: RestTimerState = {
	total: 90,
	remainingAtStart: 90,
	startedAt: null,
	finished: false,
};

export function getRestTimerState() {
	// Compute live remaining
	let remaining = restTimer.remainingAtStart;
	if (restTimer.startedAt !== null && !restTimer.finished) {
		remaining = Math.max(0, restTimer.remainingAtStart - Math.floor((Date.now() - restTimer.startedAt) / 1000));
		if (remaining === 0 && !restTimer.finished) {
			restTimer.finished = true;
			restTimer.startedAt = null;
		}
	}
	return {
		total: restTimer.total,
		remaining,
		running: restTimer.startedAt !== null && !restTimer.finished,
		finished: remaining === 0 && restTimer.remainingAtStart > 0,
	};
}

export function restTimerStart() {
	const { remaining } = getRestTimerState();
	if (remaining <= 0) return; // use reset first
	restTimer.remainingAtStart = remaining;
	restTimer.startedAt = Date.now();
	restTimer.finished = false;
}

export function restTimerPause() {
	const { remaining } = getRestTimerState();
	restTimer.remainingAtStart = remaining;
	restTimer.startedAt = null;
}

export function restTimerSkip() {
	restTimer.startedAt = null;
	restTimer.remainingAtStart = 0;
	restTimer.finished = true;
}

export function restTimerReset(total?: number) {
	if (total !== undefined) restTimer.total = total;
	restTimer.remainingAtStart = restTimer.total;
	restTimer.startedAt = null;
	restTimer.finished = false;
}

export function restTimerSetTotal(newTotal: number) {
	restTimer.total = newTotal;
	restTimer.remainingAtStart = newTotal;
	restTimer.startedAt = null;
	restTimer.finished = false;
}

export function restTimerAdjust(delta: number) {
	const { remaining, running } = getRestTimerState();
	const newTime = Math.max(15, Math.min(600, (running ? remaining : restTimer.total) + delta));
	if (running) {
		restTimer.remainingAtStart = newTime;
		restTimer.startedAt = Date.now(); // reset the start reference
		restTimer.total = Math.max(15, Math.min(600, restTimer.total + delta));
	} else {
		restTimerSetTotal(newTime);
	}
}

// ── Stopwatch ─────────────────────────────────────────────────────────────────
interface StopwatchState {
	elapsedAtStart: number; // elapsed seconds when last started/paused
	startedAt: number | null; // Date.now() when last started
}

const stopwatch: StopwatchState = {
	elapsedAtStart: 0,
	startedAt: null,
};

export function getStopwatchState() {
	let elapsed = stopwatch.elapsedAtStart;
	if (stopwatch.startedAt !== null) {
		elapsed = stopwatch.elapsedAtStart + Math.floor((Date.now() - stopwatch.startedAt) / 1000);
	}
	return {
		elapsed,
		running: stopwatch.startedAt !== null,
	};
}

export function stopwatchStart() {
	if (stopwatch.startedAt !== null) return; // already running
	stopwatch.startedAt = Date.now();
}

export function stopwatchPause() {
	const { elapsed } = getStopwatchState();
	stopwatch.elapsedAtStart = elapsed;
	stopwatch.startedAt = null;
}

export function stopwatchReset() {
	stopwatch.elapsedAtStart = 0;
	stopwatch.startedAt = null;
}
