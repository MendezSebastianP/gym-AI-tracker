import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { api } from '../api/client';
import { ArrowLeft, Calendar, Clock, Edit, CheckCircle, ChevronUp, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

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

		// Get unique exercise IDs from the actual sets
		const seenIds = new Set<number>();
		const uniqueExIds: number[] = [];
		for (const s of sets.sort((a: any, b: any) => a.set_number - b.set_number)) {
			if (!seenIds.has(s.exercise_id)) {
				seenIds.add(s.exercise_id);
				uniqueExIds.push(s.exercise_id);
			}
		}

		// Sort by routine day order so history matches the routine/session view
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

	const effortTone = (v: number) => v <= 3 ? 'Easy' : v <= 6 ? 'Moderate' : v <= 8 ? 'Hard' : 'All out';

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
			<div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
				Loading...
			</div>
		);
	}

	const dayName = routine?.days?.[session.day_index || 0]?.day_name || `Day ${(session.day_index || 0) + 1}`;
	const dateStr = new Date(session.started_at).toLocaleDateString(undefined, {
		weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
	});
	const duration = (session as any).duration_seconds != null && (session as any).duration_seconds > 0
		? Math.round((session as any).duration_seconds / 60)
		: (session.started_at && session.completed_at
			? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
			: 0);

	// Group sets by exercise
	const setsByExercise = new Map<number, any[]>();
	for (const s of sets) {
		const arr = setsByExercise.get(s.exercise_id) || [];
		arr.push(s);
		setsByExercise.set(s.exercise_id, arr);
	}

	const deleteExercise = async (exerciseId: number) => {
		if (!confirm(t('Remove this exercise from the session history?'))) return;
		// Delete from server (sets that have been synced)
		const exSets = (sets || []).filter((s: any) => s.exercise_id === exerciseId);
		for (const s of exSets) {
			if (s.server_id) {
				try { await api.delete(`/sets/${s.server_id}`); } catch { /* best-effort */ }
			}
		}
		// Delete from IndexedDB using index query (more reliable than bulkDelete)
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
		<div
			className="card"
			style={{
				border: isTarget ? '2px solid var(--primary)' : '1px solid var(--border)',
				background: isTarget
					? 'linear-gradient(to bottom, rgba(99,102,241,0.08), transparent)'
					: undefined,
				marginBottom: 0,
			}}
		>
			{/* Header */}
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
				<div>
					<div style={{ fontSize: '16px', fontWeight: 700 }}>
						{routine?.name || t('Session')}
					</div>
					<div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
						{dayName}
					</div>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					<button
						className="btn btn-ghost"
						onClick={() => navigate(`/sessions/${sessionId}?edit=true`)}
						style={{ padding: '8px', color: 'var(--text-tertiary)' }}
					>
						<Edit size={16} />
					</button>
					<button
						className="btn btn-ghost"
						onClick={handleDelete}
						style={{ padding: '8px', color: 'var(--error)' }}
					>
						<Trash2 size={16} />
					</button>
				</div>
			</div>

			{/* Date & Duration */}
			<div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
					<Calendar size={12} /> {dateStr}
				</div>
				{duration > 0 && (
					<div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
						<Clock size={12} /> {duration} min
					</div>
				)}
			</div>

			{/* Effort Rating */}
			{effortTrackingEnabled && (
				<div style={{ marginBottom: '12px' }}>
					{!editingEffort ? (
						<button
							className="btn btn-ghost"
							onClick={() => {
								setEditEffortValue(session?.self_rated_effort ?? 7);
								setEditingEffort(true);
							}}
							style={{
								padding: '4px 10px',
								fontSize: '12px',
								color: session?.self_rated_effort != null ? '#86efac' : 'var(--text-tertiary)',
								border: '1px solid',
								borderColor: session?.self_rated_effort != null ? 'rgba(134,239,172,0.3)' : 'var(--border)',
								borderRadius: '6px',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '5px',
							}}
						>
							{session?.self_rated_effort != null ? (
								<>
									<span style={{ fontWeight: 700 }}>{session.self_rated_effort}/10</span>
									<span style={{ color: 'var(--text-tertiary)' }}>·</span>
									<span>{effortTone(session.self_rated_effort)}</span>
									<Pencil size={11} style={{ marginLeft: '2px' }} />
								</>
							) : (
								<>Rate effort <Pencil size={11} /></>
							)}
						</button>
					) : (
						<div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
								<span style={{ fontWeight: 700, color: '#86efac' }}>{editEffortValue}/10</span>
								<span style={{ color: 'var(--text-tertiary)' }}>{effortTone(editEffortValue)}</span>
							</div>
							<input
								type="range"
								min={1} max={10} step={1}
								value={editEffortValue}
								onChange={(e) => setEditEffortValue(parseInt(e.target.value, 10))}
								style={{ width: '100%', accentColor: '#22c55e', cursor: 'pointer', marginBottom: '8px' }}
							/>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
								<button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px' }} onClick={() => setEditingEffort(false)}>
									Cancel
								</button>
								<button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px' }} onClick={saveEffortRating}>
									Save
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Exercises & Sets */}
			<div style={{ display: 'grid', gap: '10px' }}>
				{exercises.map((ex: any, i: number) => {
					const exSets = (setsByExercise.get(ex.exercise_id) || []).sort((a: any, b: any) => a.set_number - b.set_number);
					if (exSets.length === 0) return null;
					const normalSets = exSets.filter((s: any) => (s.set_type || 'normal') === 'normal');
					const extraSets = exSets.filter((s: any) => (s.set_type || 'normal') !== 'normal');
					const showExtraSets = !!expandedExtraSets[ex.exercise_id];
					const dropCount = extraSets.filter((s: any) => (s.set_type || 'normal') === 'drop').length;
					const warmupCount = extraSets.filter((s: any) => (s.set_type || 'normal') === 'warmup').length;

					return (
						<div key={i} style={{
							background: 'rgba(0,0,0,0.15)', borderRadius: '8px',
							padding: '10px 12px', fontSize: '13px'
						}}>
							<div style={{ fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
									{ex.name}
									{(ex.equipment || ex.muscle) && (
										<span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-tertiary)' }}>
											{[ex.equipment, ex.muscle].filter(Boolean).join(' · ')}
										</span>
									)}
								</div>
								<button
									onClick={() => deleteExercise(ex.exercise_id)}
									style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
								>
									<Trash2 size={13} color="var(--error)" />
								</button>
							</div>
							<div style={{ display: 'grid', gap: '3px' }}>
								{normalSets.map((s: any, normalIdx: number) => (
									<div key={s.id} style={{
										display: 'flex', alignItems: 'center', gap: '8px',
										fontSize: '12px', color: 'var(--text-secondary)',
										padding: '2px 0'
									}}>
										<CheckCircle size={12} color="var(--success)" style={{ flexShrink: 0 }} />
										<span style={{ minWidth: '16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)' }}>{normalIdx + 1}.</span>
										{ex.type === 'Cardio' && s.distance_km ? (
											<span>{s.distance_km} km in {formatDurationMMSS(s.duration_sec || 0)}{s.distance_km > 0 && s.duration_sec > 0 ? ` (${formatPace(s.duration_sec / s.distance_km)} /km)` : ''}</span>
										) : ex.type === 'Time' ? (
											<span>{s.duration_sec || 0}s</span>
										) : (
											<>
												<span style={{ minWidth: '50px' }}>{s.weight_kg != null ? `${s.weight_kg} kg` : 'NA'}</span>
												<span>× {s.reps} reps</span>
											</>
										)}
									</div>
								))}

								{extraSets.length > 0 && (
									<div style={{ marginTop: '4px' }}>
										<button
											className="btn btn-ghost"
											onClick={() => setExpandedExtraSets((prev) => ({ ...prev, [ex.exercise_id]: !prev[ex.exercise_id] }))}
											style={{
												width: '100%',
												padding: '6px 8px',
												fontSize: '11px',
												border: '1px solid rgba(148,163,184,0.35)',
												background: 'rgba(148,163,184,0.08)',
												color: 'var(--text-secondary)',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: '8px',
											}}
										>
											<span>
												{showExtraSets ? t('Hide extra sets') : t('Show extra sets')} ({extraSets.length})
												{dropCount > 0 ? ` · ${dropCount} drop` : ''}
												{warmupCount > 0 ? ` · ${warmupCount} warmup` : ''}
											</span>
											{showExtraSets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
										</button>
										{showExtraSets && (
											<div style={{ display: 'grid', gap: '3px', marginTop: '6px' }}>
												{extraSets.map((s: any, extraIdx: number) => {
													const setType = s.set_type || 'normal';
													const isDrop = setType === 'drop';
													const tagLabel = isDrop ? 'DROP' : 'WARMUP';
													return (
														<div key={s.id} style={{
															display: 'flex',
															alignItems: 'center',
															gap: '8px',
															fontSize: '12px',
															color: 'var(--text-secondary)',
															padding: '2px 0',
														}}>
															<span
																style={{
																	minWidth: '52px',
																	display: 'inline-flex',
																	alignItems: 'center',
																	justifyContent: 'center',
																	padding: '2px 6px',
																	borderRadius: '999px',
																	fontSize: '10px',
																	fontWeight: 800,
																	letterSpacing: '0.4px',
																	border: isDrop ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(96,165,250,0.6)',
																	background: isDrop ? 'rgba(245,158,11,0.14)' : 'rgba(96,165,250,0.14)',
																	color: isDrop ? '#fbbf24' : '#93c5fd',
																}}
															>
																{tagLabel} {extraIdx + 1}
															</span>
															{ex.type === 'Cardio' && s.distance_km ? (
																<span>{s.distance_km} km in {formatDurationMMSS(s.duration_sec || 0)}{s.distance_km > 0 && s.duration_sec > 0 ? ` (${formatPace(s.duration_sec / s.distance_km)} /km)` : ''}</span>
															) : ex.type === 'Time' ? (
																<span>{s.duration_sec || 0}s</span>
															) : (
																<>
																	<span style={{ minWidth: '50px' }}>{s.weight_kg != null ? `${s.weight_kg} kg` : 'NA'}</span>
																	<span>× {s.reps} reps</span>
																</>
															)}
														</div>
													);
												})}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─── Session Feed (Facebook-style scroll) ────────────────────────────
export default function SessionFeed({ targetSessionId }: { targetSessionId: number }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const targetRef = useRef<HTMLDivElement>(null);
	const topSentinelRef = useRef<HTMLDivElement>(null);
	const bottomSentinelRef = useRef<HTMLDivElement>(null);
	const initialScrollDone = useRef(false);

	const LOAD_SIZE = 3; // Sessions to load per expansion

	// Load all routines for name resolution
	const routines = useLiveQuery(() => db.routines.toArray()) || [];

	// Load all completed sessions sorted newest first
	const allCompleted = useLiveQuery(
		() => db.sessions.orderBy('started_at').reverse().filter(s => !!s.completed_at).toArray(),
		[]
	);

	const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);

	// Initialize the visible range centered on the target session
	useEffect(() => {
		if (!allCompleted || allCompleted.length === 0) return;
		const targetIdx = allCompleted.findIndex(s => s.id === targetSessionId);
		if (targetIdx < 0) return;

		const start = Math.max(0, targetIdx - 1);
		const end = Math.min(allCompleted.length - 1, targetIdx + 1);
		setVisibleRange({ start, end });
	}, [allCompleted, targetSessionId]);

	// Scroll to the target session after initial render
	useEffect(() => {
		if (visibleRange && !initialScrollDone.current && targetRef.current) {
			// Small timeout to let DOM render
			setTimeout(() => {
				targetRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
				window.scrollBy(0, -60); // offset for sticky header
				initialScrollDone.current = true;
			}, 100);
		}
	}, [visibleRange]);

	// Reset on target change
	useEffect(() => {
		initialScrollDone.current = false;
	}, [targetSessionId]);

	// IntersectionObserver for infinite scroll
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
		return <div className="container" style={{ textAlign: 'center', padding: '40px' }}>Loading sessions...</div>;
	}

	const visibleSessions = allCompleted.slice(visibleRange.start, visibleRange.end + 1);
	const canLoadNewer = visibleRange.start > 0;
	const canLoadOlder = visibleRange.end < allCompleted.length - 1;

	return (
		<div className="container fade-in" style={{ paddingBottom: '100px' }}>
			{/* Sticky header */}
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				marginBottom: '16px', position: 'sticky', top: 0, zIndex: 10,
				background: 'var(--bg-primary)', padding: '10px 0',
				borderBottom: '1px solid var(--border)'
			}}>
				<div style={{ display: 'flex', alignItems: 'center' }}>
					<button className="btn btn-ghost" onClick={() => navigate('/sessions')} style={{ paddingLeft: 0, marginRight: '8px' }}>
						<ArrowLeft size={24} />
					</button>
					<h2 style={{ fontSize: '16px', margin: 0, fontWeight: 'bold' }}>
						{t('Session History')}
					</h2>
				</div>
				<span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
					{allCompleted.length} {t('sessions')}
				</span>
			</div>

			{/* Load newer indicator */}
			{canLoadNewer && (
				<div ref={topSentinelRef} style={{
					textAlign: 'center', padding: '12px', marginBottom: '8px',
					fontSize: '12px', color: 'var(--text-tertiary)',
					display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
				}}>
					<ChevronUp size={14} /> {t('Scroll for newer sessions')}
				</div>
			)}
			{!canLoadNewer && (
				<div ref={topSentinelRef} style={{
					textAlign: 'center', padding: '8px', marginBottom: '8px',
					fontSize: '11px', color: 'var(--text-tertiary)'
				}}>
					{t('No newer sessions')}
				</div>
			)}

			{/* Session cards */}
			<div style={{ display: 'grid', gap: '16px' }}>
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

			{/* Load older indicator */}
			{canLoadOlder && (
				<div ref={bottomSentinelRef} style={{
					textAlign: 'center', padding: '12px', marginTop: '8px',
					fontSize: '12px', color: 'var(--text-tertiary)',
					display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
				}}>
					{t('Scroll for older sessions')} <ChevronDown size={14} />
				</div>
			)}
			{!canLoadOlder && (
				<div ref={bottomSentinelRef} style={{
					textAlign: 'center', padding: '8px', marginTop: '8px',
					fontSize: '11px', color: 'var(--text-tertiary)'
				}}>
					{t('No older sessions')}
				</div>
			)}
		</div>
	);
}
