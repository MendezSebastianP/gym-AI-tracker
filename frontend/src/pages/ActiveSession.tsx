import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, CheckCircle, Trash2, Lock, Edit, Calendar, HelpCircle, X, Scale, ChevronDown, ChevronUp, Check, Timer, Clock } from 'lucide-react';
import HybridNumber from '../components/HybridNumber';
import RestTimer from '../components/RestTimer';
import Stopwatch from '../components/Stopwatch';
import CheckSuggestionsButton from '../components/CheckSuggestionsButton';
import SuggestionBadge from '../components/SuggestionBadge';
import { useProgressionSuggestions } from '../hooks/useProgressionSuggestions';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestions';
import { api } from '../api/client';
import SessionElapsedTimer from '../components/SessionElapsedTimer';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import SessionFeed from './SessionFeed';
import { processSyncQueue } from '../db/sync';

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
		() => session?.routine_id ? db.routines.get(session.routine_id) : Promise.resolve(null),
		[session?.routine_id]
	);

	const sets = useLiveQuery(
		() => db.sets.where('session_id').equals(sessionId).toArray(),
		[sessionId]
	);


	const [exercises, setExercises] = useState<any[]>([]);
	const [startTime, setStartTime] = useState<number | null>(null);
	const [collapsedExercises, setCollapsedExercises] = useState<number[]>([]);
	const [showRestTimer, setShowRestTimer] = useState(false);
	const [showStopwatch, setShowStopwatch] = useState(false);
	const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
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

	// ─── Auto-advance helper ──────────────────────────────────────
	// Each input gets an id like "set-{setId}-weight" or "set-{setId}-reps"
	// After editing weight → focus reps of same set
	// After editing reps → focus weight of next set (or next exercise first set)
	const focusNext = useCallback((currentSetId: number, currentField: 'weight' | 'reps') => {
		if (!sets) return;
		if (currentField === 'weight') {
			// Go to reps of same set
			const el = document.getElementById(`set-${currentSetId}-reps`);
			if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); }
		} else {
			// currentField === 'reps' → go to weight of next set
			const sortedSets = [...sets].sort((a, b) => {
				const exA = exercises.findIndex((e: any) => e.exercise_id === a.exercise_id);
				const exB = exercises.findIndex((e: any) => e.exercise_id === b.exercise_id);
				if (exA !== exB) return exA - exB;
				return a.set_number - b.set_number;
			});
			const idx = sortedSets.findIndex(s => s.id === currentSetId);
			if (idx >= 0 && idx < sortedSets.length - 1) {
				const nextSet = sortedSets[idx + 1];
				const el = document.getElementById(`set-${nextSet.id}-weight`);
				if (el) { (el as HTMLInputElement).focus(); (el as HTMLInputElement).select(); }
			}
		}
	}, [sets, exercises]);

	// ─── Pre-fill sets from previous session or routine defaults ──
	useEffect(() => {
		const prefillSets = async () => {
			if (prefillDone.current) return;
			if (!routine || !session || !sets || session.day_index === undefined) return;

			const day = routine.days[session.day_index];
			if (!day || !day.exercises || day.exercises.length === 0) return;

			// Lock out concurrent calls before any async work
			prefillDone.current = true;

			// Query Dexie directly for a fresh snapshot — the reactive `sets` state can be
			// transiently empty if syncUserData is mid-flight, which would incorrectly
			// trigger a double-prefill and add sets from the previous session.
			const freshSets = await db.sets.where('session_id').equals(sessionId).toArray();
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
			setStartTime(new Date(session.started_at).getTime());
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
		const exerciseSets = await db.sets
			.where('session_id')
			.equals(sessionId)
			.and((s: any) => s.exercise_id === exerciseId)
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
	};

	const deleteSet = async (setId: number) => {
		const setToDelete = await db.sets.get(setId);
		await db.sets.delete(setId);
		if (setToDelete?.exercise_id) {
			await renumberExerciseSets(setToDelete.exercise_id);
		}
	};

	const addSet = async (exerciseId: number, setType: 'normal' | 'drop' = 'normal') => {
		const existingSets = [...(sets?.filter((s: any) => s.exercise_id === exerciseId) || [])]
			.sort((a: any, b: any) => a.set_number - b.set_number);

		const dropCount = existingSets.filter((s: any) => (s.set_type || 'normal') === 'drop').length;
		if (setType === 'drop' && dropCount >= maxDropSets) return;

		const ex = exercises.find((e: any) => e.exercise_id === exerciseId);
		const isTime = ex?.type === 'Time';
		const isCardio = ex?.type === 'Cardio';
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
			syncStatus: 'created',
		};

		const merged = [...existingSets];
		merged.splice(insertIndex, 0, setDraft);

		for (let i = 0; i < merged.length; i++) {
			const item = merged[i];
			const setNumber = i + 1;
			if (item.id) {
				await db.sets.update(item.id, {
					set_number: setNumber,
					syncStatus: item.server_id ? 'updated' : (item.syncStatus || 'created'),
				});
			} else {
				await db.sets.add({ ...item, set_number: setNumber });
			}
		}
	};

	const toggleCollapse = async (exerciseId: number) => {
		const newCollapsed = collapsedExercises.includes(exerciseId)
			? collapsedExercises.filter((id: number) => id !== exerciseId)
			: [...collapsedExercises, exerciseId];

		setCollapsedExercises(newCollapsed);
		await db.sessions.update(sessionId, { locked_exercises: newCollapsed });
	};

	const isCompleted = !!session?.completed_at;
	const isEditable = !isCompleted || editMode;
	const effortValue = Math.max(1, Math.min(10, effortRating ?? 7));
	const effortTone = effortValue <= 3 ? 'Easy' : effortValue <= 6 ? 'Moderate' : effortValue <= 8 ? 'Hard' : 'All out';

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

	if (!session) return <div className="container">Loading session...</div>;

	// ─── Completed session in browse mode → show feed ─────────────
	if (isCompleted && !editMode) {
		return <SessionFeed targetSessionId={sessionId} />;
	}

	return (
		<>
		<div className="container fade-in" style={{ paddingBottom: '100px' }}>
			{isCompleted && editMode && (
				<div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--text-primary)', padding: '16px', marginBottom: '16px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
						<span style={{ fontWeight: 'bold' }}>✏️ {t('Editing completed session')}</span>
						<button
							className="btn btn-ghost"
							onClick={() => navigate(`/sessions/${sessionId}`)}
							style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
						>
							{t('Done')}
						</button>
					</div>

					{/* Duration editor */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
						<label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('Duration (minutes)')}</label>
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
							className="input"
							style={{ width: '100%', fontSize: '14px', padding: '12px' }}
						/>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('Date & Time')}</label>
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
							className="input"
							style={{ width: '100%', fontSize: '14px', padding: '12px' }}
						/>
					</div>

					{/* Body weight editor — local state + debounce avoids mid-typing re-render race */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
						<label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('Body Weight (kg)')}</label>
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
							className="input"
							style={{ width: '100%', fontSize: '14px', padding: '12px' }}
						/>
					</div>
				</div>
			)}

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-primary)', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
				<div style={{ display: 'flex', alignItems: 'center' }}>
					<button className="btn btn-ghost" onClick={() => navigate('/sessions')} style={{ paddingLeft: 0, marginRight: '8px' }}>
						<ArrowLeft size={24} />
					</button>
					<div>
						<h2 style={{ fontSize: '16px', margin: 0, fontWeight: 'bold' }}>
							{routine?.name || t('Session')}
						</h2>
						{!isCompleted && (
							<SessionElapsedTimer startTime={session.started_at} />
						)}
						{isCompleted && (
							<div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
								<Calendar size={12} />
								<span>{new Date(session.started_at).toLocaleDateString()}</span>
								{getSessionDuration() !== null && (
									<>
										<span>•</span>
										<span>{getSessionDuration()} min</span>
									</>
								)}
							</div>
						)}
					</div>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
					{/* Help tooltip button */}
					<button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: '6px' }}>
						<HelpCircle size={18} color="var(--text-tertiary)" />
					</button>
					{isEditable && !isCompleted && (
						<button
							className="btn btn-ghost"
							onClick={async () => {
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
							}}
							style={{ padding: '6px', color: 'var(--error)' }}
						>
							<Trash2 size={18} />
						</button>
					)}
					{isEditable && !isCompleted && (
						<button className="btn btn-primary motion-btn motion-btn--session is-finish" onClick={finishSession} style={{ padding: '8px 16px', fontSize: '14px' }}>
							{t('Finish')}
						</button>
					)}
				</div>
			</div>

			{/* Help tooltip */}
			{showHelp && (
				<div style={{
					background: 'var(--bg-tertiary)',
					padding: '12px 16px',
					borderRadius: '8px',
					fontSize: '13px',
					color: 'var(--text-secondary)',
					border: '1px solid rgba(99, 102, 241, 0.3)',
					marginBottom: '16px',
					lineHeight: '1.5',
					position: 'relative'
				}}>
					<button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
						<X size={14} />
					</button>
					<strong style={{ color: 'var(--text-primary)' }}>{t('How sessions work')}</strong><br />
					{t('Drag a number up/down to change it. Single tap opens a scroll wheel. Double-tap to type.')}<br />
					{t('Tap the circle on each set to mark it done. Tap "All done" to complete an exercise.')}<br />
					{t('Tap an exercise name to collapse/expand it.')}<br />
					{t('"Rest" starts a countdown timer. "Stopwatch" counts up — both keep running if you navigate away.')}<br />
					{t('Tap "Finish" when your workout is done.')}
				</div>
			)}

			{/* Toolbar: Rest Timer, Stopwatch, Suggestions, Collapse all, All done */}
			{isEditable && !isCompleted && (() => {
				const allExIds = exercises.map((e: any) => e.exercise_id);
				const allCollapsed = allExIds.every((id: number) => collapsedExercises.includes(id));
				const allSetKeys = sets?.map((s: any) => `${s.id}`) || [];
				const globalAllDone = allSetKeys.length > 0 && allSetKeys.every((k: string) => completedSets.has(k));
				const compactBtn: React.CSSProperties = {
					padding: '6px 10px', borderRadius: 'var(--radius-sm)',
					fontSize: 12, fontWeight: 600,
					border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
					color: 'var(--text-secondary)', cursor: 'pointer',
					display: 'flex', alignItems: 'center', gap: 4,
					whiteSpace: 'nowrap',
				};

				return (
					<div style={{ marginBottom: 10 }}>
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
							<button
								onClick={() => { setShowRestTimer(!showRestTimer); if (!showRestTimer) setShowStopwatch(false); }}
								className="motion-btn motion-btn--session motion-btn--soft"
								style={{
									...compactBtn,
									background: showRestTimer ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
									border: showRestTimer ? '1px solid var(--primary-border)' : '1px solid var(--border)',
									color: showRestTimer ? 'var(--primary)' : 'var(--text-secondary)',
								}}
							>
								<Timer size={13} />
								{t('Rest')}
							</button>
							<button
								onClick={() => { setShowStopwatch(!showStopwatch); if (!showStopwatch) setShowRestTimer(false); }}
								className="motion-btn motion-btn--session motion-btn--soft"
								style={{
									...compactBtn,
									background: showStopwatch ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
									border: showStopwatch ? '1px solid var(--primary-border)' : '1px solid var(--border)',
									color: showStopwatch ? 'var(--primary)' : 'var(--text-secondary)',
								}}
							>
								<Clock size={13} />
								{t('Stopwatch')}
							</button>
							{routine && (() => {
								const { loading, fetched, suggestions } = progressionSuggestions;
								if (fetched && suggestions.size === 0) return null;
								return (
									<button
										onClick={async () => {
									await progressionSuggestions.fetch();
									// Collapse all so suggestion badges are immediately visible
									setCollapsedExercises(allExIds);
								}}
										disabled={loading}
										className={`motion-btn motion-btn--ai motion-btn--soft ${loading ? 'is-loading' : ''}`.trim()}
										style={{
											...compactBtn,
											color: fetched ? 'var(--accent)' : 'var(--text-secondary)',
											border: fetched ? '1px solid var(--accent)33' : '1px solid var(--border)',
											opacity: loading ? 0.7 : 1,
											cursor: loading ? 'wait' : 'pointer',
										}}
									>
										{loading ? '...' : fetched ? `${suggestions.size}` : '💡'}
										{loading ? t('Checking') : fetched ? (suggestions.size === 1 ? t('suggestion') : t('suggestions')) : t('Suggestions')}
									</button>
								);
							})()}
							{exercises.length > 1 && (
								<button
									onClick={() => {
										if (allCollapsed) setCollapsedExercises([]);
										else setCollapsedExercises(allExIds);
									}}
									className="motion-btn motion-btn--session motion-btn--soft"
									style={compactBtn}
								>
									{allCollapsed ? t('Expand all') : t('Collapse all')}
								</button>
							)}
							{exercises.length > 1 && (
								<button
									onClick={() => {
										if (globalAllDone) {
											setCompletedSets(new Set());
										} else {
											setCompletedSets(new Set(allSetKeys));
										}
									}}
									className="motion-btn motion-btn--session"
									style={{
										...compactBtn,
										border: globalAllDone ? '1px solid var(--success)' : '1px solid var(--border)',
										background: globalAllDone ? 'var(--success)' : 'var(--bg-tertiary)',
										color: globalAllDone ? 'white' : 'var(--text-secondary)',
										transition: 'all 0.15s',
									}}
								>
									{globalAllDone ? t('Undo') : t('All done')}
								</button>
							)}
						</div>
						{showRestTimer && (
							<div style={{ marginTop: 8 }}>
								<RestTimer defaultTime={90} />
							</div>
						)}
						{showStopwatch && (
							<div style={{ marginTop: 8 }}>
								<Stopwatch />
							</div>
						)}
					</div>
				);
			})()}

			<div style={{ display: 'grid', gap: '8px' }}>
				{exercises.map((ex: any, i: number) => {
					const exerciseSets = sets?.filter((s: any) => s.exercise_id === ex.exercise_id).sort((a: any, b: any) => a.set_number - b.set_number) || [];
					const dropSets = exerciseSets.filter((s: any) => (s.set_type || 'normal') === 'drop');
					const supportsSetTypes = ex.type !== 'Cardio' && ex.type !== 'Time';
					const isCollapsed = collapsedExercises.includes(ex.exercise_id);
					const isExerciseLocked = ex.locked === true;
					const exDoneCount = exerciseSets.filter((s: any) => completedSets.has(`${s.id}`)).length;
					const isExAllDone = exerciseSets.length > 0 && exDoneCount === exerciseSets.length;

					return (
						<div key={i} className="card" style={{
							overflow: 'hidden',
							padding: '10px 16px',
							borderColor: isExAllDone ? 'var(--success)' : undefined,
							background: isExAllDone ? 'rgba(0,204,68,0.06)' : undefined,
							transition: 'all 0.2s',
						}}>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: isCollapsed ? '0' : '6px',
									cursor: 'pointer',
								}}
								onClick={() => toggleCollapse(ex.exercise_id)}
							>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
										<h3 style={{ margin: 0, color: isExAllDone ? 'var(--success)' : undefined, textDecoration: isExAllDone ? 'line-through' : 'none' }}>{ex.name}</h3>
									{exDoneCount > 0 && !isExAllDone && (
										<span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
											{exDoneCount}/{exerciseSets.length}
										</span>
									)}
									{progressionSuggestions.fetched && progressionSuggestions.suggestions.has(ex.exercise_id) && !dismissedSuggestions.has(ex.exercise_id) && (
										<SuggestionBadge
											suggestion={progressionSuggestions.suggestions.get(ex.exercise_id)!}
											exerciseName={ex.name}
												onApply={(suggestion: ProgressionSuggestion) => {
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
											}}
											onDismiss={() => {
												api.post('/progression/feedback', {
													exercise_id: ex.exercise_id,
													suggestion_type: progressionSuggestions.suggestions.get(ex.exercise_id)!.type,
													suggested_value: progressionSuggestions.suggestions.get(ex.exercise_id)!.suggested,
													action: 'rejected',
												}).catch(() => { });
												setDismissedSuggestions(prev => new Set([...prev, ex.exercise_id]));
											}}
										/>
									)}
									{ex.is_bodyweight && <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{t('Bodyweight')}</span>}
									{isExerciseLocked && (
										<span style={{
											fontSize: '10px',
											background: 'rgba(99, 102, 241, 0.15)',
											padding: '2px 6px',
											borderRadius: '4px',
											color: 'var(--accent, #6366f1)',
											display: 'flex',
											alignItems: 'center',
											gap: '2px'
										}}>
											<Lock size={10} /> {t('Locked')}
										</span>
									)}
									</div>
									{(() => { const meta = [ex.equipment, ex.muscle].filter((v: any) => v && v !== 'None' && v !== 'none'); return meta.length > 0 ? (
										<div style={{ fontSize: '10px', color: 'var(--text-tertiary)', paddingLeft: '2px', marginTop: '1px' }}>
											{meta.join(' · ')}
										</div>
									) : null; })()}
								</div>
								{isEditable && (
									<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
										<button
											className={`motion-btn motion-btn--session ${isExAllDone ? '' : 'motion-btn--soft'}`.trim()}
											onClick={(e: any) => {
												e.stopPropagation();
												setCompletedSets(prev => {
													const next = new Set(prev);
													if (isExAllDone) {
														exerciseSets.forEach((s: any) => next.delete(`${s.id}`));
													} else {
														exerciseSets.forEach((s: any) => next.add(`${s.id}`));
													}
													return next;
												});
											}}
											style={{
												padding: '4px 10px',
												borderRadius: 'var(--radius-full)',
												border: isExAllDone ? '1px solid var(--success)' : '1px solid var(--border)',
												background: isExAllDone ? 'var(--success)' : 'var(--bg-tertiary)',
												color: isExAllDone ? 'white' : 'var(--text-secondary)',
												fontSize: 11, fontWeight: 700, cursor: 'pointer',
												display: 'flex', alignItems: 'center', gap: 4,
												transition: 'all 0.15s',
											}}
										>
											<Check size={12} />
											{isExAllDone ? t('Done') : t('All done')}
										</button>
										<button
											className="btn btn-ghost p-2"
											onClick={(e: any) => {
												e.stopPropagation();
												toggleCollapse(ex.exercise_id);
											}}
											style={{ fontSize: '12px' }}
										>
											{isCollapsed ? <>{t('Expand')}</> : <>{t('Collapse')}</>}
										</button>
									</div>
								)}
							</div>

							{!isCollapsed && (
								<>
									<div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.5px', padding: '0 8px', gap: '10px' }}>
										<span style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>{t('SET')}</span>
										{ex.type === 'Cardio' ? (
											<>
												<span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>DIST (km)</span>
												<span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>TIME</span>
												<span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>INCLINE</span>
											</>
										) : ex.type === 'Time' ? (
											<span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>{t('SECONDS')}</span>
										) : (
											<>
												<span style={{ flex: 1, textAlign: 'center', minWidth: '80px' }}>{ex.is_bodyweight ? '+KG' : 'KG'}</span>
												<span style={{ flex: 1, textAlign: 'center', minWidth: '80px' }}>{t('REPS')}</span>
											</>
										)}
										{isEditable && failureTrackingEnabled && (
											<span style={{ width: '68px', textAlign: 'center', flexShrink: 0 }}>FAILURE</span>
										)}
										<span style={{ width: isEditable ? '44px' : '40px', flexShrink: 0 }}></span>
									</div>

									{exerciseSets.map((s: any) => {
										const setDone = completedSets.has(`${s.id}`);
										const setType = s.set_type || 'normal';
										const isWarmup = setType === 'warmup';
										const isDrop = setType === 'drop';
										return (
												<div key={s.id}>
													<div style={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														padding: '6px 8px',
														backgroundColor: setDone ? 'rgba(0,204,68,0.08)' : 'rgba(0,0,0,0.2)',
													borderRadius: '4px',
													marginBottom: ex.type === 'Cardio' && s.distance_km > 0 && s.duration_sec > 0 ? '0' : '4px',
													gap: '4px',
													opacity: setDone ? 0.6 : 1,
														transition: 'all 0.15s',
														borderLeft: isWarmup ? '3px solid #60a5fa' : isDrop ? '3px solid #f59e0b' : undefined,
													}}>
														<div style={{ width: '56px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
															{isEditable ? (
																<div
																	onClick={() => setCompletedSets(prev => {
																		const next = new Set(prev);
																		const key = `${s.id}`;
																		if (next.has(key)) next.delete(key); else next.add(key);
																		return next;
																	})}
																	style={{
																		minWidth: isWarmup || isDrop ? 52 : 24,
																		height: 24,
																		padding: isWarmup || isDrop ? '0 8px' : 0,
																		borderRadius: isWarmup || isDrop ? '999px' : '50%',
																		flexShrink: 0,
																		border: setDone
																			? '2px solid var(--success)'
																			: isWarmup
																				? '1px solid rgba(96, 165, 250, 0.7)'
																				: isDrop
																					? '1px solid rgba(245, 158, 11, 0.7)'
																					: '2px solid var(--border)',
																		background: setDone
																			? 'var(--success)'
																			: isWarmup
																				? 'rgba(59,130,246,0.18)'
																				: isDrop
																					? 'rgba(245,158,11,0.18)'
																					: 'transparent',
																		display: 'flex', alignItems: 'center', justifyContent: 'center',
																		cursor: 'pointer', transition: 'all 0.15s',
																	}}
																>
																	{setDone ? (
																		<Check size={12} style={{ color: 'white' }} />
																	) : isWarmup ? (
																		<span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.4px', color: '#93c5fd' }}>WARM</span>
																	) : isDrop ? (
																		<span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.4px', color: '#fbbf24' }}>DROP</span>
																	) : (
																		<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>{s.set_number}</span>
																	)}
																</div>
															) : (
																<span style={{ width: '54px', fontWeight: 'bold', fontSize: '14px', display: 'inline-flex', justifyContent: 'center' }}>
																	{isWarmup ? (
																		<span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.4px', color: '#93c5fd' }}>WARM</span>
																	) : isDrop ? (
																		<span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.4px', color: '#fbbf24' }}>DROP</span>
																	) : (
																		s.set_number
																	)}
																</span>
															)}
														</div>

													{isEditable ? (
														<>
															{ex.type === 'Cardio' ? (
																<>
																	<HybridNumber
																		value={s.distance_km || 0}
																		onChange={(v) => updateSet(s.id!, 'distance_km', v)}
																		step={0.1}
																		min={0}
																		max={200}
																		sensitivity={14}
																		showDelta={false}
																		label="km"
																	/>
																	<HybridNumber
																		value={s.duration_sec || 0}
																		onChange={(v) => updateSet(s.id!, 'duration_sec', v)}
																		step={30}
																		min={0}
																		max={36000}
																		sensitivity={28}
																		showDelta={false}
																		label="sec"
																	/>
																	<HybridNumber
																		value={s.incline || 0}
																		onChange={(v) => updateSet(s.id!, 'incline', v)}
																		step={0.5}
																		min={0}
																		max={30}
																		sensitivity={14}
																		showDelta={false}
																		label="%"
																	/>
																</>
															) : ex.type === 'Time' ? (
																<HybridNumber
																	value={s.duration_sec || 0}
																	onChange={(v) => updateSet(s.id!, 'duration_sec', v)}
																	step={5}
																	min={0}
																	max={3600}
																	sensitivity={28}
																	showDelta={false}
																/>
																) : (
																		<>
																			<div style={{ flex: 1, minWidth: '80px', display: 'flex', justifyContent: 'center' }}>
																				<HybridNumber
																					value={s.weight_kg || 0}
																					onChange={(v) => updateSet(s.id!, 'weight_kg', v)}
																				step={ex.is_bodyweight ? 1 : 2.5}
																				min={0}
																				max={9999}
																				sensitivity={14}
																			/>
																		</div>
																			<div style={{ flex: 1, minWidth: '80px', display: 'flex', justifyContent: 'center' }}>
																				<HybridNumber
																					value={s.reps || 0}
																					onChange={(v) => updateSet(s.id!, 'reps', v)}
																				step={1}
																				min={0}
																				max={100}
																					sensitivity={28}
																				/>
																			</div>
																		</>
																	)}
																	{failureTrackingEnabled && (
																		<div style={{ width: '68px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
																			<button
																				className="btn btn-ghost"
																				onClick={() => updateSet(s.id!, 'to_failure', !s.to_failure)}
																				style={{
																					minWidth: '34px',
																					height: '34px',
																					display: 'flex',
																					alignItems: 'center',
																					justifyContent: 'center',
																					flexShrink: 0,
																					padding: 0,
																					fontWeight: 800,
																					fontSize: '12px',
																					borderRadius: '999px',
																					border: s.to_failure ? '1px solid rgba(248, 113, 113, 0.9)' : '1px solid var(--border)',
																					background: s.to_failure ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
																					color: s.to_failure ? '#f87171' : 'var(--text-tertiary)',
																				}}
																				title="Mark to failure"
																			>
																				F
																			</button>
																		</div>
																	)}
															<button
																className="btn btn-ghost"
																onClick={() => deleteSet(s.id!)}
																style={{ minWidth: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
															>
																<Trash2 size={20} style={{ color: 'var(--error)' }} />
															</button>
														</>
													) : (
														<>
															{ex.type === 'Cardio' ? (
																<>
																	<span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{s.distance_km || 0}</span>
																	<span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{formatDurationMMSS(s.duration_sec || 0)}</span>
																	<span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{s.incline || '-'}</span>
																</>
																) : ex.type === 'Time' ? (
																		<span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{s.duration_sec || 0}s</span>
																	) : (
																		<>
																			<span style={{ flex: 1, minWidth: '80px', textAlign: 'center' }}>{s.weight_kg}</span>
																			<span style={{ flex: 1, minWidth: '80px', textAlign: 'center' }}>{s.reps}</span>
																		</>
																	)}
															<span style={{ width: '40px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
																<CheckCircle size={16} color="var(--success)" />
															</span>
														</>
													)}
												</div>
												{ex.type === 'Cardio' && s.distance_km > 0 && s.duration_sec > 0 && (
													<div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '2px 0 6px', marginBottom: '4px' }}>
														Pace: {formatPace(s.duration_sec / s.distance_km)} /km
													</div>
												)}
											</div>
										);
									})}

									{isEditable && (
										<div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
										<button
											className="btn btn-secondary motion-btn motion-btn--session"
											onClick={() => addSet(ex.exercise_id)}
											style={{ width: '100%', fontSize: '14px', padding: '8px' }}
										>
												+ {ex.type === 'Cardio' ? t('Add Interval') : t('Add Set')}
											</button>
											{dropSetsEnabled && supportsSetTypes && dropSets.length < maxDropSets && (
												<button
													className="btn btn-ghost motion-btn motion-btn--session motion-btn--soft"
													onClick={() => addSet(ex.exercise_id, 'drop')}
													style={{
														width: '100%',
														padding: '7px 10px',
														fontSize: '12px',
														border: '1px dashed rgba(245, 158, 11, 0.7)',
														color: '#fbbf24',
														background: 'rgba(245, 158, 11, 0.08)',
													}}
												>
													+ Add Drop Set
												</button>
											)}
										</div>
									)}
								</>
							)}

							{isCollapsed && exerciseSets.length > 0 && (() => {
								const first = exerciseSets[0];
								return (
									<div style={{ padding: '6px 0 2px', fontSize: '13px', color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>
										<span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{exerciseSets.length} {t('sets')}</span>
										{ex.type === 'Cardio' ? (
											<span>{first.distance_km || 0} km · {first.duration_sec || 0}s</span>
										) : ex.type === 'Time' ? (
											<span>{first.duration_sec || 0}s</span>
										) : (
											<span>{first.weight_kg || 0} kg × {first.reps || 0}</span>
										)}
									</div>
								);
							})()}
						</div>
					);
				})}
			</div>

			{/* Hint text at bottom of exercises */}
			{isEditable && !isCompleted && exercises.some((e: any) => e.type !== 'Cardio' && e.type !== 'Time') && (
				<div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', padding: '4px 0 0' }}>
					drag &bull; tap=drum &bull; double-tap=type
				</div>
			)}


			{/* Body Weight (optional) */}
			{isEditable && !isCompleted && (
				<div style={{ marginTop: 8 }}>
					<button
						onClick={() => setBwOpen(!bwOpen)}
						style={{
							padding: '6px 10px', borderRadius: 'var(--radius-sm)',
							fontSize: 12, fontWeight: 600,
							border: bwOpen ? '1px solid var(--primary-border)' : '1px solid var(--border)',
							background: bwOpen ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
							color: bwOpen ? 'var(--primary)' : 'var(--text-secondary)',
							cursor: 'pointer',
							display: 'flex', alignItems: 'center', gap: 4,
							whiteSpace: 'nowrap',
						}}
					>
						<Scale size={13} />
						{t('Body Weight')}{!bwOpen && bwValue > 0 ? ` · ${bwValue} kg` : ''}
					</button>
					{bwOpen && (
						<div style={{ marginTop: 8, padding: '10px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
							<HybridNumber
								value={bwValue}
								onChange={saveBw}
								step={0.5}
								min={0}
								max={300}
								sensitivity={14}
								showDelta={false}
							/>
						</div>
					)}
				</div>
			)}

		</div>
		{showEffortModal && createPortal(
			<div
				style={{
					position: 'fixed',
					inset: 0,
					background: 'rgba(0,0,0,0.55)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 250,
					padding: '16px',
				}}
			>
				<div
					style={{
						width: '100%',
						maxWidth: '420px',
						background: 'var(--bg-secondary)',
						borderRadius: '18px',
						padding: '18px 14px 16px',
						border: '1px solid var(--border)',
					}}
				>
					<div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px', textAlign: 'center' }}>
						How hard was this session?
					</div>
					<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '14px' }}>
						1 = easy · 10 = all out
					</div>
					<div style={{ marginBottom: '14px' }}>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
							<span style={{ fontSize: '24px', fontWeight: 800, color: '#86efac' }}>{effortValue}</span>
							<span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{effortTone}</span>
						</div>
						<input
							type="range"
							min={1}
							max={10}
							step={1}
							value={effortValue}
							onChange={(e) => setEffortRating(parseInt(e.target.value, 10))}
							style={{
								width: '100%',
								accentColor: '#22c55e',
								cursor: 'pointer',
							}}
						/>
						<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
							<span>Easy</span>
							<span>All out</span>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', marginTop: '6px' }}>
							{Array.from({ length: 10 }, (_, i) => {
								const val = i + 1;
								const active = val === effortValue;
								return (
									<div
										key={val}
										style={{
											textAlign: 'center',
											fontSize: '10px',
											fontWeight: active ? 800 : 500,
											color: active ? '#86efac' : 'var(--text-tertiary)',
										}}
									>
										{val}
									</div>
								);
							})}
						</div>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
						<button
							className="btn btn-ghost"
							onClick={async () => {
								setShowEffortModal(false);
								await completeSession(null);
							}}
						>
							Skip
						</button>
						<button
							className="btn btn-primary"
							onClick={async () => {
								setShowEffortModal(false);
								await completeSession(effortValue);
							}}
						>
							Done
						</button>
					</div>
				</div>
			</div>
		, document.body)}
		</>
	);
}
