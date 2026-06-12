import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { api } from '../api/client';
import { ArrowLeft, Calendar, Clock, Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { K } from '../components/kit';

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

/** Best set summary shown at the right of each exercise header. */
function topSetLabel(ex: any, sets: any[]): string {
	if (sets.length === 0) return '';
	if (ex.type === 'Cardio') {
		const best = sets.reduce((a, b) => ((b.distance_km || 0) > (a.distance_km || 0) ? b : a));
		return best.distance_km ? `${best.distance_km} km` : '';
	}
	if (ex.type === 'Time') {
		const m = Math.max(...sets.map((s: any) => s.duration_sec || 0));
		return m > 0 ? `${m}s hold` : '';
	}
	const weighted = sets.filter((s: any) => s.weight_kg != null && s.weight_kg > 0);
	if (weighted.length === 0) {
		const m = Math.max(...sets.map((s: any) => s.reps || 0));
		return m > 0 ? `BW × ${m}` : '';
	}
	const best = weighted.reduce((a, b) => (b.weight_kg > a.weight_kg ? b : a));
	return `top ${best.weight_kg} × ${best.reps}`;
}

/** One logged set row inside an exercise block. */
function LogRow({ ex, s, idx }: { ex: any; s: any; idx: number }) {
	let wEl;
	let rEl;
	if (ex.type === 'Cardio' && s.distance_km) {
		wEl = <span className="log-w num">{s.distance_km}<small>km</small></span>;
		rEl = (
			<span className="log-r num">
				{formatDurationMMSS(s.duration_sec || 0)}
				{s.distance_km > 0 && s.duration_sec > 0 ? ` · ${formatPace(s.duration_sec / s.distance_km)} /km` : ''}
			</span>
		);
	} else if (ex.type === 'Time') {
		wEl = <span className="log-w num">{s.duration_sec || 0}<small>s</small></span>;
		rEl = <span className="log-r">hold</span>;
	} else if (s.weight_kg == null || s.weight_kg === 0) {
		wEl = <span className="log-w bw">BW</span>;
		rEl = <span className="log-r num"><span className="x">×</span>{s.reps} reps</span>;
	} else {
		wEl = <span className="log-w num">{s.weight_kg}<small>kg</small></span>;
		rEl = <span className="log-r num"><span className="x">×</span>{s.reps} reps</span>;
	}
	return (
		<div className="log-row">
			<span className="log-chk"><K.checkRing /></span>
			<span className="log-no num">{idx + 1}</span>
			{wEl}
			{rEl}
		</div>
	);
}

// ─── Single session card in the feed ─────────────────────────────────
function FeedCard({ sessionId, isTarget, allRoutines }: {
	sessionId: number;
	isTarget: boolean;
	allRoutines: any[];
}) {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();

	const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
	const sets = useLiveQuery(
		() => db.sets.where('session_id').equals(sessionId).toArray(),
		[sessionId]
	);

	// Fallback: if Dexie has the session but no sets for it (iOS Safari/Edge
	// can evict IndexedDB silently), fetch them from the server and hydrate.
	const hydratedRef = useRef(false);
	useEffect(() => {
		hydratedRef.current = false;
	}, [sessionId]);
	useEffect(() => {
		if (hydratedRef.current) return;
		if (!session || !sets) return;
		if (sets.length > 0) return;
		if (!session.server_id) return;
		if (typeof navigator !== 'undefined' && !navigator.onLine) return;
		hydratedRef.current = true;
		api.get(`/sessions/${session.server_id}`).then(async (res) => {
			const serverSets: any[] = res.data?.sets || [];
			if (serverSets.length === 0) return;
			const existing = await db.sets.where('session_id').equals(sessionId).toArray();
			const haveServerIds = new Set(existing.map((s: any) => s.server_id).filter(Boolean));
			const toAdd = serverSets
				.filter((srv: any) => !haveServerIds.has(srv.id))
				.map((srv: any) => ({
					server_id: srv.id,
					session_id: sessionId,
					exercise_id: srv.exercise_id,
					set_number: srv.set_number,
					weight_kg: srv.weight_kg,
					reps: srv.reps,
					duration_sec: srv.duration_sec,
					distance_km: srv.distance_km,
					avg_pace: srv.avg_pace,
					incline: srv.incline,
					set_type: srv.set_type || 'normal',
					to_failure: !!srv.to_failure,
					is_done: !!srv.is_done,
					completed_at: srv.completed_at,
					syncStatus: 'synced' as const,
				}));
			if (toAdd.length > 0) await db.sets.bulkAdd(toAdd as any);
		}).catch(() => { hydratedRef.current = false; });
	}, [session, sets, sessionId]);

	const [exercises, setExercises] = useState<any[]>([]);
	const [expandedExtraSets, setExpandedExtraSets] = useState<Record<number, boolean>>({});
	const [editingEffort, setEditingEffort] = useState(false);
	const [editEffortValue, setEditEffortValue] = useState<number>(7);

	const { user } = useAuthStore();
	const effortTrackingEnabled = !!user?.settings?.effort_tracking_enabled;

	const routine = allRoutines.find((r: any) => r.id === session?.routine_id);

	// Derive exercises from the sets table (what was actually performed),
	// NOT from the current routine definition, so editing the routine
	// won't retroactively change historical sessions.
	useEffect(() => {
		if (!sets || sets.length === 0) return;

		const seenIds = new Set<number>();
		const uniqueExIds: number[] = [];
		for (const s of sets.sort((a: any, b: any) => a.set_number - b.set_number)) {
			if (!seenIds.has(s.exercise_id)) {
				seenIds.add(s.exercise_id);
				uniqueExIds.push(s.exercise_id);
			}
		}

		const day = routine?.days?.[session?.day_index ?? -1];
		const routineOrder: number[] = day?.exercises?.map((e: any) => e.exercise_id) ?? [];
		const orderedExIds = routineOrder.length > 0
			? [
				...routineOrder.filter((id: number) => uniqueExIds.includes(id)),
				...uniqueExIds.filter((id: number) => !routineOrder.includes(id)),
			]
			: uniqueExIds;

		db.exercises.bulkGet(orderedExIds).then(details => {
			const currentLang = i18n.language.split('-')[0];
			const enriched = orderedExIds.map(id => {
				const detail = details.find(d => d?.id === id) as any;
				return {
					exercise_id: id,
					name: detail?.name_translations?.[currentLang] || detail?.name || 'Unknown',
					muscle: detail?.muscle_translations?.[currentLang] || detail?.muscle || '',
					equipment: detail?.equipment_translations?.[currentLang] || detail?.equipment || '',
					is_bodyweight: detail?.is_bodyweight || false,
					type: detail?.type || 'Strength',
				};
			});
			setExercises(enriched);
		});
	}, [sets, i18n.language, routine, session?.day_index]);

	useEffect(() => {
		if (session?.self_rated_effort != null) {
			setEditEffortValue(session.self_rated_effort);
		}
	}, [session?.self_rated_effort]);

	const effortTone = (v: number) => v <= 3 ? t('Easy') : v <= 6 ? t('Moderate') : v <= 8 ? t('Hard') : t('All out');

	const saveEffortRating = async () => {
		if (!session?.server_id) return;
		try {
			const res = await api.put(`/sessions/${session.server_id}`, {
				self_rated_effort: editEffortValue,
			});
			await db.sessions.update(sessionId, {
				self_rated_effort: editEffortValue,
				effort_score: res.data?.effort_score ?? null,
			});
			setEditingEffort(false);
		} catch (e) {
			console.error('Failed to save effort rating', e);
		}
	};

	if (!session || !sets) {
		return (
			<div className="hist-card">
				<div className="mono" style={{ textAlign: 'center', padding: 20, fontSize: 10, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	const dayName = routine?.days?.[session.day_index || 0]?.day_name || `${t('Day')} ${(session.day_index || 0) + 1}`;
	const dateStr = new Date(session.started_at).toLocaleDateString(i18n.language, {
		weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
	});
	const duration = (session as any).duration_seconds != null && (session as any).duration_seconds > 0
		? Math.round((session as any).duration_seconds / 60)
		: (session.started_at && session.completed_at
			? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
			: 0);

	const setsByExercise = new Map<number, any[]>();
	for (const s of sets) {
		const arr = setsByExercise.get(s.exercise_id) || [];
		arr.push(s);
		setsByExercise.set(s.exercise_id, arr);
	}

	const deleteExercise = async (exerciseId: number) => {
		if (!confirm(t('Remove this exercise from the session history?'))) return;
		const exSets = (sets || []).filter((s: any) => s.exercise_id === exerciseId);
		for (const s of exSets) {
			if (s.server_id) {
				try { await api.delete(`/sets/${s.server_id}`); } catch { /* best-effort */ }
			}
		}
		await db.sets
			.where('session_id').equals(sessionId)
			.and((s: any) => s.exercise_id === exerciseId)
			.delete();
	};

	const handleDelete = async () => {
		if (!confirm(t('Are you sure you want to delete this session? This cannot be undone.'))) return;
		if (session.server_id) {
			try {
				await api.delete(`/sessions/${session.server_id}`);
			} catch (e) {
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
		if (isTarget) {
			navigate('/sessions');
		}
	};

	return (
		<div className={`hist-card ${isTarget ? 'latest' : ''}`}>
			<div className="hc-head">
				<div className="hc-titlewrap">
					<div className="hc-eyebrow">
						<span className="hc-routine">{routine?.name || t('Session')}</span>
					</div>
					<div className="hc-day">{dayName}</div>
				</div>
				<button className="edit-btn" onClick={() => navigate(`/sessions/${sessionId}?edit=true`)}>
					<Edit2 size={13} />{t('Edit')}
				</button>
				<button
					onClick={handleDelete}
					aria-label={t('Delete')}
					style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: '8px 2px', flexShrink: 0 }}
				>
					<Trash2 size={16} />
				</button>
			</div>

			<div className="hc-meta">
				<span className="mi"><Calendar size={14} />{dateStr}</span>
				{duration > 0 && <span className="mi"><Clock size={14} /><span className="num">{duration} min</span></span>}
			</div>

			{effortTrackingEnabled && (
				!editingEffort ? (
					<button
						className="effort-pill"
						onClick={() => {
							setEditEffortValue(session?.self_rated_effort ?? 7);
							setEditingEffort(true);
						}}
						style={{ cursor: 'pointer' }}
					>
						{session?.self_rated_effort != null ? (
							<>
								<span className="ep-score num">{session.self_rated_effort}/10</span>
								<span className="ep-dot" />
								<span className="ep-word">{effortTone(session.self_rated_effort)}</span>
								<Edit2 size={11} style={{ color: 'var(--text-3)' }} />
							</>
						) : (
							<>
								<span className="ep-word">{t('Rate effort')}</span>
								<Edit2 size={11} style={{ color: 'var(--text-3)' }} />
							</>
						)}
					</button>
				) : (
					<div style={{ marginTop: 13, padding: '12px 14px', borderRadius: 14, background: 'var(--card-tint)', border: '1px solid var(--line)' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
							<span style={{ fontWeight: 800, fontSize: 17, color: 'var(--lime)' }} className="num">{editEffortValue}/10</span>
							<span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{effortTone(editEffortValue)}</span>
						</div>
						<input
							className="effort-slider"
							type="range"
							min={1} max={10} step={1}
							value={editEffortValue}
							onChange={(e) => setEditEffortValue(parseInt(e.target.value, 10))}
							style={{ margin: '14px 0 4px' }}
						/>
						<div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
							<button className="tool-chip" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingEffort(false)}>
								{t('Cancel')}
							</button>
							<button className="tool-chip on" style={{ flex: 1, justifyContent: 'center' }} onClick={saveEffortRating}>
								{t('Save')}
							</button>
						</div>
					</div>
				)
			)}

			{exercises.map((ex: any, i: number) => {
				const exSets = (setsByExercise.get(ex.exercise_id) || []).sort((a: any, b: any) => a.set_number - b.set_number);
				if (exSets.length === 0) return null;
				const normalSets = exSets.filter((s: any) => (s.set_type || 'normal') === 'normal');
				const extraSets = exSets.filter((s: any) => (s.set_type || 'normal') !== 'normal');
				const showExtraSets = !!expandedExtraSets[ex.exercise_id];
				const dropCount = extraSets.filter((s: any) => (s.set_type || 'normal') === 'drop').length;
				const warmupCount = extraSets.filter((s: any) => (s.set_type || 'normal') === 'warmup').length;

				return (
					<div className="ex-log" key={i}>
						<div className="exl-head">
							<span className="exl-name">{ex.name}</span>
							<span className="exl-top">{topSetLabel(ex, exSets)}</span>
							<button
								onClick={() => deleteExercise(ex.exercise_id)}
								aria-label={t('Delete')}
								style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 2, flexShrink: 0, alignSelf: 'center' }}
							>
								<Trash2 size={13} />
							</button>
						</div>
						{(ex.equipment || ex.muscle) && (
							<div className="exl-tagrow">
								<span className="exl-tag">{[ex.equipment, ex.muscle].filter(Boolean).join(' · ')}</span>
							</div>
						)}

						{normalSets.map((s: any, idx: number) => (
							<LogRow key={s.id} ex={ex} s={s} idx={idx} />
						))}

						{extraSets.length > 0 && (
							<>
								<button
									className="expand-btn"
									onClick={() => setExpandedExtraSets((prev) => ({ ...prev, [ex.exercise_id]: !prev[ex.exercise_id] }))}
									style={{ marginTop: 4 }}
								>
									{showExtraSets ? t('Hide extra sets') : t('Show extra sets')} ({extraSets.length}
									{dropCount > 0 ? ` · ${dropCount} drop` : ''}
									{warmupCount > 0 ? ` · ${warmupCount} warmup` : ''})
									{showExtraSets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
								</button>
								{showExtraSets && extraSets.map((s: any, extraIdx: number) => {
									const isDrop = (s.set_type || 'normal') === 'drop';
									return (
										<div className="log-row" key={s.id} style={{ gridTemplateColumns: '52px 86px 1fr' }}>
											<span
												className={isDrop ? 'pr' : 'tag'}
												style={{ justifySelf: 'start', fontSize: 8.5 }}
											>
												{isDrop ? 'DROP' : 'WARM'} {extraIdx + 1}
											</span>
											{ex.type === 'Cardio' && s.distance_km ? (
												<span className="log-w num" style={{ gridColumn: 'span 2' }}>
													{s.distance_km}<small>km</small>
													<span className="log-r num" style={{ marginLeft: 8 }}>{formatDurationMMSS(s.duration_sec || 0)}</span>
												</span>
											) : ex.type === 'Time' ? (
												<span className="log-w num" style={{ gridColumn: 'span 2' }}>{s.duration_sec || 0}<small>s</small></span>
											) : (
												<>
													<span className="log-w num">
														{s.weight_kg != null && s.weight_kg > 0 ? <>{s.weight_kg}<small>kg</small></> : <span className="log-w bw">BW</span>}
													</span>
													<span className="log-r num"><span className="x">×</span>{s.reps} reps</span>
												</>
											)}
										</div>
									);
								})}
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}

// ─── Session Feed (continuous scroll history) ────────────────────────
export default function SessionFeed({ targetSessionId }: { targetSessionId: number }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const targetRef = useRef<HTMLDivElement>(null);
	const topSentinelRef = useRef<HTMLDivElement>(null);
	const bottomSentinelRef = useRef<HTMLDivElement>(null);
	const initialScrollDone = useRef(false);

	const LOAD_SIZE = 3;

	const routines = useLiveQuery(() => db.routines.toArray()) || [];

	const allCompleted = useLiveQuery(
		() => db.sessions.orderBy('started_at').reverse().filter(s => !!s.completed_at).toArray(),
		[]
	);

	const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);

	useEffect(() => {
		if (!allCompleted || allCompleted.length === 0) return;
		const targetIdx = allCompleted.findIndex(s => s.id === targetSessionId);
		if (targetIdx < 0) return;

		const start = Math.max(0, targetIdx - 1);
		const end = Math.min(allCompleted.length - 1, targetIdx + 1);
		setVisibleRange({ start, end });
	}, [allCompleted, targetSessionId]);

	useEffect(() => {
		if (visibleRange && !initialScrollDone.current && targetRef.current) {
			setTimeout(() => {
				targetRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
				window.scrollBy(0, -60);
				initialScrollDone.current = true;
			}, 100);
		}
	}, [visibleRange]);

	useEffect(() => {
		initialScrollDone.current = false;
	}, [targetSessionId]);

	useEffect(() => {
		if (!allCompleted || !visibleRange) return;

		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				if (entry.target === topSentinelRef.current && visibleRange.start > 0) {
					setVisibleRange(prev => prev ? ({
						start: Math.max(0, prev.start - LOAD_SIZE),
						end: prev.end
					}) : prev);
				}
				if (entry.target === bottomSentinelRef.current && visibleRange.end < allCompleted.length - 1) {
					setVisibleRange(prev => prev ? ({
						start: prev.start,
						end: Math.min(allCompleted.length - 1, prev.end + LOAD_SIZE)
					}) : prev);
				}
			}
		}, { rootMargin: '200px' });

		if (topSentinelRef.current) observer.observe(topSentinelRef.current);
		if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

		return () => observer.disconnect();
	}, [allCompleted, visibleRange]);

	if (!allCompleted || !visibleRange) {
		return (
			<div className="container">
				<div className="mono" style={{ textAlign: 'center', padding: '80px 0', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	const visibleSessions = allCompleted.slice(visibleRange.start, visibleRange.end + 1);
	const canLoadNewer = visibleRange.start > 0;
	const canLoadOlder = visibleRange.end < allCompleted.length - 1;

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<button className="icon-btn" onClick={() => navigate('/sessions')} aria-label={t('Back')}>
					<ArrowLeft size={20} />
				</button>
				<div className="page-title sm">{t('Session History')}</div>
				<span className="mono num" style={{ fontSize: 11, color: 'var(--text-3)' }}>
					{allCompleted.length} {t('sessions')}
				</span>
			</header>

			<div ref={topSentinelRef} className="topmark">
				{canLoadNewer ? t('Scroll for newer sessions') : t('No newer sessions')}
			</div>

			<div style={{ display: 'grid', gap: 0 }}>
				{visibleSessions.map((s: any) => (
					<div key={s.id} ref={s.id === targetSessionId ? targetRef : undefined}>
						<FeedCard
							sessionId={s.id!}
							isTarget={s.id === targetSessionId}
							allRoutines={routines}
						/>
					</div>
				))}
			</div>

			<div ref={bottomSentinelRef} className="topmark" style={{ margin: '10px 0 4px' }}>
				{canLoadOlder ? t('Scroll for older sessions') : `${t("That's everything")} · ${allCompleted.length}`}
			</div>
		</div>
	);
}
