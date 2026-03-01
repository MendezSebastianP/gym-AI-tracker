import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link } from 'react-router-dom';
import { Plus, Star, Archive, RotateCcw, Trash2, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Routines() {
	const routines = useLiveQuery(() => db.routines.toArray());
	const { t } = useTranslation();
	const [showArchive, setShowArchive] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
	const [showHelp, setShowHelp] = useState(false);

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
			// Re-fetch to stay in sync
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
			// Re-fetch from server to ensure consistency
			const res = await api.get('/routines?include_archived=true');
			await db.routines.clear();
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			// Fallback: delete locally if server fails
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

	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<h1 className="text-2xl font-bold">{t('Routines')}</h1>
					<button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: '4px' }}>
						<HelpCircle size={18} color="var(--text-tertiary)" />
					</button>
				</div>
				<Link to="/routines/new" className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Plus size={20} />
					<span>{t('New')}</span>
				</Link>
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
					lineHeight: '1.6',
					position: 'relative'
				}}>
					<button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
						<X size={14} />
					</button>
					<strong style={{ color: 'var(--text-primary)' }}>{t('How routines work')}</strong><br />
					{t('A routine is a workout plan with one or more days (e.g. Push, Pull, Legs).')}<br />
					{t('Tap the ⭐ to set your active routine — sessions will follow that plan.')}<br />
					{t('Tap the archive icon to soft-delete a routine (recoverable for 10 days).')}<br />
					{t('Open a routine to edit exercises, sets, reps, and lock configurations.')}
				</div>
			)}

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
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							textDecoration: 'none',
							color: 'inherit',
							border: routine.is_favorite ? '1px solid var(--primary)' : '1px solid var(--border)',
							position: 'relative',
							overflow: 'hidden'
						}}
					>
						{routine.is_favorite && (
							<div style={{
								position: 'absolute', top: 0, left: 0,
								background: 'var(--primary)', width: '4px', height: '100%'
							}} />
						)}

						<div style={{ paddingLeft: routine.is_favorite ? '8px' : '0', flex: 1 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<h3 style={{ margin: 0, fontSize: '16px' }}>{routine.name}</h3>
								{routine.is_favorite && (
									<span style={{
										fontSize: '10px', background: 'rgba(204, 255, 0, 0.1)',
										color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px',
										fontWeight: 'bold'
									}}>
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
			</div>

			{/* Archive Section */}
			{archivedRoutines.length > 0 && (
				<div style={{ marginTop: '32px' }}>
					<button
						onClick={() => setShowArchive(!showArchive)}
						className="btn btn-ghost"
						style={{
							width: '100%', display: 'flex', justifyContent: 'space-between',
							alignItems: 'center', padding: '12px 0', color: 'var(--text-secondary)',
							fontSize: '14px', borderBottom: '1px solid var(--border)'
						}}
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
									<div
										key={routine.id}
										className="card"
										style={{
											display: 'flex', justifyContent: 'space-between', alignItems: 'center',
											opacity: 0.6, border: '1px solid var(--border)'
										}}
									>
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
											<button
												onClick={() => restoreRoutine(routine.id!)}
												className="btn btn-ghost"
												style={{ color: 'var(--accent)', padding: '8px' }}
												title={t('Restore')}
											>
												<RotateCcw size={16} />
											</button>
											{confirmDelete === routine.id ? (
												<button
													onClick={() => permanentlyDelete(routine.id!)}
													className="btn btn-ghost"
													style={{ color: '#ff4444', padding: '8px', fontSize: '11px', fontWeight: 'bold' }}
												>
													{t('Confirm')}
												</button>
											) : (
												<button
													onClick={() => setConfirmDelete(routine.id!)}
													className="btn btn-ghost"
													style={{ color: 'var(--text-tertiary)', padding: '8px' }}
													title={t('Delete permanently')}
												>
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
