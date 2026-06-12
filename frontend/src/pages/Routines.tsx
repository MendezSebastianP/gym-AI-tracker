import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Star, Archive, RotateCcw, Trash2, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import { K, SecLabel } from '../components/kit';

export default function Routines() {
	const routines = useLiveQuery(() => db.routines.toArray());
	const sessions = useLiveQuery(() => db.sessions.orderBy('started_at').reverse().toArray());
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [showArchive, setShowArchive] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
	const [showHelp, setShowHelp] = useState(false);

	// AI Report state
	const [reportRoutineId, setReportRoutineId] = useState<number | null>(null);

	const draftName = localStorage.getItem('draftRoutineName');
	const draftMode = localStorage.getItem('draftRoutineMode');

	useEffect(() => {
		if (navigator.onLine) {
			api.get('/routines?include_archived=true').then(res => {
				db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
			}).catch(console.error);
		}
	}, []);

	const activeRoutines = routines?.filter(r => !r.archived_at)
		?.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)) || [];
	const archivedRoutines = routines?.filter(r => !!r.archived_at) || [];

	// Auto-select favorite routine for the AI report card
	useEffect(() => {
		if (activeRoutines.length > 0 && reportRoutineId === null) {
			const fav = activeRoutines.find(r => r.is_favorite) || activeRoutines[0];
			setReportRoutineId(fav.id!);
		}
	}, [activeRoutines.length]);

	const toggleFavorite = async (e: React.MouseEvent, routineId: number, currentStatus?: boolean) => {
		e.preventDefault();
		e.stopPropagation();
		if (currentStatus) return;

		if (routines) {
			const updated = routines.filter(r => !r.archived_at).map(r => ({
				...r,
				is_favorite: r.id === routineId
			}));
			await db.routines.bulkPut(updated);
		}

		try {
			await api.put(`/routines/${routineId}`, { is_favorite: true });
			const res = await api.get('/routines?include_archived=true');
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			console.error("Failed to set favorite", error);
		}
	};

	const archiveRoutine = async (e: React.MouseEvent, routineId: number) => {
		e.preventDefault();
		e.stopPropagation();

		const now = new Date().toISOString();
		await db.routines.update(routineId, { archived_at: now, is_favorite: false, syncStatus: 'updated' });

		try {
			await api.post(`/routines/${routineId}/archive`);
			const res = await api.get('/routines?include_archived=true');
			await db.routines.clear();
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			console.error("Failed to archive on server", error);
		}
	};

	const restoreRoutine = async (routineId: number) => {
		await db.routines.update(routineId, { archived_at: undefined, syncStatus: 'updated' });

		try {
			await api.post(`/routines/${routineId}/restore`);
			const res = await api.get('/routines?include_archived=true');
			await db.routines.clear();
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			console.error("Failed to restore on server", error);
		}
	};

	const permanentlyDelete = async (routineId: number) => {
		setConfirmDelete(null);

		try {
			await api.delete(`/routines/${routineId}`);
			const res = await api.get('/routines?include_archived=true');
			await db.routines.clear();
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			await db.routines.delete(routineId);
			console.error("Failed to delete on server", error);
		}
	};

	const getDaysUntilDeletion = (archivedAt: string) => {
		const archived = new Date(archivedAt);
		const deleteDate = new Date(archived.getTime() + 10 * 24 * 60 * 60 * 1000);
		const now = new Date();
		const diff = Math.ceil((deleteDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return Math.max(0, diff);
	};

	const goToReport = () => {
		if (!reportRoutineId) return;
		navigate(`/routines/${reportRoutineId}/report`);
	};

	/** Days since the last completed session of a routine, or null. */
	const lastSessionDays = (routineId: number): number | null => {
		const last = sessions?.find((s: any) => s.routine_id === routineId && s.completed_at);
		if (!last) return null;
		return Math.max(0, Math.floor((Date.now() - new Date(last.completed_at!).getTime()) / 86400000));
	};

	/** Start the next session of a routine (same day-cycling as the Sessions page). */
	const startWorkout = async (e: React.MouseEvent, routine: any) => {
		e.preventDefault();
		e.stopPropagation();
		if (!routine.days || routine.days.length === 0) return;

		// Resume an in-progress session for this routine if one exists
		const inProgress = sessions?.find((s: any) => !s.completed_at && s.routine_id === routine.id);
		if (inProgress) {
			navigate(`/sessions/${inProgress.id}`);
			return;
		}

		const lastCompleted = sessions?.find((s: any) => s.completed_at && s.routine_id === routine.id);
		let nextDayIndex = 0;
		if (lastCompleted && typeof lastCompleted.day_index === 'number') {
			nextDayIndex = (lastCompleted.day_index + 1) % routine.days.length;
		}
		const id = await db.sessions.add({
			user_id: routine.user_id,
			routine_id: routine.id,
			day_index: nextDayIndex,
			started_at: new Date().toISOString(),
			syncStatus: 'created',
			locked_exercises: []
		});
		navigate(`/sessions/${id}`);
	};

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
					<span className="page-title" style={{ flex: 'none' }}>{t('Routines')}</span>
					<button className="icon-btn sm" onClick={() => setShowHelp(!showHelp)} aria-label={t('Help')} style={{ width: 32, height: 32, borderRadius: 9 }}>
						<HelpCircle size={17} />
					</button>
				</div>
				<Link to="/routines/new" className="btn-new">
					<Plus size={17} />{t('New')}
				</Link>
			</header>

			{showHelp && (
				<div className="coach" style={{ marginTop: 10, position: 'relative' }}>
					<span className="badge"><HelpCircle size={15} /></span>
					<div style={{ paddingRight: 18 }}>
						<b>{t('How routines work')}</b>
						<p>
							{t('A routine is a workout plan with one or more days (e.g. Push, Pull, Legs).')}{' '}
							{t('Tap')} <Star size={11} style={{ verticalAlign: -1 }} /> {t('to set your active routine — sessions will follow that plan.')}{' '}
							{t('Tap the archive icon to soft-delete a routine (recoverable for 10 days).')}{' '}
							{t('Open a routine to edit exercises, sets, reps, and lock configurations.')}
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

			{/* ── AI Progression Report ── */}
			{activeRoutines.length > 0 && (
				<div className="ai-card" style={{ marginTop: 14 }}>
					<span className="ai-spark"><K.sparkBig /></span>
					<div className="ai-body">
						<div className="ai-head">
							<span className="ai-badge"><K.spark width={18} height={18} /></span>
							<span className="ai-title">{t('AI Progression Report')}</span>
						</div>
						<p className="ai-desc">{t('Analyse your training history and get suggestions to keep progressing.')}</p>

						{activeRoutines.length > 1 && (
							<div className="routine-select" style={{ marginTop: 13, background: 'rgba(0,0,0,0.22)' }}>
								<span className="rs-ic"><K.dumbbell width={16} height={16} /></span>
								<span className="rs-name">
									{activeRoutines.find(r => r.id === reportRoutineId)?.name || t('Routine')}
								</span>
								<span className="rs-chev"><K.updown /></span>
								<select
									value={reportRoutineId ?? ''}
									onChange={e => setReportRoutineId(Number(e.target.value))}
									aria-label={t('Routine')}
								>
									{activeRoutines.map(r => (
										<option key={r.id} value={r.id}>{r.name}</option>
									))}
								</select>
							</div>
						)}

						<button className="btn-primary ai-cta" onClick={goToReport} disabled={!reportRoutineId}>
							<K.spark />{t('Analyse my training')}
						</button>
					</div>
				</div>
			)}

			{/* ── Routine list ── */}
			<SecLabel>{t('Your routines')} · {activeRoutines.length}</SecLabel>

			{activeRoutines.length === 0 && (
				<div className="topmark" style={{ padding: '24px 0' }}>
					{t("It looks like you don't have any routines yet. Let's get you set up!")}
				</div>
			)}

			{activeRoutines.map(routine => {
				const lastDays = lastSessionDays(routine.id!);
				const totalEx = routine.days.reduce((acc: number, d: any) => acc + d.exercises.length, 0);
				return (
					<div
						key={routine.id}
						className={`rt-card ${routine.is_favorite ? 'active' : ''}`}
						onClick={() => navigate(`/routines/${routine.id}`)}
						role="link"
						tabIndex={0}
						onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/routines/${routine.id}`); }}
					>
						<div className="rt-head">
							<div style={{ flex: 1, minWidth: 0 }}>
								<div>
									<span className="rt-name">{routine.name}</span>
									{routine.is_favorite && <span className="rt-badge">{t('Active')}</span>}
								</div>
								<div className="rt-meta num">
									{routine.days.length} {t('days')} · {totalEx} {t('exercises')}
								</div>
							</div>
							<div className="rt-actions">
								<button
									className={`rt-icon fav ${routine.is_favorite ? 'on' : ''}`}
									onClick={(e) => toggleFavorite(e, routine.id!, routine.is_favorite)}
									aria-label={t('Favorite')}
								>
									<Star size={17} fill={routine.is_favorite ? 'currentColor' : 'none'} />
								</button>
								<button
									className="rt-icon"
									onClick={(e) => archiveRoutine(e, routine.id!)}
									aria-label={t('Archive')}
								>
									<Archive size={17} />
								</button>
							</div>
						</div>

						{routine.days.length > 0 && (
							<div className="day-chips">
								{routine.days.slice(0, 4).map((d: any, di: number) => (
									<div key={di} className="day-chip">
										<span className="dc-day">{d.day_name || `${t('Day')} ${di + 1}`}</span>
										<span className="dc-count num">{d.exercises.length} {t('exercises')}</span>
									</div>
								))}
							</div>
						)}

						<div className="rt-foot">
							<button className="btn-primary rt-start" onClick={(e) => startWorkout(e, routine)}>
								<K.bolt />{t('Start Workout')}
							</button>
							<span className="rt-last">
								{lastDays !== null ? `${t('Last')} · ${lastDays}${t('d')} ${t('ago')}` : t('Not trained yet')}
							</span>
						</div>
					</div>
				);
			})}

			{draftName && (
				<Link to="/routines/new" className="rt-card" style={{ border: '1.5px dashed var(--line-strong)', opacity: 0.85 }}>
					<div className="rt-head">
						<div style={{ flex: 1, minWidth: 0 }}>
							<div>
								<span className="rt-name" style={{ color: 'var(--text-2)' }}>{draftName || t('Untitled Draft')}</span>
								<span className="rt-badge" style={{ background: 'var(--raised-2)', color: 'var(--text-3)' }}>
									{draftMode === 'ai' ? t('AI Draft') : t('Draft')}
								</span>
							</div>
							<div className="rt-meta">{t('Tap to resume editing')}</div>
						</div>
					</div>
				</Link>
			)}

			<button className="new-ghost" onClick={() => navigate('/routines/new')}>
				<Plus size={17} />{t('New routine')}
			</button>

			<div className="hint" style={{ marginTop: 18 }}>{t('Star a routine to set it active')}</div>

			{/* ── Archive ── */}
			{archivedRoutines.length > 0 && (
				<div style={{ marginTop: 26 }}>
					<button
						onClick={() => setShowArchive(!showArchive)}
						style={{
							width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
							padding: '12px 2px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)',
							color: 'var(--text-2)', fontFamily: 'var(--font-disp)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
						}}
					>
						<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Archive size={15} />
							{t('Archive')} ({archivedRoutines.length})
						</span>
						{showArchive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					</button>

					{showArchive && archivedRoutines.map(routine => {
						const daysLeft = getDaysUntilDeletion(routine.archived_at!);
						return (
							<div key={routine.id} className="rt-card archived" style={{ cursor: 'default' }}>
								<div className="rt-head">
									<div style={{ flex: 1, minWidth: 0 }}>
										<span className="rt-name" style={{ fontSize: 16, textDecoration: 'line-through', color: 'var(--text-2)' }}>
											{routine.name}
										</span>
										<div className="rt-meta mono" style={{ fontSize: 9.5 }}>
											{daysLeft > 0
												? t('Auto-delete in {{days}} days', { days: daysLeft })
												: t('Scheduled for deletion')}
										</div>
									</div>
									<div className="rt-actions">
										<button className="rt-icon" onClick={() => restoreRoutine(routine.id!)} aria-label={t('Restore')} style={{ color: 'var(--green-mid)' }}>
											<RotateCcw size={16} />
										</button>
										{confirmDelete === routine.id ? (
											<button
												className="rt-icon"
												onClick={() => permanentlyDelete(routine.id!)}
												style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 45%, transparent)', width: 'auto', padding: '0 10px', fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-disp)' }}
											>
												{t('Confirm')}
											</button>
										) : (
											<button className="rt-icon" onClick={() => setConfirmDelete(routine.id!)} aria-label={t('Delete permanently')}>
												<Trash2 size={16} />
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
