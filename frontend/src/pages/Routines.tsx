import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Star, Archive, RotateCcw, Trash2, ChevronDown, ChevronUp, HelpCircle, X, Sparkles, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import StarIcon from '../components/icons/StarIcon';

export default function Routines() {
	const routines = useLiveQuery(() => db.routines.toArray());
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

	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			<style>{`
				@keyframes reportGlow {
					0%, 100% { box-shadow: 0 0 16px rgba(204,255,0,0.12), 0 0 32px rgba(204,255,0,0.06); }
					50% { box-shadow: 0 0 24px rgba(204,255,0,0.22), 0 0 48px rgba(204,255,0,0.10); }
				}
				@keyframes sparkleFloat {
					0% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
					50% { transform: translateY(-6px) rotate(15deg); opacity: 1; }
					100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
				}
				@keyframes reportBtnPulse {
					0%, 100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.4); }
					50% { box-shadow: 0 0 0 6px rgba(204,255,0,0); }
				}
				@keyframes shimmer {
					0% { background-position: -200% 0; }
					100% { background-position: 200% 0; }
				}
			`}</style>

			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<h1 className="text-2xl font-bold">{t('Routines')}</h1>
					<button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: '4px' }}>
						<HelpCircle size={18} color="var(--text-tertiary)" />
					</button>
				</div>
				<Link to="/routines/new" className="btn btn-primary motion-btn motion-btn--cta" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Plus size={20} />
					<span>{t('New')}</span>
				</Link>
			</div>

			{showHelp && (
				<div style={{
					background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px',
					fontSize: '13px', color: 'var(--text-secondary)', border: '1px solid rgba(99,102,241,0.3)',
					marginBottom: '16px', lineHeight: '1.6', position: 'relative'
				}}>
					<button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
						<X size={14} />
					</button>
					<strong style={{ color: 'var(--text-primary)' }}>{t('How routines work')}</strong><br />
					{t('A routine is a workout plan with one or more days (e.g. Push, Pull, Legs).')}<br />
					{t('Tap')} <StarIcon size={12} style={{ color: 'var(--primary)', position: 'relative', top: '2px' }} /> {t('to set your active routine — sessions will follow that plan.')}<br />
					{t('Tap the archive icon to soft-delete a routine (recoverable for 10 days).')}<br />
					{t('Open a routine to edit exercises, sets, reps, and lock configurations.')}
				</div>
			)}

			{/* ── AI Progression Report Card ─────────────────────────── */}
			{activeRoutines.length > 0 && (
				<div style={{
					background: 'linear-gradient(135deg, rgba(204,255,0,0.07) 0%, rgba(0,230,120,0.04) 100%)',
					border: '1px solid rgba(204,255,0,0.28)',
					borderRadius: '16px',
					padding: '20px',
					marginBottom: '24px',
					position: 'relative',
					overflow: 'hidden',
					animation: 'reportGlow 4s ease-in-out infinite',
				}}>
					{/* Background shimmer */}
					<div style={{
						position: 'absolute', inset: 0, pointerEvents: 'none',
						background: 'linear-gradient(105deg, transparent 40%, rgba(204,255,0,0.04) 50%, transparent 60%)',
						backgroundSize: '200% 100%',
						animation: 'shimmer 6s linear infinite',
					}} />

					{/* Floating sparkles */}
					<div style={{ position: 'absolute', top: '14px', right: '20px', animation: 'sparkleFloat 3s ease-in-out infinite' }}>
						<Sparkles size={18} color="rgba(204,255,0,0.5)" />
					</div>
					<div style={{ position: 'absolute', top: '38px', right: '44px', animation: 'sparkleFloat 3s ease-in-out infinite 1.2s' }}>
						<Sparkles size={10} color="rgba(204,255,0,0.3)" />
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
						<Sparkles size={20} color="var(--primary)" />
						<h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--primary)', letterSpacing: '-0.3px' }}>
							AI Progression Report
						</h2>
					</div>
					<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
						Analyse your training history and get AI-powered suggestions to keep progressing.
					</p>

					{/* Routine picker */}
					{activeRoutines.length > 1 && (
						<div style={{ marginBottom: '12px' }}>
							<label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
								Routine
							</label>
							<select
								value={reportRoutineId ?? ''}
								onChange={e => setReportRoutineId(Number(e.target.value))}
								style={{
									width: '100%', padding: '10px 12px', borderRadius: '8px',
									background: 'var(--bg-secondary)', border: '1px solid rgba(204,255,0,0.25)',
									color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600,
									appearance: 'none', cursor: 'pointer',
								}}
							>
								{activeRoutines.map(r => (
									<option key={r.id} value={r.id}>{r.name}</option>
								))}
							</select>
						</div>
					)}


					<button
						onClick={goToReport}
						disabled={!reportRoutineId}
						style={{
							width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
							background: 'var(--primary)', color: '#000', fontWeight: 800,
							fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
							justifyContent: 'center', gap: '8px',
							animation: 'reportBtnPulse 2.5s ease-in-out infinite',
						}}
					>
						<Sparkles size={16} />
						Analyse my training
						<ChevronRight size={16} />
					</button>
				</div>
			)}

			{/* ── Routine List ─────────────────────────────────────────── */}
			{activeRoutines.length === 0 && (
				<div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-tertiary)' }}>
					{t("It looks like you don't have any routines yet. Let's get you set up!")}
				</div>
			)}

			<div style={{ display: 'grid', gap: '12px' }}>
				{activeRoutines.map(routine => (
					<Link
						key={routine.id}
						to={`/routines/${routine.id}`}
						className="card"
						style={{
							display: 'flex', justifyContent: 'space-between', alignItems: 'center',
							textDecoration: 'none', color: 'inherit',
							border: routine.is_favorite ? '1px solid var(--primary)' : '1px solid var(--border)',
							position: 'relative', overflow: 'hidden'
						}}
					>
						{routine.is_favorite && (
							<div style={{ position: 'absolute', top: 0, left: 0, background: 'var(--primary)', width: '4px', height: '100%' }} />
						)}
						<div style={{ paddingLeft: routine.is_favorite ? '8px' : '0', flex: 1 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<h3 style={{ margin: 0, fontSize: '16px' }}>{routine.name}</h3>
								{routine.is_favorite && (
									<span style={{ fontSize: '10px', background: 'rgba(204,255,0,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
										{t('Active')}
									</span>
								)}
							</div>
							<p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px' }}>
								{routine.days.length} {t('days')} • {routine.days.reduce((acc: number, d: any) => acc + d.exercises.length, 0)} {t('exercises')}
							</p>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							<button
								onClick={(e) => toggleFavorite(e, routine.id!, routine.is_favorite)}
								className="btn btn-ghost"
								style={{ color: routine.is_favorite ? 'var(--primary)' : 'var(--text-tertiary)', padding: '8px' }}
							>
								<Star size={18} fill={routine.is_favorite ? "currentColor" : "none"} />
							</button>
							<button
								onClick={(e) => archiveRoutine(e, routine.id!)}
								className="btn btn-ghost"
								style={{ color: 'var(--text-tertiary)', padding: '8px' }}
								title={t('Archive')}
							>
								<Archive size={18} />
							</button>
						</div>
					</Link>
				))}

				{draftName && (
					<Link
						to="/routines/new"
						className="card"
						style={{
							display: 'flex', justifyContent: 'space-between', alignItems: 'center',
							textDecoration: 'none', color: 'inherit',
							border: '1px dashed var(--border)', position: 'relative', overflow: 'hidden',
							opacity: 0.8, backgroundColor: 'var(--bg-secondary)', marginTop: '4px'
						}}
					>
						<div style={{ flex: 1 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<h3 style={{ margin: 0, fontSize: '16px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
									{draftName || t('Untitled Draft')}
								</h3>
								<span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
									{draftMode === 'ai' ? t('AI Draft') : t('Draft')}
								</span>
							</div>
							<p style={{ color: 'var(--text-tertiary)', marginTop: '4px', fontSize: '13px' }}>
								{t('Tap to resume editing')}
							</p>
						</div>
					</Link>
				)}
			</div>

			{/* ── Archive ───────────────────────────────────────────────── */}
			{archivedRoutines.length > 0 && (
				<div style={{ marginTop: '32px' }}>
					<button
						onClick={() => setShowArchive(!showArchive)}
						className="btn btn-ghost"
						style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', color: 'var(--text-secondary)', fontSize: '14px', borderBottom: '1px solid var(--border)' }}
					>
						<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Archive size={16} />
							{t('Archive')} ({archivedRoutines.length})
						</span>
						{showArchive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					</button>

					{showArchive && (
						<div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
							{archivedRoutines.map(routine => {
								const daysLeft = getDaysUntilDeletion(routine.archived_at!);
								return (
									<div key={routine.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6, border: '1px solid var(--border)' }}>
										<div>
											<h3 style={{ margin: 0, fontSize: '14px', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
												{routine.name}
											</h3>
											<p style={{ color: 'var(--text-tertiary)', marginTop: '4px', fontSize: '11px' }}>
												{daysLeft > 0
													? t('Auto-delete in {{days}} days', { days: daysLeft })
													: t('Scheduled for deletion')}
											</p>
										</div>
										<div style={{ display: 'flex', gap: '4px' }}>
											<button onClick={() => restoreRoutine(routine.id!)} className="btn btn-ghost" style={{ color: 'var(--accent)', padding: '8px' }} title={t('Restore')}>
												<RotateCcw size={16} />
											</button>
											{confirmDelete === routine.id ? (
												<button onClick={() => permanentlyDelete(routine.id!)} className="btn btn-ghost" style={{ color: '#ff4444', padding: '8px', fontSize: '11px', fontWeight: 'bold' }}>
													{t('Confirm')}
												</button>
											) : (
												<button onClick={() => setConfirmDelete(routine.id!)} className="btn btn-ghost" style={{ color: 'var(--text-tertiary)', padding: '8px' }} title={t('Delete permanently')}>
													<Trash2 size={16} />
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
