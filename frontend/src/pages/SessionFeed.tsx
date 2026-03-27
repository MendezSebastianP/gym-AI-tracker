import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { api } from '../api/client';
import { ArrowLeft, Calendar, Clock, Edit, CheckCircle, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

	const routine = allRoutines.find((r: any) => r.id === session?.routine_id);

	// Derive exercises from the sets table (what was actually performed),
	// NOT from the current routine definition, so editing the routine
	// won't retroactively change historical sessions.
	useEffect(() => {
		if (!sets || sets.length === 0) return;

		// Get unique exercise IDs from the actual sets, preserving order
		const seenIds = new Set<number>();
		const uniqueExIds: number[] = [];
		for (const s of sets.sort((a: any, b: any) => a.set_number - b.set_number)) {
			if (!seenIds.has(s.exercise_id)) {
				seenIds.add(s.exercise_id);
				uniqueExIds.push(s.exercise_id);
			}
		}

		db.exercises.bulkGet(uniqueExIds).then(details => {
			const currentLang = i18n.language.split('-')[0];
			const enriched = uniqueExIds.map(id => {
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
	}, [sets, i18n.language]);

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
				try { await api.delete(`/sets/${s.server_id}`); } catch {}
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

			{/* Exercises & Sets */}
			<div style={{ display: 'grid', gap: '10px' }}>
				{exercises.map((ex: any, i: number) => {
					const exSets = (setsByExercise.get(ex.exercise_id) || []).sort((a: any, b: any) => a.set_number - b.set_number);
					if (exSets.length === 0) return null;

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
								{exSets.map((s: any) => (
									<div key={s.id} style={{
										display: 'flex', alignItems: 'center', gap: '8px',
										fontSize: '12px', color: 'var(--text-secondary)',
										padding: '2px 0'
									}}>
										<CheckCircle size={12} color="var(--success)" style={{ flexShrink: 0 }} />
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
