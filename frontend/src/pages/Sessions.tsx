import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, History, HelpCircle, User, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/client';


export default function Sessions() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [showHelp, setShowHelp] = useState(false);
	const [selectedRoutineFilter, setSelectedRoutineFilter] = useState<number | 'others' | null>(null);
	const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
	const expandedRef = useRef<HTMLDivElement>(null);
	const [demoMode, setDemoMode] = useState(false);
	const [demoSessions, setDemoSessions] = useState<any[]>([]);

	// Load routines to find favorite
	const routines = useLiveQuery(() => db.routines.toArray());

	// Load sessions for history and current status
	const sessions = useLiveQuery(() => db.sessions.orderBy('started_at').reverse().toArray());

	// Load sets for expanded session detail
	const expandedSets = useLiveQuery(
		() => expandedSessionId && !demoMode ? db.sets.where('session_id').equals(expandedSessionId).toArray() : Promise.resolve([]),
		[expandedSessionId, demoMode]
	);

	// Fetch demo sessions when demo mode is toggled on
	useEffect(() => {
		if (demoMode) {
			api.get('/sessions/demo/history')
				.then(res => setDemoSessions(res.data))
				.catch(() => setDemoSessions([]));
		}
	}, [demoMode]);

	// Set default filter to favorite routine once routines load
	useEffect(() => {
		if (!demoMode && routines && routines.length > 0 && selectedRoutineFilter === null) {
			const nonArchived = routines.filter((r: any) => !r.archived_at);
			const fav = nonArchived.find((r: any) => r.is_favorite) || nonArchived[0];
			if (fav) setSelectedRoutineFilter(fav.id!);
		}
	}, [routines, selectedRoutineFilter, demoMode]);

	// Scroll expanded detail into view
	useEffect(() => {
		if (expandedSessionId && expandedRef.current) {
			setTimeout(() => {
				expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 100);
		}
	}, [expandedSessionId]);

	const deleteSession = useCallback(async (sessionId: number) => {
		if (demoMode) return;
		if (!confirm(t('Are you sure you want to delete this session? This cannot be undone.'))) return;

		try {
			const session = await db.sessions.get(sessionId);
			if (session && session.server_id) {
				await api.delete(`/sessions/${session.server_id}`);
			}
		} catch (e) {
			console.error("Failed to delete from server", e);
		}

		await db.sets.where('session_id').equals(sessionId).delete();
		await db.sessions.delete(sessionId);
		setExpandedSessionId(null);
	}, [t, demoMode]);

	if (!routines || !sessions) return <div className="container">{t('Loading...')}</div>;

	// Determine Active Routine (Favorite or First — skip archived)
	const nonArchivedRoutines = routines.filter((r: any) => !r.archived_at);
	const activeRoutine = nonArchivedRoutines.find((r: any) => r.is_favorite) || nonArchivedRoutines[0];

	// Determine "Up Next"
	let nextSessionCard = null;
	if (activeRoutine) {
		const activeSession = sessions.find((s: any) => !s.completed_at && s.routine_id === activeRoutine.id);

		if (activeSession) {
			const dayName = activeRoutine.days[activeSession.day_index || 0]?.day_name || `Day ${(activeSession.day_index || 0) + 1}`;

			const discardSession = async () => {
				if (!confirm(t("Are you sure you want to discard your in-progress session?"))) return;
				if (activeSession.server_id) {
					try {
						await api.delete(`/sessions/${activeSession.server_id}`);
					} catch (e) {
						// Queue delete for retry when back online
						await db.syncQueue.add({
							event_type: 'delete_session',
							payload: { server_id: activeSession.server_id },
							client_timestamp: new Date().toISOString(),
							processed: false,
						});
					}
				}
				await db.sets.where('session_id').equals(activeSession.id!).delete();
				await db.sessions.delete(activeSession.id!);
			};

			nextSessionCard = (
				<div className="card" style={{ borderLeft: '4px solid var(--accent)', background: 'linear-gradient(to right, rgba(0,255,255,0.05), transparent)' }}>
					<h2 className="text-lg font-bold mb-2 flex items-center gap-2">
						<Zap size={16} className="text-accent" />
						{t('Resume Workout')}
					</h2>
					<div className="mb-4">
						<div className="text-xl font-semibold">{activeRoutine.name}</div>
						<div className="text-secondary">{dayName}</div>
						<div className="text-xs text-tertiary mt-2">
							Started {new Date(activeSession.started_at).toLocaleString()}
						</div>
					</div>
					<div className="flex gap-2">
						<button onClick={() => navigate(`/sessions/${activeSession.id}`)} className="btn btn-primary flex-1 motion-btn motion-btn--cta">
							{t('Resume Session')}
						</button>
						<button onClick={discardSession} className="btn btn-secondary flex-1 flex items-center justify-center gap-2 text-error" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
							<Trash2 size={16} />
							{t('Discard')}

						</button>
					</div>
				</div>
			);
		} else {
			const completedSessions = sessions.filter((s: any) => s.completed_at && s.routine_id === activeRoutine.id);
			const lastSession = completedSessions[0];
			let nextDayIndex = 0;
			if (activeRoutine.days && activeRoutine.days.length > 0) {
				if (lastSession && typeof lastSession.day_index === 'number') {
					nextDayIndex = (lastSession.day_index + 1) % activeRoutine.days.length;
				}
			}
			const nextDay = activeRoutine.days?.[nextDayIndex];

			const startSession = async () => {
				if (!activeRoutine.days || activeRoutine.days.length === 0) return;
				const id = await db.sessions.add({
					user_id: activeRoutine.user_id,
					routine_id: activeRoutine.id,
					day_index: nextDayIndex,
					started_at: new Date().toISOString(),
					syncStatus: 'created',
					locked_exercises: []
				});
				navigate(`/sessions/${id}`);
			};

			if (activeRoutine.days && activeRoutine.days.length > 0) {
				nextSessionCard = (
					<div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'linear-gradient(to right, rgba(204, 255, 0, 0.05), transparent)' }}>
						<h2 className="text-lg font-bold mb-2 flex items-center gap-2">
							<Zap size={16} className="text-primary" />
							{t("Up Next")}
						</h2>
						<div className="mb-4">
							<div className="text-sm text-primary uppercase tracking-wider mb-1">{activeRoutine.name}</div>
							<div className="text-xl font-semibold mb-1">{nextDay?.day_name || `Day ${nextDayIndex + 1}`}</div>
							<div className="text-sm text-secondary">{nextDay?.exercises.length || 0} {t('exercises')}</div>
						</div>
						<button onClick={startSession} className="btn btn-primary w-full motion-btn">{t('Start Workout')}</button>
					</div>
				);
			} else {
				nextSessionCard = (
					<div className="card text-center p-8 text-tertiary">{t('Routine has no days configured.')}</div>
				);
			}
		}
	} else {
		nextSessionCard = (
			<div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
				<h3 className="text-lg font-semibold mb-2">{t('No active routine')}</h3>
				<p className="text-secondary mb-4">{t('Create a routine to start tracking your workouts.')}</p>
				<Link to="/routines/new" className="btn btn-primary motion-btn motion-btn--cta">{t('Create Routine')}</Link>
			</div>
		);
	}

	// History
	const historySessions = demoMode ? demoSessions : sessions.filter((s: any) => !!s.completed_at);

	// Build routine filter options (only for normal mode)
	const routineIds = new Set(historySessions.map((s: any) => s.routine_id));
	const knownRoutineIds = new Set(routines.map((r: any) => r.id));
	const hasOrphans = [...routineIds].some(id => !knownRoutineIds.has(id));

	// Filter sessions by selected routine (skip in demo mode — show all)
	let filteredSessions = historySessions;
	if (!demoMode) {
		if (selectedRoutineFilter === 'others') {
			filteredSessions = historySessions.filter((s: any) => !knownRoutineIds.has(s.routine_id));
		} else if (selectedRoutineFilter !== null) {
			filteredSessions = historySessions.filter((s: any) => s.routine_id === selectedRoutineFilter);
		}
	}

	// Calculate routine cycles to alternate colors per cycle
	const sessionCycleMap = new Map<number, number>();
	if (filteredSessions.length > 0) {
		const chronologicalSessions = [...filteredSessions].reverse();
		let currentCycle = 0;
		let lastDayIndex = -1;
		for (const session of chronologicalSessions) {
			const currentDayIndex = session.day_index || 0;
			if (currentDayIndex <= lastDayIndex) {
				currentCycle++;
			}
			sessionCycleMap.set(session.id!, currentCycle);
			lastDayIndex = currentDayIndex;
		}
	}

	// Navigation for Sessions has been moved to routing.

	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
				<h1 className="text-2xl font-bold">{t('Sessions')}</h1>
				<button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: '4px' }}>
					<HelpCircle size={18} color="var(--text-tertiary)" />
				</button>
				<div style={{ marginLeft: 'auto' }}>
					<button
						onClick={() => { setDemoMode(!demoMode); setExpandedSessionId(null); }}
						style={{
							background: demoMode ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
							border: demoMode ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)',
							borderRadius: '8px', padding: '6px', cursor: 'pointer',
							display: 'flex', alignItems: 'center', justifyContent: 'center',
							transition: 'all 0.2s'
						}}
						title={t('Toggle Demo Mode')}
					>
						<User size={18} color={demoMode ? '#FFD700' : 'var(--text-tertiary)'} />
					</button>
				</div>
			</div>

			{demoMode && (
				<div style={{
					background: 'rgba(255, 215, 0, 0.08)',
					border: '1px solid rgba(255, 215, 0, 0.25)',
					borderRadius: '10px',
					padding: '10px 14px',
					marginBottom: '16px',
					fontSize: '12px',
					color: '#FFD700',
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					lineHeight: 1.4
				}}>
					<User size={14} />
					{t('Demo mode — showing 16 months of PPL training history')}
				</div>
			)}

			{showHelp && (
				<div style={{
					background: 'var(--bg-tertiary)',
					padding: '12px 16px',
					borderRadius: '8px',
					fontSize: '13px',
					color: 'var(--text-secondary)',
					border: '1px solid rgba(99, 102, 241, 0.3)',
					marginBottom: '16px',
					lineHeight: '1.6',
					position: 'relative'
				}}>
					<button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
						<X size={14} />
					</button>
					<strong style={{ color: 'var(--text-primary)' }}>{t('How sessions work')}</strong><br />
					{t('A session is one workout. Your active routine determines what\'s "Up Next".')}<br />
					{t('Sessions cycle through each day of your routine automatically.')}<br />
					{t('If you have an unfinished session, you can resume or discard it.')}<br />
					{t('Completed sessions appear in the History below.')}
				</div>
			)}

			{!demoMode && (
				<>
					<h3 className="section-title text-sm font-semibold text-secondary uppercase tracking-wider mb-3 px-1">{t('Current')}</h3>
					{nextSessionCard}
				</>
			)}

			{/* History Section */}
			<h3 className="section-title text-sm font-semibold text-secondary uppercase tracking-wider mb-3 mt-8 px-1 flex items-center gap-2">
				<History size={16} />
				{t('History')}
			</h3>

			{historySessions.length === 0 ? (
				<div className="text-center text-tertiary py-8 text-sm">
					{t('No completed sessions yet.')}
				</div>
			) : (
				<>
					{/* Routine filter dropdown */}
					{!demoMode && <select
						value={selectedRoutineFilter === 'others' ? 'others' : (selectedRoutineFilter ?? '')}
						onChange={e => {
							const val = e.target.value;
							if (val === 'others') setSelectedRoutineFilter('others');
							else setSelectedRoutineFilter(Number(val));
							setExpandedSessionId(null);
						}}
						style={{
							width: '100%', padding: '10px 12px', borderRadius: '8px',
							background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
							border: '1px solid #444', fontSize: '14px', marginBottom: '16px', outline: 'none'
						}}
					>
						{nonArchivedRoutines
							.filter((r: any) => routineIds.has(r.id))
							.map((r: any) => (
								<option key={r.id} value={r.id}>{r.name}</option>
							))
						}
						{hasOrphans && <option value="others">{t('Others')}</option>}
					</select>}

					{/* Compact 3-per-row session tabs */}
					{filteredSessions.length === 0 ? (
						<div className="text-center text-tertiary py-6 text-sm">
							{t('No sessions for this routine.')}
						</div>
					) : (
						<>
							<div style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(3, 1fr)',
								gap: '8px',
								marginBottom: '16px'
							}}>
								{filteredSessions.map((session: any, idx: number) => {
									const isExpanded = session.id === expandedSessionId;
									const cycleIndex = sessionCycleMap.get(session.id!) || 0;
									const isDarkCycle = cycleIndex % 2 === 1;
									const baseBg = isDarkCycle ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)';
									const isPendingSync = !demoMode && session.syncStatus !== 'synced';

									const date = new Date(session.completed_at!);
									const dayNum = date.getDate();
									const monthShort = date.toLocaleString(undefined, { month: 'short' });
									const routine = routines.find((r: any) => r.id === session.routine_id);
									const dayName = demoMode
										? (session.day_name || `D${(session.day_index || 0) + 1}`)
										: (routine?.days[session.day_index || 0]?.day_name || `D${(session.day_index || 0) + 1}`);

									return (
										<button
											key={session.id}
											onClick={() => {
												if (!demoMode) {
													const n = filteredSessions.length - idx;
													const routineSlug = encodeURIComponent(routine?.name || 'General');
													navigate(`/sessions/${routineSlug}/${n}`);
												}
											}}
											style={{
												padding: '10px 6px',
												borderRadius: '10px',
												border: '1px solid var(--overlay-medium)',
												background: baseBg,
												cursor: demoMode ? 'default' : 'pointer',
												textAlign: 'center',
												transition: 'all 0.15s ease',
												position: 'relative',
											}}
										>
											{isPendingSync && <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning, #f59e0b)' }} />}
											<div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
												{dayNum}
											</div>
											<div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
												{monthShort}
											</div>
											<div style={{
												fontSize: '10px', color: 'var(--text-secondary)',
												marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
											}}>
												{dayName}
											</div>
										</button>
									);
								})}
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
}
