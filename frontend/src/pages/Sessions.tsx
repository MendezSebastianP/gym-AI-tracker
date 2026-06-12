import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link, useNavigate } from 'react-router-dom';
import { HelpCircle, User, Trash2, X, Clock, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { K, Pencil, SecLabel } from '../components/kit';

function sessionDurationMin(s: any): number {
	if (s.duration_seconds != null && s.duration_seconds > 0) return Math.round(s.duration_seconds / 60);
	if (s.started_at && s.completed_at) {
		return Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000);
	}
	return 0;
}

function daysAgo(dateStr: string): number {
	return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

export default function Sessions() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const [showHelp, setShowHelp] = useState(false);
	const [selectedRoutineFilter, setSelectedRoutineFilter] = useState<number | 'others' | null>(null);
	const [demoMode, setDemoMode] = useState(false);
	const [demoSessions, setDemoSessions] = useState<any[]>([]);
	const [overrideDayIndex, setOverrideDayIndex] = useState<number | null>(null);
	const [historyView, setHistoryView] = useState<'grid' | 'list'>(
		() => (localStorage.getItem('sessionsHistoryView') === 'list' ? 'list' : 'grid')
	);

	const routines = useLiveQuery(() => db.routines.toArray());
	const sessions = useLiveQuery(() => db.sessions.orderBy('started_at').reverse().toArray());

	useEffect(() => {
		if (demoMode) {
			api.get('/sessions/demo/history')
				.then(res => setDemoSessions(res.data))
				.catch(() => setDemoSessions([]));
		}
	}, [demoMode]);

	// Default history filter = favorite routine
	useEffect(() => {
		if (!demoMode && routines && routines.length > 0 && selectedRoutineFilter === null) {
			const nonArchived = routines.filter((r: any) => !r.archived_at);
			const fav = nonArchived.find((r: any) => r.is_favorite) || nonArchived[0];
			if (fav) setSelectedRoutineFilter(fav.id!);
		}
	}, [routines, selectedRoutineFilter, demoMode]);

	const setView = (v: 'grid' | 'list') => {
		setHistoryView(v);
		localStorage.setItem('sessionsHistoryView', v);
	};

	if (!routines || !sessions) {
		return (
			<div className="container">
				<div className="mono" style={{ padding: '80px 0', textAlign: 'center', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	// Active routine = favorite or first non-archived
	const nonArchivedRoutines = routines.filter((r: any) => !r.archived_at);
	const activeRoutine = nonArchivedRoutines.find((r: any) => r.is_favorite) || nonArchivedRoutines[0];

	// ── Up Next / Resume hero ──────────────────────────────────────────
	let heroCard = null;
	if (activeRoutine) {
		const activeSession = sessions.find((s: any) => !s.completed_at && s.routine_id === activeRoutine.id);

		if (activeSession) {
			const dayName = activeRoutine.days[activeSession.day_index || 0]?.day_name || `${t('Day')} ${(activeSession.day_index || 0) + 1}`;

			const discardSession = async () => {
				if (!confirm(t('Are you sure you want to discard your in-progress session?'))) return;
				if (activeSession.server_id) {
					try {
						await api.delete(`/sessions/${activeSession.server_id}`);
					} catch (e) {
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

			heroCard = (
				<div className="hero-card">
					<div className="grain" />
					<div className="hero-body">
						<div className="hero-eyebrow">
							<span className="hero-bolt"><span className="elapsed"><span className="dot" /></span></span>
							<span className="mono">{t('In progress')}</span>
						</div>
						<h2 className="hero-title">{activeRoutine.name}</h2>
						<div className="hero-row">
							<span className="hero-meta">{dayName}</span>
							<span className="hero-dot" />
							<span className="hero-meta">
								{t('Started')} {new Date(activeSession.started_at).toLocaleString(i18n.language, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
							</span>
						</div>
						<button className="btn-primary hero-cta" onClick={() => navigate(`/sessions/${activeSession.id}`)}>
							<K.bolt />{t('Resume Session')}
						</button>
						<div className="hero-foot">
							<span className="last" />
							<button className="hero-empty" onClick={discardSession} style={{ color: 'var(--danger)' }}>
								<Trash2 size={14} />{t('Discard')}
							</button>
						</div>
					</div>
				</div>
			);
		} else if (activeRoutine.days && activeRoutine.days.length > 0) {
			const completedSessions = sessions.filter((s: any) => s.completed_at && s.routine_id === activeRoutine.id);
			const lastSession = completedSessions[0];
			let computedNext = 0;
			if (lastSession && typeof lastSession.day_index === 'number') {
				computedNext = (lastSession.day_index + 1) % activeRoutine.days.length;
			}
			const nextDayIndex = overrideDayIndex !== null && overrideDayIndex < activeRoutine.days.length
				? overrideDayIndex
				: computedNext;
			const nextDay = activeRoutine.days[nextDayIndex];
			const exCount = nextDay?.exercises?.length || 0;

			// Estimated duration from this day's history
			const dayHistory = completedSessions.filter((s: any) => (s.day_index || 0) === nextDayIndex).slice(0, 5);
			const avgMin = dayHistory.length > 0
				? Math.round(dayHistory.reduce((a: number, s: any) => a + sessionDurationMin(s), 0) / dayHistory.length)
				: 0;

			const previewNames: string[] = (nextDay?.exercises || []).slice(0, 3).map((e: any) => e.name || '').filter(Boolean);

			const startSession = async () => {
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

			const cycleDay = () => {
				setOverrideDayIndex(((nextDayIndex + 1) % activeRoutine.days.length));
			};

			heroCard = (
				<div className="hero-card">
					<div className="grain" />
					<div className="hero-body">
						<div className="hero-eyebrow">
							<span className="hero-bolt"><K.bolt /></span>
							<span className="mono">{t('Up Next')}</span>
						</div>
						<h2 className="hero-title">{activeRoutine.name}</h2>
						<div className="hero-row">
							<button className="day-switch" onClick={cycleDay}>
								{nextDay?.day_name || `${t('Day')} ${nextDayIndex + 1}`}
								<K.updown />
							</button>
							<span className="hero-dot" />
							<span className="hero-meta num">{exCount} {t('exercises')}</span>
							{avgMin > 0 && (
								<>
									<span className="hero-dot" />
									<span className="hero-meta num">~{avgMin} min</span>
								</>
							)}
						</div>

						{previewNames.length > 0 && (
							<div className="hero-preview">
								{previewNames.map((n, i) => (
									<span key={i} className="ex-chip"><K.dumbbell />{n.split(' ').slice(0, 2).join(' ')}</span>
								))}
								{exCount > previewNames.length && (
									<span className="ex-chip more">+{exCount - previewNames.length}</span>
								)}
							</div>
						)}

						<button className="btn-primary hero-cta" onClick={startSession}>
							<K.bolt />{t('Start Workout')}
						</button>

						<div className="hero-foot">
							<span className="last">
								{lastSession
									? `${t('Last')} · ${daysAgo(lastSession.completed_at!)}${t('d')} ${t('ago')}`
									: t('First session of this routine')}
							</span>
						</div>
					</div>
				</div>
			);
		} else {
			heroCard = (
				<div className="card" style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-3)' }}>
					{t('Routine has no days configured.')}
				</div>
			);
		}
	} else {
		heroCard = (
			<div className="hero-card">
				<div className="grain" />
				<div className="hero-body" style={{ textAlign: 'center', padding: '26px 18px 22px' }}>
					<h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('No active routine')}</h3>
					<p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--text-2)' }}>
						{t('Create a routine to start tracking your workouts.')}
					</p>
					<Link to="/routines/new" className="btn-primary" style={{ marginTop: 16 }}>
						{t('Create Routine')}
					</Link>
				</div>
			</div>
		);
	}

	// ── History ────────────────────────────────────────────────────────
	const historySessions = demoMode ? demoSessions : sessions.filter((s: any) => !!s.completed_at);

	const routineIds = new Set(historySessions.map((s: any) => s.routine_id));
	const knownRoutineIds = new Set(routines.map((r: any) => r.id));
	const hasOrphans = [...routineIds].some(id => !knownRoutineIds.has(id));

	let filteredSessions = historySessions;
	if (!demoMode) {
		if (selectedRoutineFilter === 'others') {
			filteredSessions = historySessions.filter((s: any) => !knownRoutineIds.has(s.routine_id));
		} else if (selectedRoutineFilter !== null) {
			filteredSessions = historySessions.filter((s: any) => s.routine_id === selectedRoutineFilter);
		}
	}

	// Group by month (newest first, input already sorted desc)
	const monthGroups: { key: string; label: string; items: any[] }[] = [];
	for (const s of filteredSessions) {
		const d = new Date(s.completed_at!);
		const key = `${d.getFullYear()}-${d.getMonth()}`;
		let g = monthGroups[monthGroups.length - 1];
		if (!g || g.key !== key) {
			g = {
				key,
				label: d.toLocaleString(i18n.language, { month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }),
				items: [],
			};
			monthGroups.push(g);
		}
		g.items.push(s);
	}

	const selectedRoutineName = selectedRoutineFilter === 'others'
		? t('Others')
		: nonArchivedRoutines.find((r: any) => r.id === selectedRoutineFilter)?.name
			|| routines.find((r: any) => r.id === selectedRoutineFilter)?.name
			|| t('All');

	const openSession = (session: any, idx: number) => {
		if (demoMode) return;
		const routine = routines.find((r: any) => r.id === session.routine_id);
		const n = filteredSessions.length - idx;
		const routineSlug = encodeURIComponent(routine?.name || 'General');
		navigate(`/sessions/${routineSlug}/${n}`);
	};

	const sessionMeta = (session: any) => {
		const routine = demoMode ? null : routines.find((r: any) => r.id === session.routine_id);
		const dayName = demoMode
			? (session.day_name || `${t('Day')} ${(session.day_index || 0) + 1}`)
			: (routine?.days[session.day_index || 0]?.day_name || `${t('Day')} ${(session.day_index || 0) + 1}`);
		const date = new Date(session.completed_at!);
		return {
			dayName,
			dayNum: date.getDate(),
			monthShort: date.toLocaleString(i18n.language, { month: 'short' }),
			dur: sessionDurationMin(session),
			pendingSync: !demoMode && session.syncStatus !== 'synced',
			dayParity: ((session.day_index || 0) % 2) + 1,
		};
	};

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<div className="page-title">{t('Sessions')}</div>
				<button className="icon-btn sm" onClick={() => setShowHelp(!showHelp)} aria-label={t('Help')}>
					<HelpCircle size={18} />
				</button>
				<button
					className={`icon-btn sm ${demoMode ? '' : ''}`}
					onClick={() => setDemoMode(!demoMode)}
					aria-label={t('Toggle Demo Mode')}
					style={demoMode ? {
						color: 'var(--reward)',
						borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
						background: 'color-mix(in oklab, var(--reward) 12%, transparent)',
					} : undefined}
				>
					<User size={18} />
				</button>
			</header>

			{showHelp && (
				<div className="coach" style={{ marginTop: 10, position: 'relative' }}>
					<span className="badge"><HelpCircle size={15} /></span>
					<div style={{ paddingRight: 18 }}>
						<b>{t('How sessions work')}</b>
						<p>
							{t('A session is one workout. Your active routine determines what\'s "Up Next".')}{' '}
							{t('Sessions cycle through each day of your routine automatically.')}{' '}
							{t('If you have an unfinished session, you can resume or discard it.')}{' '}
							{t('Completed sessions appear in the History below.')}
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

			{demoMode && (
				<div
					className="coach"
					style={{
						marginTop: 10,
						borderColor: 'color-mix(in oklab, var(--reward) 30%, transparent)',
						background: 'color-mix(in oklab, var(--reward) 7%, var(--card-solid))',
					}}
				>
					<span className="badge" style={{ background: 'color-mix(in oklab, var(--reward) 16%, transparent)', color: 'var(--reward)' }}>
						<User size={14} />
					</span>
					<div>
						<b style={{ color: 'var(--reward)' }}>{t('Demo mode')}</b>
						<p>{t('Demo mode — showing 16 months of PPL training history')}</p>
					</div>
				</div>
			)}

			{!demoMode && (
				<>
					<SecLabel>{t('Current')}</SecLabel>
					{heroCard}
				</>
			)}

			<SecLabel>{t('History')} · {filteredSessions.length}</SecLabel>

			{historySessions.length === 0 ? (
				<div className="topmark" style={{ padding: '24px 0' }}>{t('No completed sessions yet.')}</div>
			) : (
				<>
					<div className="filter-row">
						{!demoMode && (
							<div className="routine-select">
								<span className="rs-ic"><K.dumbbell width={16} height={16} /></span>
								<span className="rs-name">{selectedRoutineName}</span>
								<span className="rs-chev"><K.updown /></span>
								<select
									value={selectedRoutineFilter === 'others' ? 'others' : (selectedRoutineFilter ?? '')}
									onChange={e => {
										const val = e.target.value;
										if (val === 'others') setSelectedRoutineFilter('others');
										else setSelectedRoutineFilter(Number(val));
									}}
									aria-label={t('Filter by routine')}
								>
									{nonArchivedRoutines
										.filter((r: any) => routineIds.has(r.id))
										.map((r: any) => (
											<option key={r.id} value={r.id}>{r.name}</option>
										))}
									{hasOrphans && <option value="others">{t('Others')}</option>}
								</select>
							</div>
						)}
						<div className="view-toggle" style={demoMode ? { marginLeft: 'auto' } : undefined}>
							<button className={historyView === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label={t('Grid view')}>
								<LayoutGrid size={17} />
							</button>
							<button className={historyView === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label={t('List view')}>
								<Rows3 size={17} />
							</button>
						</div>
					</div>

					{filteredSessions.length === 0 ? (
						<div className="topmark" style={{ padding: '18px 0' }}>{t('No sessions for this routine.')}</div>
					) : (
						<>
							{monthGroups.map(group => (
								<div key={group.key}>
									<div className="mini-divider">
										<span className="m-month">{group.label}</span>
										<span className="m-count num">{group.items.length}</span>
										<span className="m-line" />
									</div>

									{historyView === 'grid' ? (
										<div className="month-grid">
											{group.items.map((session: any) => {
												const idx = filteredSessions.indexOf(session);
												const m = sessionMeta(session);
												return (
													<button key={session.id} className="sess-card" onClick={() => openSession(session, idx)}>
														<span className={`daybar d${m.dayParity}`} />
														{m.pendingSync && <span className="sess-sync" title={t('Pending sync')} />}
														<div className="sess-date num">{m.dayNum}</div>
														<div className="sess-month">{m.monthShort}</div>
														<div className="sess-day">{m.dayName}</div>
														{m.dur > 0 && (
															<div className="sess-foot">
																<Clock size={11} style={{ color: 'var(--text-4)' }} />
																<span className="dur num">{m.dur}m</span>
															</div>
														)}
													</button>
												);
											})}
										</div>
									) : (
										<div className="month-list">
											{group.items.map((session: any) => {
												const idx = filteredSessions.indexOf(session);
												const m = sessionMeta(session);
												return (
													<button key={session.id} className="sess-li" onClick={() => openSession(session, idx)}>
														<div className="li-date">
															<b className="num">{m.dayNum}</b>
															<span>{m.monthShort}</span>
														</div>
														<div className="li-main">
															<div className="li-day">{m.dayName}</div>
															<div className="li-meta num">
																{m.dur > 0 ? `${m.dur} min` : '—'}
																{m.pendingSync ? ` · ${t('Pending sync')}` : ''}
															</div>
														</div>
														<div className="li-tail"><ChevronRight size={16} /></div>
													</button>
												);
											})}
										</div>
									)}
								</div>
							))}
							<div style={{ height: 4 }} />
							<div className="sec-label" style={{ margin: '14px 2px 4px' }}>
								<Pencil />
								<span className="mono">{t("That's everything")} · {filteredSessions.length}</span>
								<Pencil />
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
}
