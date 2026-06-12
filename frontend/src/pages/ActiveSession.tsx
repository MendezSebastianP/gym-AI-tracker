import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, Trash2, Lock, HelpCircle, X, Scale, Timer, Clock, Lightbulb, Flag, ChevronDown, ChevronsDownUp, CheckCheck, Check } from 'lucide-react';
import HybridNumber from '../components/HybridNumber';
import RestTimer from '../components/RestTimer';
import Stopwatch from '../components/Stopwatch';
import SuggestionBadge from '../components/SuggestionBadge';
import { useProgressionSuggestions } from '../hooks/useProgressionSuggestions';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestions';
import { api } from '../api/client';
import SessionElapsedTimer from '../components/SessionElapsedTimer';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import SessionFeed from './SessionFeed';
import { processSyncQueue } from '../db/sync';
import { K, Pencil } from '../components/kit';

// ─── Cardio helpers ─────────────────────────────────────────────────
function formatPace(secondsPerKm: number): string {
	if (!secondsPerKm || !isFinite(secondsPerKm)) return '--:--';
	const m = Math.floor(secondsPerKm / 60);
	const s = Math.round(secondsPerKm % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDurationMMSS(totalSec: number): string {
	if (!totalSec) return '0:00';
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Main Component ──────────────────────────────────────────────────
export default function ActiveSession() {
	const { id, routineName, index } = useParams();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [sessionId, setSessionId] = useState<number>(id ? parseInt(id) : 0);

	useEffect(() => {
		if (!id && routineName && index) {
			const resolveSession = async () => {
				const decodedName = decodeURIComponent(routineName);
				const r = await db.routines.filter(rout => rout.name === decodedName).first();
				const targetRoutineId = r ? r.id : undefined;

				const allSessions = await db.sessions.toArray();
				const matching = allSessions
					.filter(s => s.routine_id === targetRoutineId && s.completed_at)
					.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

				const n = parseInt(index);
				if (n > 0 && n <= matching.length) {
					setSessionId(matching[n - 1].id!);
				} else {
					navigate('/sessions'); // Fallback if not found
				}
			};
			resolveSession();
		} else if (id) {
			setSessionId(parseInt(id));
		}
	}, [id, routineName, index, navigate]);

	const editMode = searchParams.get('edit') === 'true';
	const { user, updateUser } = useAuthStore();
	const { t, i18n } = useTranslation();
	const [showHelp, setShowHelp] = useState(false);
	const [showEffortModal, setShowEffortModal] = useState(false);
	const [effortRating, setEffortRating] = useState<number | null>(7);

	const failureTrackingEnabled = !!user?.settings?.failure_tracking_enabled;
	const dropSetsEnabled = !!user?.settings?.drop_sets_enabled;
	const effortTrackingEnabled = !!user?.settings?.effort_tracking_enabled;
	const maxDropSets = Math.max(1, Math.min(2, Number(user?.settings?.max_drop_sets) || 1));

	const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
	const routine = useLiveQuery(
		async () => (session?.routine_id ? (await db.routines.get(session.routine_id)) ?? null : null),
		[session?.routine_id]
	);

	const sets = useLiveQuery(
		() => db.sets.where('session_id').equals(sessionId).toArray(),
		[sessionId]
	);

	const [exercises, setExercises] = useState<any[]>([]);
	const [collapsedExercises, setCollapsedExercises] = useState<number[]>([]);
	const [showRestTimer, setShowRestTimer] = useState(false);
	const [showStopwatch, setShowStopwatch] = useState(false);
	// is_done is persisted on each set row via Dexie + backend.
	// Computed below from `sets`; no in-memory mirror.
	const prefillDone = useRef(false);
	useEffect(() => { prefillDone.current = false; }, [sessionId]);

	// Progression suggestions
	const progressionSuggestions = useProgressionSuggestions(routine?.id, session?.day_index);
	const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());

	// Body weight tracking
	const [bwOpen, setBwOpen] = useState(false);
	const [bwValue, setBwValue] = useState<number>(0);
	const bwInitialized = useRef(false);
	const bwTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Edit-mode bodyweight: local state prevents controlled-input re-render mid-typing
	const [bwEditText, setBwEditText] = useState('');
	const bwEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const bwEditInitRef = useRef(false);
	useEffect(() => {
		if (editMode && !bwEditInitRef.current && session) {
			setBwEditText(String((session as any).bodyweight_kg ?? ''));
			bwEditInitRef.current = true;
		}
		if (!editMode) bwEditInitRef.current = false;
	}, [editMode, session?.id]);

	useEffect(() => {
		if (bwInitialized.current || !user) return;
		bwInitialized.current = true;
		// Load last weight or user profile weight
		api.get('/weight?days=7').then(res => {
			if (res.data.length > 0) {
				setBwValue(res.data[0].weight_kg);
				// Already logged today? Keep collapsed
				const today = new Date().toDateString();
				const lastDate = new Date(res.data[0].measured_at).toDateString();
				setBwOpen(lastDate !== today);
			} else {
				setBwValue(user.weight || 70);
				setBwOpen(true);
			}
		}).catch(() => {
			setBwValue(user.weight || 70);
		});
	}, [user]);

	// Block pull-to-refresh on mobile (swipe gestures can trigger it)
	useEffect(() => {
		const prev = document.body.style.overscrollBehavior;
		document.body.style.overscrollBehavior = 'none';
		document.documentElement.style.overscrollBehavior = 'none';
		return () => {
			document.body.style.overscrollBehavior = prev;
			document.documentElement.style.overscrollBehavior = '';
		};
	}, []);

	useEffect(() => {
		if (!showEffortModal) return;
		const prevBodyOverflow = document.body.style.overflow;
		const prevHtmlOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prevBodyOverflow;
			document.documentElement.style.overflow = prevHtmlOverflow;
		};
	}, [showEffortModal]);

	const saveBw = (val: number) => {
		setBwValue(val);
		if (bwTimeout.current) clearTimeout(bwTimeout.current);
		bwTimeout.current = setTimeout(async () => {
			try {
				const currentSession = await db.sessions.get(sessionId);
				if (currentSession?.weight_log_id) {
					await api.put(`/weight/${currentSession.weight_log_id}`, {
						weight_kg: val,
						measured_at: currentSession.started_at,
					});
					await db.sessions.update(sessionId, {
						bodyweight_kg: val,
						syncStatus: 'updated' as any,
					});
				} else {
					const res = await api.post('/weight', {
						weight_kg: val,
						measured_at: currentSession?.started_at || session?.started_at,
					});
					await db.sessions.update(sessionId, {
						bodyweight_kg: val,
						weight_log_id: res.data.id,
						syncStatus: 'updated' as any,
					});
				}
			} catch { /* offline — weight log skipped */ }
		}, 1000);
	};

	// ─── Pre-fill sets from previous session or routine defaults ──
	useEffect(() => {
		const prefillSets = async () => {
			if (prefillDone.current) return;
			if (!routine || !session || !sets || session.day_index === undefined) return;

			// NEVER prefill into a completed session — that rewrites history.
			// (See: opening an old session with an empty Dexie cache was treating
			//  every routine exercise as "missing" and overwriting the past.)
			if (session.completed_at) return;

			const day = routine.days[session.day_index];
			if (!day || !day.exercises || day.exercises.length === 0) return;

			// Lock out concurrent calls before any async work
			prefillDone.current = true;

			// Query Dexie directly for a fresh snapshot — the reactive `sets` state can be
			// transiently empty if syncUserData is mid-flight, which would incorrectly
			// trigger a double-prefill and add sets from the previous session.
			let freshSets = await db.sets.where('session_id').equals(sessionId).toArray();

			// iOS Safari evicts IndexedDB when memory-pressured. If the session was
			// already synced (has server_id) but Dexie has zero local sets, the
			// authoritative state lives on the server — re-hydrate before deciding
			// what's "missing", otherwise we'd overwrite the user's real progress
			// with values from the previous session.
			if (session.server_id && freshSets.length === 0 && navigator.onLine) {
				try {
					const res = await api.get(`/sessions/${session.server_id}`);
					const serverSets: any[] = res.data?.sets || [];
					if (serverSets.length > 0) {
						// Re-check Dexie immediately before insert: syncUserData may have raced
						// us and already added some of these sets. Filter to only the ones we
						// don't have yet (matched by server_id) to avoid duplicates.
						const alreadyLocal = await db.sets.where('session_id').equals(sessionId).toArray();
						const existingServerIds = new Set(alreadyLocal.map((s: any) => s.server_id).filter(Boolean));
						const hydrated = serverSets
							.filter((s: any) => !existingServerIds.has(s.id))
							.map((s: any) => ({
								session_id: sessionId,
								server_id: s.id,
								exercise_id: s.exercise_id,
								set_number: s.set_number,
								weight_kg: s.weight_kg ?? 0,
								reps: s.reps ?? 0,
								duration_sec: s.duration_sec,
								distance_km: s.distance_km,
								avg_pace: s.avg_pace,
								incline: s.incline,
								set_type: s.set_type || 'normal',
								to_failure: !!s.to_failure,
								is_done: !!s.is_done,
								completed_at: s.completed_at || session.started_at,
								syncStatus: 'synced' as any,
							}));
						if (hydrated.length > 0) {
							await db.sets.bulkAdd(hydrated);
						}
						freshSets = await db.sets.where('session_id').equals(sessionId).toArray();
					}
				} catch { /* offline / 404 — fall through to defaults */ }
			}

			const missingExercises = day.exercises.filter((ex: any) => !freshSets.some((s: any) => s.exercise_id === ex.exercise_id));
			if (missingExercises.length === 0) {
				return;
			}

			const exerciseIds = day.exercises.map((e: any) => e.exercise_id);
			const exerciseDetails = await db.exercises.bulkGet(exerciseIds);
			const detailsMap = new Map();
			exerciseDetails.forEach((ed: any) => { if (ed) detailsMap.set(ed.id, ed); });

			// Find previous sessions for this routine to pre-fill from
			let previousSets: any[] = [];
			const previousSessions = await db.sessions
				.where('routine_id')
				.equals(routine.id)
				.filter(s => !!s.completed_at && s.id !== sessionId && s.day_index === session.day_index)
				.sortBy('started_at');

			if (previousSessions && previousSessions.length > 0) {
				// sortBy returns ascending — take the last (most recent)
				const lastSession = previousSessions[previousSessions.length - 1];
				previousSets = await db.sets
					.where('session_id')
					.equals(lastSession.id!)
					.toArray();
			}

			// If no local data (sync hasn't run yet), fall back to server
			if (previousSets.length === 0 && navigator.onLine) {
				try {
					const res = await api.get(`/sessions?routine_id=${routine.id}&limit=5`);
					const serverPrev = (res.data as any[])
						.filter((s: any) => s.completed_at && s.id !== session.server_id && s.day_index === session.day_index)
						.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
					if (serverPrev.length > 0) {
						previousSets = serverPrev[0].sets || [];
					}
				} catch { /* offline or error — proceed with defaults */ }
			}

			const newSets: any[] = [];

			for (const ex of missingExercises) {
				const isLocked = ex.locked === true;
				const prevExSets = previousSets
					.filter((s: any) => s.exercise_id === ex.exercise_id)
					.sort((a: any, b: any) => a.set_number - b.set_number);
				const prevNormalSets = prevExSets.filter((s: any) => (s.set_type || 'normal') === 'normal');
				const detail = detailsMap.get(ex.exercise_id);
				const defaultWeightDb = (detail as any)?.default_weight_kg || 0;
				const isTime = detail?.type === 'Time';
				const isCardio = detail?.type === 'Cardio';
				const targetSetCount = isCardio ? 1 : Math.max(1, ex.sets || prevNormalSets.length || 3);

				if (isLocked) {
					const numSets = targetSetCount;
					const defaultReps = (isTime || isCardio) ? 0 : (typeof ex.reps === 'string' ? parseInt(ex.reps.split('-')[0]) || 10 : ex.reps || 10);
					const defaultWeight = (isTime || isCardio) ? 0 : (ex.weight_kg || defaultWeightDb || 0);

					for (let i = 1; i <= numSets; i++) {
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: i,
							weight_kg: defaultWeight,
							reps: defaultReps,
							duration_sec: (isTime || isCardio) ? 0 : undefined,
							distance_km: isCardio ? 0 : undefined,
							avg_pace: undefined,
							incline: isCardio ? undefined : undefined,
							completed_at: new Date().toISOString(),
							set_type: 'normal',
							to_failure: false,
							syncStatus: 'created'
						});
					}
				} else if (prevNormalSets.length > 0) {
					for (let i = 0; i < targetSetCount; i++) {
						const prevSet = prevNormalSets[i] || prevNormalSets[prevNormalSets.length - 1];
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: i + 1,
							weight_kg: prevSet.weight_kg ?? (ex.weight_kg || 0),
							reps: prevSet.reps || ((ex.reps && !isNaN(parseInt(ex.reps))) ? parseInt(ex.reps.split('-')[0]) : 0),
							duration_sec: (isTime || isCardio) ? (prevSet.duration_sec || 0) : undefined,
							distance_km: isCardio ? (prevSet.distance_km || 0) : undefined,
							avg_pace: isCardio ? (prevSet.avg_pace || undefined) : undefined,
							incline: isCardio ? (prevSet.incline || undefined) : undefined,
							completed_at: new Date().toISOString(),
							set_type: 'normal',
							to_failure: false,
							syncStatus: 'created'
						});
					}
				} else {
					const numSets = targetSetCount;
					const defaultReps = (isTime || isCardio) ? 0 : (typeof ex.reps === 'string' ? parseInt(ex.reps.split('-')[0]) || 10 : ex.reps || 10);
					const defaultWeight = (isTime || isCardio) ? 0 : (ex.weight_kg || defaultWeightDb || 0);

					for (let i = 1; i <= numSets; i++) {
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: i,
							weight_kg: defaultWeight,
							reps: defaultReps,
							duration_sec: (isTime || isCardio) ? 0 : undefined,
							distance_km: isCardio ? 0 : undefined,
							avg_pace: undefined,
							incline: isCardio ? undefined : undefined,
							completed_at: new Date().toISOString(),
							set_type: 'normal',
							to_failure: false,
							syncStatus: 'created'
						});
					}
				}
			}

			if (newSets.length > 0) {
				await db.sets.bulkAdd(newSets);
			}
		};

		prefillSets();
	}, [routine, session, sets, sessionId]);

	// Flush pending set changes to server when user backgrounds the app
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden' && session && !session.completed_at) {
				processSyncQueue().catch(() => {});
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [session]);

	// Load collapsed exercises
	useEffect(() => {
		if (session?.locked_exercises) {
			setCollapsedExercises(session.locked_exercises);
		}
	}, [session]);

	// Fetch exercise details and resolve translations
	useEffect(() => {
		if (routine && session && session.day_index !== undefined) {
			const day = routine.days[session.day_index];
			if (day) {
				const ids = day.exercises.map((e: any) => e.exercise_id);
				db.exercises.bulkGet(ids).then(exerciseDetails => {
					const currentLang = i18n.language.split('-')[0];
					const detailsMap = new Map<number, any>();
					exerciseDetails.forEach((d: any) => { if (d) detailsMap.set(d.id, d); });

					const enriched = day.exercises.map((e: any) => {
						const detail = detailsMap.get(e.exercise_id);
						const translatedName = detail?.name_translations?.[currentLang] || detail?.name || e.name || 'Unknown';

						return {
							...e,
							name: translatedName,
							is_bodyweight: detail?.is_bodyweight || false,
							type: detail?.type || 'Strength',
							muscle: detail?.muscle || null,
							muscle_group: detail?.muscle_group || null,
							equipment: (detail as any)?.equipment_translations?.[currentLang] || detail?.equipment || null,
						};
					});
					setExercises(enriched);
				});
			}
		}
	}, [routine, session, i18n.language]);

	const completeSession = async (selfRatedEffort: number | null) => {
		if (!session) return;
		const end = new Date().toISOString();
		const newSyncStatus = session.server_id ? 'updated' : 'created';
		const updates: any = {
			completed_at: end,
			syncStatus: newSyncStatus,
			self_rated_effort: selfRatedEffort,
		};
		// Save duration when track_time is enabled
		if (user?.settings?.track_time && session.started_at) {
			updates.duration_seconds = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
		}
		await db.sessions.update(sessionId, updates);

		try {
			await processSyncQueue();
		} catch (e) {
			console.error("Sync on finish failed", e);
		}

		if (navigator.onLine) {
			try {
				const me = await api.get('/auth/me');
				updateUser(me.data);
				await db.users.put(me.data).catch(() => {});
			} catch (e) {
				console.error('Failed to refresh user after finishing session', e);
			}
		}

		navigate('/sessions');
	};

	const finishSession = async () => {
		if (effortTrackingEnabled) {
			setShowEffortModal(true);
			return;
		}
		await completeSession(null);
	};

	const updateSet = async (setId: number, field: string, value: any) => {
		const updates: any = { [field]: value, syncStatus: 'updated' };
		// Auto-calculate pace for cardio when distance or duration changes
		if (field === 'distance_km' || field === 'duration_sec') {
			const currentSet = await db.sets.get(setId);
			if (currentSet) {
				const dist = field === 'distance_km' ? value : (currentSet.distance_km || 0);
				const dur = field === 'duration_sec' ? value : (currentSet.duration_sec || 0);
				updates.avg_pace = dist > 0 ? Math.round(dur / dist) : undefined;
			}
		}
		await db.sets.update(setId, updates);
	};

	const renumberExerciseSets = async (exerciseId: number) => {
		await db.transaction('rw', db.sets, async () => {
			const exerciseSets = await db.sets
				.where('[session_id+exercise_id]')
				.equals([sessionId, exerciseId])
				.sortBy('set_number');

			for (let i = 0; i < exerciseSets.length; i++) {
				const setRow = exerciseSets[i];
				const nextNumber = i + 1;
				if (setRow.set_number !== nextNumber) {
					await db.sets.update(setRow.id!, {
						set_number: nextNumber,
						syncStatus: setRow.server_id ? 'updated' : (setRow.syncStatus || 'created'),
					});
				}
			}
		});
	};

	const deleteSet = async (setId: number) => {
		const setToDelete = await db.sets.get(setId);
		await db.sets.delete(setId);
		if (setToDelete?.exercise_id) {
			await renumberExerciseSets(setToDelete.exercise_id);
		}
	};

	const addSet = async (exerciseId: number, setType: 'normal' | 'drop' = 'normal') => {
		const ex = exercises.find((e: any) => e.exercise_id === exerciseId);
		const isTime = ex?.type === 'Time';
		const isCardio = ex?.type === 'Cardio';

		// Run the whole "read existing → compute → insert → renumber" cycle
		// inside a Dexie transaction. This is the only safe shape — reading
		// from the reactive `sets` state can race with sync writes and produce
		// duplicate set_numbers (the regression that came back from prod).
		await db.transaction('rw', db.sets, async () => {
			const existingSets = await db.sets
				.where('[session_id+exercise_id]')
				.equals([sessionId, exerciseId])
				.sortBy('set_number');

			const dropCount = existingSets.filter((s: any) => (s.set_type || 'normal') === 'drop').length;
			if (setType === 'drop' && dropCount >= maxDropSets) return;

			const normalSets = existingSets.filter((s: any) => (s.set_type || 'normal') === 'normal');
			const firstWorking = normalSets[0];
			const lastWorking = normalSets[normalSets.length - 1];

			const baseWeight = isTime || isCardio
				? 0
				: setType === 'drop'
					? (lastWorking?.weight_kg || 0) * 0.75
					: (lastWorking?.weight_kg || firstWorking?.weight_kg || 0);
			const baseReps = isTime || isCardio
				? 0
				: (lastWorking?.reps || firstWorking?.reps || 10);

			const roundedWeight = Math.max(0, Math.round(baseWeight * 2) / 2);
			const lastNormalIndex = existingSets.reduce(
				(idx: number, s: any, i: number) => ((s.set_type || 'normal') === 'normal' ? i : idx),
				-1
			);
			const insertIndex = setType === 'normal'
				? (lastNormalIndex === -1 ? existingSets.length : lastNormalIndex + 1)
				: existingSets.length;

			const setDraft: any = {
				session_id: sessionId,
				exercise_id: exerciseId,
				weight_kg: roundedWeight,
				reps: baseReps,
				duration_sec: (isTime || isCardio) ? 0 : undefined,
				distance_km: isCardio ? 0 : undefined,
				completed_at: new Date().toISOString(),
				set_type: setType,
				to_failure: false,
				is_done: false,
				syncStatus: 'created',
			};

			const merged = [...existingSets];
			merged.splice(insertIndex, 0, setDraft);

			for (let i = 0; i < merged.length; i++) {
				const item = merged[i];
				const setNumber = i + 1;
				if (item.id) {
					if (item.set_number !== setNumber) {
						await db.sets.update(item.id, {
							set_number: setNumber,
							syncStatus: item.server_id ? 'updated' : (item.syncStatus || 'created'),
						});
					}
				} else {
					await db.sets.add({ ...item, set_number: setNumber });
				}
			}
		});
	};

	const toggleCollapse = async (exerciseId: number) => {
		const newCollapsed = collapsedExercises.includes(exerciseId)
			? collapsedExercises.filter((id: number) => id !== exerciseId)
			: [...collapsedExercises, exerciseId];

		setCollapsedExercises(newCollapsed);
		// Mark session as updated so the change syncs AND syncUserData preserves
		// it on the next pull (otherwise server's stale value overwrites locally
		// when the page reloads after iOS Safari backgrounds the tab).
		await db.sessions.update(sessionId, {
			locked_exercises: newCollapsed,
			syncStatus: 'updated' as any,
		});
	};

	// is_done helpers — persist to Dexie (and via sync to backend) so the
	// state survives leaving the session or an iPhone Dexie eviction.
	const setSetDone = async (setId: number, value: boolean) => {
		await db.sets.update(setId, { is_done: value, syncStatus: 'updated' as any });
	};

	const setExerciseDone = async (exerciseId: number, value: boolean) => {
		await db.transaction('rw', db.sets, async () => {
			const exSets = await db.sets
				.where('[session_id+exercise_id]')
				.equals([sessionId, exerciseId])
				.toArray();
			for (const s of exSets) {
				if (!!s.is_done !== value) {
					await db.sets.update(s.id!, { is_done: value, syncStatus: 'updated' as any });
				}
			}
		});
		// Collapse on done, expand on undo.
		const currentlyCollapsed = collapsedExercises.includes(exerciseId);
		if (value && !currentlyCollapsed) {
			await toggleCollapse(exerciseId);
		} else if (!value && currentlyCollapsed) {
			await toggleCollapse(exerciseId);
		}
	};

	const setAllDone = async (value: boolean) => {
		await db.transaction('rw', db.sets, async () => {
			const allSessionSets = await db.sets.where('session_id').equals(sessionId).toArray();
			for (const s of allSessionSets) {
				if (!!s.is_done !== value) {
					await db.sets.update(s.id!, { is_done: value, syncStatus: 'updated' as any });
				}
			}
		});
		const allExIds = exercises.map((e: any) => e.exercise_id);
		const nextCollapsed = value ? allExIds : [];
		setCollapsedExercises(nextCollapsed);
		await db.sessions.update(sessionId, {
			locked_exercises: nextCollapsed,
			syncStatus: 'updated' as any,
		});
	};

	const applySuggestion = (ex: any, suggestion: ProgressionSuggestion) => {
		const exerciseSetsForApply = sets?.filter((s: any) => s.exercise_id === ex.exercise_id) || [];
		const isSwap = (suggestion.type === 'exercise_swap' || suggestion.type === 'bw_progression') && suggestion.new_exercise_id;

		if (isSwap) {
			// Swap exercise_id on all session sets for this exercise
			exerciseSetsForApply.forEach((s: any) => {
				db.sets.update(s.id!, { exercise_id: suggestion.new_exercise_id, syncStatus: 'updated' as any });
			});
		} else {
			// Regular weight / reps update
			exerciseSetsForApply.forEach((s: any) => {
				if (suggestion.suggested.weight !== undefined) {
					db.sets.update(s.id!, { weight_kg: suggestion.suggested.weight, syncStatus: 'updated' as any });
				}
				if (suggestion.suggested.reps !== undefined) {
					const repsVal = typeof suggestion.suggested.reps === 'string'
						? parseInt(suggestion.suggested.reps.split('-')[0]) || 0
						: suggestion.suggested.reps;
					db.sets.update(s.id!, { reps: repsVal, syncStatus: 'updated' as any });
				}
			});
		}

		// Update routine definition
		if (routine && session?.day_index !== undefined) {
			const updatedDays = JSON.parse(JSON.stringify(routine.days));
			const dayExercises = updatedDays[session.day_index]?.exercises;
			if (dayExercises) {
				const routineExIdx = dayExercises.findIndex((e: any) => e.exercise_id === ex.exercise_id);
				if (routineExIdx >= 0) {
					if (isSwap) {
						dayExercises[routineExIdx] = {
							...dayExercises[routineExIdx],
							exercise_id: suggestion.new_exercise_id,
							...(suggestion.suggested.weight !== undefined ? { weight_kg: suggestion.suggested.weight } : {}),
							...(suggestion.suggested.reps !== undefined ? { reps: String(suggestion.suggested.reps) } : {}),
							...(suggestion.suggested.sets !== undefined ? { sets: suggestion.suggested.sets } : {}),
						};
					} else {
						const routineEx = dayExercises[routineExIdx];
						if (suggestion.suggested.weight !== undefined) routineEx.weight_kg = suggestion.suggested.weight;
						if (suggestion.suggested.reps !== undefined) routineEx.reps = String(suggestion.suggested.reps);
						if (suggestion.suggested.sets !== undefined) routineEx.sets = suggestion.suggested.sets;
					}
				}
			}
			db.routines.update(routine.id!, { days: updatedDays, syncStatus: 'updated' as any });
			api.put(`/routines/${routine.id}`, { days: updatedDays }).catch(() => { });
		}
		// Save feedback
		api.post('/progression/feedback', {
			exercise_id: ex.exercise_id,
			suggestion_type: suggestion.type,
			suggested_value: suggestion.suggested,
			action: 'accepted',
			applied_value: suggestion.suggested,
		}).catch(() => { });
		setDismissedSuggestions(prev => new Set([...prev, ex.exercise_id]));
	};

	const dismissSuggestion = (ex: any) => {
		const sugg = progressionSuggestions.suggestions.get(ex.exercise_id);
		if (sugg) {
			api.post('/progression/feedback', {
				exercise_id: ex.exercise_id,
				suggestion_type: sugg.type,
				suggested_value: sugg.suggested,
				action: 'rejected',
			}).catch(() => { });
		}
		setDismissedSuggestions(prev => new Set([...prev, ex.exercise_id]));
	};

	const isCompleted = !!session?.completed_at;
	const effortValue = Math.max(1, Math.min(10, effortRating ?? 7));
	const effortTone = effortValue <= 3 ? t('Easy') : effortValue <= 6 ? t('Moderate') : effortValue <= 8 ? t('Hard') : t('All out');

	const getSessionDuration = () => {
		if ((session as any)?.duration_seconds && (session as any).duration_seconds > 0) {
			return Math.round((session as any).duration_seconds / 60);
		}
		if (!session?.started_at || !session?.completed_at) return null;
		const start = new Date(session.started_at).getTime();
		const end = new Date(session.completed_at).getTime();
		const durationMin = Math.round((end - start) / 60000);
		return durationMin;
	};

	if (!session) {
		return (
			<div className="container">
				<div className="mono" style={{ padding: '80px 0', textAlign: 'center', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	// ─── Completed session in browse mode → show feed ─────────────
	if (isCompleted && !editMode) {
		return <SessionFeed targetSessionId={sessionId} />;
	}

	// From here on the session is editable (live, or completed in edit mode).
	const dayName = routine?.days?.[session.day_index || 0]?.day_name || `${t('Day')} ${(session.day_index || 0) + 1}`;
	const allExIds = exercises.map((e: any) => e.exercise_id);
	const allCollapsed = allExIds.length > 0 && allExIds.every((exId: number) => collapsedExercises.includes(exId));
	const allSessionSets = sets || [];
	const doneSets = allSessionSets.filter((s: any) => !!s.is_done).length;
	const totalSets = allSessionSets.length;
	const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
	const globalAllDone = totalSets > 0 && doneSets === totalSets;

	const deleteActiveSession = async () => {
		if (!confirm(t('Are you sure you want to delete this active session?'))) return;
		if (session.server_id) {
			try {
				await api.delete(`/sessions/${session.server_id}`);
			} catch (e) {
				// Queue delete for retry when back online
				await db.syncQueue.add({
					event_type: 'delete_session',
					payload: { server_id: session.server_id },
					client_timestamp: new Date().toISOString(),
					processed: false,
				});
			}
		}
		await db.sets.where('session_id').equals(sessionId).delete();
		await db.sessions.delete(sessionId);
		navigate('/sessions');
	};

	const suggestionState = (() => {
		const { loading, fetched, suggestions } = progressionSuggestions;
		const visibleCount = [...suggestions.keys()].filter(exId => !dismissedSuggestions.has(exId)).length;
		return { loading, fetched, visibleCount, hide: fetched && visibleCount === 0 };
	})();

	return (
		<>
			<div className="container" style={{ paddingBottom: isCompleted ? 24 : 110 }}>
				{/* ── Editing a completed session ── */}
				{isCompleted && editMode && (
					<div className="card" style={{ marginTop: 'calc(18px + env(safe-area-inset-top, 0px))', borderColor: 'color-mix(in oklab, var(--lime) 30%, transparent)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<span style={{ fontWeight: 800, fontSize: 16, flex: 1, letterSpacing: '-0.01em' }}>{t('Editing completed session')}</span>
							<button className="done-pill on" onClick={() => navigate(`/sessions/${sessionId}`)}>
								<Check size={13} />{t('Done')}
							</button>
						</div>

						<div className="field">
							<label>{t('Duration (minutes)')}</label>
							<input
								type="number"
								value={(session as any).duration_seconds ? Math.round((session as any).duration_seconds / 60) : ''}
								placeholder={t('Not tracked')}
								onChange={async (e) => {
									const mins = parseInt(e.target.value);
									const seconds = isNaN(mins) ? null : mins * 60;
									await db.sessions.update(sessionId, {
										duration_seconds: seconds,
										syncStatus: 'updated'
									} as any);
								}}
							/>
						</div>

						<div className="field">
							<label>{t('Date & Time')}</label>
							<input
								type="datetime-local"
								value={session.started_at ? new Date(new Date(session.started_at).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
								onChange={async (e) => {
									if (!e.target.value) return;
									const newDate = new Date(e.target.value);

									const oldStart = new Date(session.started_at);
									const oldEnd = session.completed_at ? new Date(session.completed_at) : null;
									const duration = oldEnd ? oldEnd.getTime() - oldStart.getTime() : 0;

									const newStartIso = newDate.toISOString();
									const newEndIso = oldEnd ? new Date(newDate.getTime() + duration).toISOString() : null;

									await db.sessions.update(sessionId, {
										started_at: newStartIso,
										completed_at: newEndIso,
										syncStatus: 'updated'
									});
									// Keep weight log date in sync when session date changes
									const updatedSession = await db.sessions.get(sessionId);
									if (updatedSession?.weight_log_id) {
										api.put(`/weight/${updatedSession.weight_log_id}`, {
											weight_kg: updatedSession.bodyweight_kg,
											measured_at: newStartIso,
										}).catch(() => { });
									}
								}}
							/>
						</div>

						{/* Body weight editor — local state + debounce avoids mid-typing re-render race */}
						<div className="field">
							<label>{t('Body Weight (kg)')}</label>
							<input
								type="number"
								inputMode="decimal"
								value={bwEditText}
								placeholder={t('Not logged')}
								onChange={(e) => {
									setBwEditText(e.target.value);
									const captured = e.target.value;
									if (bwEditTimeout.current) clearTimeout(bwEditTimeout.current);
									bwEditTimeout.current = setTimeout(async () => {
										const val = parseFloat(captured);
										const bwVal = isNaN(val) ? null : val;
										await db.sessions.update(sessionId, { bodyweight_kg: bwVal, syncStatus: 'updated' } as any);
										if (session.server_id) {
											try {
												await api.put(`/sessions/${session.server_id}`, { bodyweight_kg: bwVal });
												if (bwVal != null) updateUser({ weight: Math.round(bwVal) });
											} catch { /* offline */ }
										}
									}, 600);
								}}
							/>
						</div>
					</div>
				)}

				{/* ── Header ── */}
				<header style={{ padding: `calc(${isCompleted ? '8px' : '18px'} + ${isCompleted ? '0px' : 'env(safe-area-inset-top, 0px)'}) 0 0` }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
						<button className="icon-btn" onClick={() => navigate('/sessions')} aria-label={t('Back')}>
							<ArrowLeft size={20} />
						</button>
						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
								{routine?.name || t('Session')}
							</div>
							<div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
								{dayName} · {exercises.length} {t('exercises')}
								{isCompleted && getSessionDuration() !== null ? ` · ${getSessionDuration()} min` : ''}
							</div>
						</div>
						{!isCompleted && <SessionElapsedTimer startTime={session.started_at} />}
						<button className="icon-btn sm" onClick={() => setShowHelp(!showHelp)} aria-label={t('Help')}>
							<HelpCircle size={18} />
						</button>
						{!isCompleted && (
							<button className="icon-btn sm danger" onClick={deleteActiveSession} aria-label={t('Discard')}>
								<Trash2 size={16} />
							</button>
						)}
					</div>

					{/* tools */}
					{!isCompleted && (
						<div className="tools">
							<button
								className={`tool-chip ${showRestTimer ? 'on' : ''}`}
								onClick={() => { setShowRestTimer(!showRestTimer); if (!showRestTimer) setShowStopwatch(false); }}
							>
								<Timer size={15} />{t('Rest')}
							</button>
							<button
								className={`tool-chip ${showStopwatch ? 'on' : ''}`}
								onClick={() => { setShowStopwatch(!showStopwatch); if (!showStopwatch) setShowRestTimer(false); }}
							>
								<Clock size={15} />{t('Stopwatch')}
							</button>
							{routine && !suggestionState.hide && (
								<button
									className={`tool-chip ${suggestionState.fetched ? 'on' : ''}`}
									disabled={suggestionState.loading}
									style={suggestionState.loading ? { opacity: 0.7, cursor: 'wait' } : undefined}
									onClick={async () => {
										await progressionSuggestions.fetch();
										// Collapse all so suggestion badges are immediately visible
										setCollapsedExercises(allExIds);
									}}
								>
									<Lightbulb size={15} />
									{suggestionState.loading
										? t('Checking')
										: suggestionState.fetched
											? `${suggestionState.visibleCount} ${suggestionState.visibleCount === 1 ? t('suggestion') : t('suggestions')}`
											: t('Suggestions')}
								</button>
							)}
							{exercises.length > 1 && (
								<button className="tool-chip" onClick={() => setCollapsedExercises(allCollapsed ? [] : allExIds)}>
									<ChevronsDownUp size={15} />
									{allCollapsed ? t('Expand all') : t('Collapse all')}
								</button>
							)}
							{exercises.length > 1 && (
								<button className={`tool-chip ${globalAllDone ? 'on' : ''}`} onClick={() => setAllDone(!globalAllDone)}>
									<CheckCheck size={15} />
									{globalAllDone ? t('Undo') : t('All done')}
								</button>
							)}
						</div>
					)}

					{/* progress */}
					{!isCompleted && totalSets > 0 && (
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
							<div className="meter"><span style={{ width: `${pct}%` }} /></div>
							<span className="mono num" style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
								{doneSets}/{totalSets} {t('done')}
							</span>
						</div>
					)}
				</header>

				{showHelp && (
					<div className="coach" style={{ marginTop: 12, position: 'relative' }}>
						<span className="badge"><HelpCircle size={15} /></span>
						<div style={{ paddingRight: 18 }}>
							<b>{t('How sessions work')}</b>
							<p>
								{t('Drag a number up/down to change it. Single tap opens a scroll wheel. Double-tap to type.')}{' '}
								{t('Tap the circle on each set to mark it done. Tap "All done" to complete an exercise.')}{' '}
								{t('Tap an exercise name to collapse/expand it.')}{' '}
								{t('"Rest" starts a countdown timer. "Stopwatch" counts up — both keep running if you navigate away.')}{' '}
								{t('Tap "Finish" when your workout is done.')}
							</p>
						</div>
						<button
							onClick={() => setShowHelp(false)}
							style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
							aria-label={t('Close')}
						>
							<X size={14} />
						</button>
					</div>
				)}

				{showRestTimer && !isCompleted && (
					<div style={{ marginTop: 10 }}>
						<RestTimer defaultTime={90} />
					</div>
				)}
				{showStopwatch && !isCompleted && (
					<div style={{ marginTop: 10 }}>
						<Stopwatch />
					</div>
				)}

				<div className="sec-label" style={{ margin: '16px 2px 11px' }}>
					<span className="mono">{t('Today')} · {exercises.length} {t('exercises')}</span>
					<Pencil />
				</div>

				{/* ── Exercise cards ── */}
				{exercises.map((ex: any, i: number) => {
					const exerciseSets = sets?.filter((s: any) => s.exercise_id === ex.exercise_id).sort((a: any, b: any) => a.set_number - b.set_number) || [];
					const dropSets = exerciseSets.filter((s: any) => (s.set_type || 'normal') === 'drop');
					const supportsSetTypes = ex.type !== 'Cardio' && ex.type !== 'Time';
					const isCollapsed = collapsedExercises.includes(ex.exercise_id);
					const isExerciseLocked = ex.locked === true;
					const exDoneCount = exerciseSets.filter((s: any) => !!s.is_done).length;
					const isExAllDone = exerciseSets.length > 0 && exDoneCount === exerciseSets.length;
					const armedIdx = exerciseSets.findIndex((s: any) => !s.is_done);
					const isCardio = ex.type === 'Cardio';
					const isTime = ex.type === 'Time';

					const gridCols = isCardio
						? `40px 1fr 1fr 1fr${failureTrackingEnabled ? ' 38px' : ''} 28px`
						: isTime
							? `40px 1fr${failureTrackingEnabled ? ' 38px' : ''} 28px`
							: `40px 1fr 1fr${failureTrackingEnabled ? ' 38px' : ''} 28px`;

					const suggestion = progressionSuggestions.fetched && !dismissedSuggestions.has(ex.exercise_id)
						? progressionSuggestions.suggestions.get(ex.exercise_id)
						: undefined;

					const metaTags = (
						<div className="ex-meta">
							{ex.equipment && ex.equipment !== 'None' && ex.equipment !== 'none' && <span className="tag">{ex.equipment}</span>}
							{ex.muscle && <span className="tag">{ex.muscle}</span>}
							{ex.is_bodyweight && <span className="tag">{t('Bodyweight')}</span>}
							{isExerciseLocked && (
								<span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
									<Lock size={9} />{t('Locked')}
								</span>
							)}
							{exDoneCount > 0 && !isExAllDone && (
								<span className="mono num" style={{ fontSize: 9.5, color: 'var(--lime)' }}>
									{exDoneCount}/{exerciseSets.length}
								</span>
							)}
						</div>
					);

					// ── Collapsed card ──
					if (isCollapsed) {
						const first = exerciseSets[0];
						return (
							<div
								key={i}
								className="card flush"
								style={{
									marginBottom: 12,
									borderColor: isExAllDone ? 'color-mix(in oklab, var(--lime) 26%, transparent)' : undefined,
								}}
							>
								<div style={{ padding: 14, cursor: 'pointer' }} onClick={() => toggleCollapse(ex.exercise_id)}>
									<div className="ex-toprow">
										<div style={{ flex: 1, minWidth: 0 }}>
											<span
												className={`ex-name ${isExAllDone ? 'struck' : ''}`}
												style={{ fontSize: 16, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
											>
												{ex.name}
												{isExAllDone && <span className="strike" />}
											</span>
										</div>
										<button
											className={`done-pill ${isExAllDone ? 'on' : ''}`}
											onClick={(e) => { e.stopPropagation(); setExerciseDone(ex.exercise_id, !isExAllDone); }}
										>
											{isExAllDone && <Check size={13} />}
											{isExAllDone ? t('Done') : t('All done')}
										</button>
										<button className="expand-btn" onClick={(e) => { e.stopPropagation(); toggleCollapse(ex.exercise_id); }}>
											{t('Expand')}<ChevronDown size={13} />
										</button>
									</div>
									<div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
										{metaTags}
										{suggestion && (
											<SuggestionBadge
												suggestion={suggestion}
												exerciseName={ex.name}
												onApply={(sugg: ProgressionSuggestion) => applySuggestion(ex, sugg)}
												onDismiss={() => dismissSuggestion(ex)}
											/>
										)}
									</div>
									{exerciseSets.length > 0 && first && (
										<div className="ex-sumline num">
											<b>{exerciseSets.length} {t('sets')}</b>
											<span className="x">
												{isCardio
													? `${first.distance_km || 0} km · ${formatDurationMMSS(first.duration_sec || 0)}`
													: isTime
														? `${first.duration_sec || 0}s`
														: `${first.weight_kg || 0} kg${first.reps ? ` × ${first.reps}` : ''}`}
											</span>
										</div>
									)}
								</div>
							</div>
						);
					}

					// ── Expanded card ──
					return (
						<div key={i} className="card flush" style={{ marginBottom: 12 }}>
							<div className="ex-head" style={{ paddingBottom: 8, cursor: 'pointer' }} onClick={() => toggleCollapse(ex.exercise_id)}>
								<div className="ex-thumb" style={{ width: 40, height: 40 }}><K.dumbbell width={20} height={20} /></div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<span className="ex-name" style={{ fontSize: 15.5 }}>{ex.name}</span>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
										{metaTags}
										{suggestion && (
											<span onClick={(e) => e.stopPropagation()}>
												<SuggestionBadge
													suggestion={suggestion}
													exerciseName={ex.name}
													onApply={(sugg: ProgressionSuggestion) => applySuggestion(ex, sugg)}
													onDismiss={() => dismissSuggestion(ex)}
												/>
											</span>
										)}
									</div>
								</div>
								<button className="expand-btn open" onClick={(e) => { e.stopPropagation(); toggleCollapse(ex.exercise_id); }} aria-label={t('Collapse')}>
									<ChevronDown size={13} />
								</button>
							</div>

							<div className="set-tablehdr" style={{ gridTemplateColumns: gridCols }}>
								<span>{t('Set')}</span>
								{isCardio ? (
									<>
										<span>km</span>
										<span>{t('Time')}</span>
										<span>{t('Incline')}</span>
									</>
								) : isTime ? (
									<span>{t('Seconds')}</span>
								) : (
									<>
										<span>{ex.is_bodyweight ? '+kg' : 'kg'}</span>
										<span>{t('Reps')}</span>
									</>
								)}
								{failureTrackingEnabled && <span>{t('Fail')}</span>}
								<span></span>
							</div>

							{exerciseSets.map((s: any, si: number) => {
								const setDone = !!s.is_done;
								const setType = s.set_type || 'normal';
								const isWarmup = setType === 'warmup';
								const isDrop = setType === 'drop';
								return (
									<div key={s.id}>
										<div className={`set-row ${si === armedIdx ? 'armed' : ''}`} style={{ gridTemplateColumns: gridCols }}>
											<button
												className={`set-circle ${setDone ? 'done' : ''} ${isWarmup ? 'warm' : ''} ${isDrop ? 'drop' : ''}`}
												onClick={() => setSetDone(s.id!, !setDone)}
												aria-label={`${t('Set')} ${s.set_number}`}
											>
												{setDone ? <Check size={15} /> : isWarmup ? 'W' : isDrop ? 'D' : s.set_number}
											</button>

											{isCardio ? (
												<>
													<HybridNumber value={s.distance_km || 0} onChange={(v) => updateSet(s.id!, 'distance_km', v)} step={0.1} min={0} max={200} sensitivity={14} showDelta={false} />
													<HybridNumber value={s.duration_sec || 0} onChange={(v) => updateSet(s.id!, 'duration_sec', v)} step={30} min={0} max={36000} sensitivity={28} showDelta={false} />
													<HybridNumber value={s.incline || 0} onChange={(v) => updateSet(s.id!, 'incline', v)} step={0.5} min={0} max={30} sensitivity={14} showDelta={false} />
												</>
											) : isTime ? (
												<HybridNumber value={s.duration_sec || 0} onChange={(v) => updateSet(s.id!, 'duration_sec', v)} step={5} min={0} max={3600} sensitivity={28} showDelta={false} />
											) : (
												<>
													<HybridNumber value={s.weight_kg || 0} onChange={(v) => updateSet(s.id!, 'weight_kg', v)} step={ex.is_bodyweight ? 1 : 2.5} min={0} max={9999} sensitivity={14} />
													<HybridNumber value={s.reps || 0} onChange={(v) => updateSet(s.id!, 'reps', v)} step={1} min={0} max={100} sensitivity={28} />
												</>
											)}

											{failureTrackingEnabled && (
												<button
													className={`fbtn ${s.to_failure ? 'on' : ''}`}
													onClick={() => updateSet(s.id!, 'to_failure', !s.to_failure)}
													aria-label={t('To failure')}
												>
													F
												</button>
											)}
											<button className="del-btn" onClick={() => deleteSet(s.id!)} aria-label={t('Delete')}>
												<Trash2 size={16} />
											</button>
										</div>
										{isCardio && s.distance_km > 0 && s.duration_sec > 0 && (
											<div className="mono num" style={{ fontSize: 9, color: 'var(--text-4)', textAlign: 'center', padding: '2px 0 5px' }}>
												{t('Pace')}: {formatPace(s.duration_sec / s.distance_km)} /km
											</div>
										)}
									</div>
								);
							})}

							<div className="card-actions">
								<button className="ghost-btn add" onClick={() => addSet(ex.exercise_id)}>
									+ {isCardio ? t('Add Interval') : t('Add Set')}
								</button>
								{dropSetsEnabled && supportsSetTypes && dropSets.length < maxDropSets && (
									<button className="ghost-btn drop" onClick={() => addSet(ex.exercise_id, 'drop')}>
										{t('Drop set')}
									</button>
								)}
							</div>
						</div>
					);
				})}

				{exercises.some((e: any) => e.type !== 'Cardio' && e.type !== 'Time') && (
					<div className="hint" style={{ margin: '2px 0 8px' }}>
						{t('Drag to scrub · double-tap to type · tap ● to complete')}
					</div>
				)}

				{/* Body Weight (optional) */}
				{!isCompleted && (
					<div style={{ marginTop: 14 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: bwOpen ? 11 : 0 }}>
							<button className="bw-pill" onClick={() => setBwOpen(!bwOpen)} style={{ border: 'none', cursor: 'pointer' }}>
								<Scale size={13} />
								{t('Body Weight')}{!bwOpen && bwValue > 0 ? ` · ${bwValue} kg` : ''}
							</button>
						</div>
						{bwOpen && (
							<>
								<div className="bw-field">
									<div style={{ flex: '0 0 130px' }}>
										<HybridNumber value={bwValue} onChange={saveBw} step={0.5} min={0} max={300} sensitivity={14} showDelta={false} />
									</div>
									<div className="bw-delta">{t('Logged with this session')}</div>
								</div>
								<div className="hint">{t('Drag to adjust · double-tap to type')}</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* ── Fixed finish footer — portaled: route-scene transforms/filters
			       would otherwise turn position:fixed into page-relative ── */}
			{!isCompleted && createPortal(
				<div
					className="session-footer"
					style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) - 12px)', paddingBottom: 12 }}
				>
					<div className="session-footer-inner">
						<div className={`finish-wrap ${pct >= 100 ? 'complete' : ''}`} style={{ ['--p' as any]: pct }}>
							<button className="finish-btn" onClick={finishSession}>
								<Flag size={17} />
								{pct >= 100 ? t('Finish — all sets logged') : t('Finish session')}
							</button>
						</div>
					</div>
				</div>,
				document.body
			)}

			{/* ── Finish / effort sheet ── */}
			{showEffortModal && createPortal(
				<div className="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) setShowEffortModal(false); }}>
					<div className="sheet">
						<div className="sheet-grab" />
						<h3>{t('Finish session')}</h3>
						<p className="sub">
							{doneSets}/{totalSets} {t('sets')}
							{bwValue > 0 ? ` · ${bwValue} kg` : ''} — {t('rate the effort (optional)')}
						</p>
						<div className="effort-readout">
							<div className="effort-num num">{effortValue}</div>
							<div className="effort-word">{effortTone}</div>
						</div>
						<input
							className="effort-slider"
							type="range"
							min={1}
							max={10}
							step={1}
							value={effortValue}
							onChange={(e) => setEffortRating(parseInt(e.target.value, 10))}
						/>
						<div className="effort-scale">
							<span>{t('Easy')}</span>
							<span>{t('Moderate')}</span>
							<span>{t('Hard')}</span>
							<span>{t('All out')}</span>
						</div>
						<div className="sheet-actions">
							<button className="sheet-btn sec" onClick={() => setShowEffortModal(false)}>
								{t('Keep going')}
							</button>
							<button
								className="sheet-btn primary"
								onClick={async () => {
									setShowEffortModal(false);
									await completeSession(effortValue);
								}}
							>
								<Flag size={15} />{t('Save session')}
							</button>
						</div>
						<button
							className="link-quiet"
							style={{ display: 'block', margin: '12px auto 0' }}
							onClick={async () => {
								setShowEffortModal(false);
								await completeSession(null);
							}}
						>
							{t('Skip rating')}
						</button>
					</div>
				</div>,
				document.body
			)}
		</>
	);
}
