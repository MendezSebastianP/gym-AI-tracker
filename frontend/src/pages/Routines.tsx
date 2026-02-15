import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link } from 'react-router-dom';
import { Plus, Star } from 'lucide-react';
import React, { useEffect } from 'react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function Routines() {
	const routines = useLiveQuery(() => db.routines.toArray());
	const { t } = useTranslation();

	useEffect(() => {
		if (navigator.onLine) {
			api.get('/routines').then(res => {
				db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
			}).catch(console.error);
		}
	}, []);

	const toggleFavorite = async (e: React.MouseEvent, routineId: number, currentStatus?: boolean) => {
		e.preventDefault(); // Prevent navigation
		e.stopPropagation();

		if (currentStatus) return; // Already favorite

		// Optimistic update
		if (routines) {
			const updated = routines.map(r => ({
				...r,
				is_favorite: r.id === routineId
			}));
			await db.routines.bulkPut(updated);
		}

		try {
			await api.put(`/routines/${routineId}`, { is_favorite: true });
			// Fetch again to ensure server consistency
			const res = await api.get('/routines');
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		} catch (error) {
			console.error("Failed to set favorite", error);
			// Revert? simpler to just fetch
			const res = await api.get('/routines');
			await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
		}
	};

	return (
		<div className="container fade-in" style={{ paddingBottom: '80px' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<h1 className="text-2xl font-bold">{t('Routines')}</h1>
				<Link to="/routines/new" className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
					<Plus size={20} />
					<span>{t('New')}</span>
				</Link>
			</div>

			{routines?.length === 0 && (
				<div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-tertiary)' }}>
					{t("It looks like you don't have any routines yet. Let's get you set up!")}
				</div>
			)}

			<div style={{ display: 'grid', gap: '12px' }}>
				{routines?.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)).map(routine => (
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

						<div style={{ paddingLeft: routine.is_favorite ? '8px' : '0' }}>
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

						<button
							onClick={(e) => toggleFavorite(e, routine.id, routine.is_favorite)}
							className="btn btn-ghost"
							style={{ color: routine.is_favorite ? 'var(--primary)' : 'var(--text-tertiary)' }}
						>
							<Star size={20} fill={routine.is_favorite ? "currentColor" : "none"} />
						</button>
					</Link>
				))}
			</div>
		</div>
	);
}
