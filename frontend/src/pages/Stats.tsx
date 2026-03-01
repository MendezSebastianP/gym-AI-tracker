import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { PlusCircle, Activity, TrendingUp, Dumbbell } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export default function Stats() {
	const [hasRoutines, setHasRoutines] = useState<boolean | null>(null);
	const [consistencyTab, setConsistencyTab] = useState<'weeks' | 'days'>('weeks');
	const { t } = useTranslation();

	// Calculate stats from local DB for instant updates
	const stats = useLiveQuery(async () => {
		const completedSessions = await db.sessions
			.filter(s => !!s.completed_at)
			.toArray();

		const sessionIds = completedSessions.map(s => s.id!).filter(id => id !== undefined);
		const sets = await db.sets
			.where('session_id')
			.anyOf(sessionIds)
			.toArray();

		const exercises = await db.exercises.toArray();
		const exerciseMap = new Map(exercises.map(e => [e.id, e]));

		// Calculate Weekly/Daily stats
		const now = new Date();
		const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
		const weeklyCounts = [0, 0, 0, 0, 0, 0, 0, 0]; // 8 weeks

		// Helper: Get start of current week (Monday)
		const currentDay = now.getDay(); // 0=Sun, 1=Mon...
		const diffToMon = currentDay === 0 ? 6 : currentDay - 1; // Mon=0, Sun=6
		const startOfWeek = new Date(now);
		startOfWeek.setHours(0, 0, 0, 0);
		startOfWeek.setDate(now.getDate() - diffToMon);

		let weeklyVolume = 0;
		let totalVolume = 0;
		let weeklyTotalSessions = 0;

		completedSessions.forEach(session => {
			const d = new Date(session.completed_at!);
			d.setHours(0, 0, 0, 0);

			const isCurrentWeek = d.getTime() >= startOfWeek.getTime();
			const sessionSets = sets.filter(s => s.session_id === session.id);

			// Compute volume for this session
			const vol = sessionSets.reduce((sum, set) => {
				const reps = set.reps || 0;
				if (reps === 0) return sum;

				if (set.weight_kg && set.weight_kg > 0) {
					return sum + (set.weight_kg * reps);
				} else {
					const exercise = exerciseMap.get(set.exercise_id);
					const bwVolume = (exercise as any)?.default_weight_kg || 30;
					return sum + (bwVolume * reps);
				}
			}, 0);

			// Always add to total volume
			totalVolume += vol;

			if (isCurrentWeek) {
				weeklyTotalSessions++;
				weeklyVolume += vol;
			}

			// Daily (last 7 days including today)
			const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < 7) {
				dailyCounts[6 - diffDays]++;
			}

			// Weekly (last 8 weeks)
			const sDay = d.getDay();
			const sDiff = sDay === 0 ? 6 : sDay - 1;
			const sStart = new Date(d);
			sStart.setDate(d.getDate() - sDiff);
			sStart.setHours(0, 0, 0, 0);

			const weeksAgo = Math.round((startOfWeek.getTime() - sStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

			if (weeksAgo >= 0 && weeksAgo < 8) {
				weeklyCounts[7 - weeksAgo]++;
			}
		});

		// Calculate Streak (Weeks)
		let streak = 0;
		let checkIndex = 7;
		if (weeklyCounts[7] === 0) {
			if (weeklyCounts[6] > 0) {
				checkIndex = 6;
			} else {
				checkIndex = -1; // No streak
			}
		}

		if (checkIndex !== -1) {
			for (let i = checkIndex; i >= 0; i--) {
				if (weeklyCounts[i] > 0) {
					streak++;
				} else {
					break;
				}
			}
		}

		return {
			sessions: weeklyTotalSessions,
			volume: totalVolume,
			weekly_sessions: weeklyCounts,
			daily_sessions: dailyCounts,
			streak_weeks: streak
		};

	}, []);

	useEffect(() => {
		const checkRoutines = async () => {
			const localCount = await db.routines.count();
			if (localCount > 0) {
				setHasRoutines(true);
				return;
			}

			if (navigator.onLine) {
				try {
					const res = await api.get('/routines');
					if (res.data && res.data.length > 0) {
						await db.routines.bulkPut(res.data.map((r: any) => ({ ...r, syncStatus: 'synced' })));
						setHasRoutines(true);
						return;
					}
				} catch (e) {
					console.error("Failed to check routines from server", e);
				}
			}

			setHasRoutines(false);
		};

		checkRoutines();
	}, []);

	if (hasRoutines === null || !stats) return <div className="container flex-center fade-in">{t('Loading...')}</div>;

	if (hasRoutines === false) {
		return (
			<div className="container" style={{ justifyContent: 'center', textAlign: 'center', height: '80vh' }}>
				<div style={{ marginBottom: '24px' }}>
					<Activity size={64} color="var(--primary)" style={{ opacity: 0.8 }} />
				</div>

				<h1 className="text-2xl font-bold" style={{ marginBottom: '16px' }}>{t('Welcome to Gym AI')}</h1>
				<p className="text-secondary" style={{ marginBottom: '32px', lineHeight: '1.6' }}>
					{t("It looks like you don't have any routines yet. Let's get you set up!")}
				</p>

				<Link to="/routines/new" className="btn btn-primary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
					<PlusCircle size={20} />
					{t("Create First Routine")}
				</Link>

				<p className="text-xs text-tertiary" style={{ marginTop: '32px', lineHeight: '1.5' }}>
					{t("Tip: You can use our AI wizard to generate a routine for you.")}
				</p>
			</div>
		);
	}

	// Build consistency data
	const weeklyData = stats.weekly_sessions;
	const dailyData = stats.daily_sessions;
	const maxWeekly = Math.max(...weeklyData, 1);
	const maxDaily = Math.max(...dailyData, 1);
	const streakWeeks = stats.streak_weeks;

	const adjustedDayLabels: string[] = [];
	const baseLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon to Sun
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		let day = d.getDay();
		day = day === 0 ? 6 : day - 1; // 0=Mon
		adjustedDayLabels.push(baseLabels[day]);
	}

	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			{/* Header with icon */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
				<Dumbbell size={28} color="var(--primary)" />
				<h1 className="text-2xl font-bold">{t('Weights Lifted')}</h1>
			</div>

			{/* Stats Cards */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
				<div className="card text-center p-4" style={{ marginBottom: 0 }}>
					<div className="text-3xl font-bold text-primary mb-1">
						{stats.sessions}
					</div>
					<div className="text-secondary text-sm">{t('Sessions')} <span style={{ fontSize: '10px' }}>({t('This Week')})</span></div>
				</div>

				<div className="card text-center p-4" style={{ marginBottom: 0 }}>
					<div className="text-3xl font-bold text-accent mb-1">
						{(() => {
							const v = stats.volume;
							if (v >= 1000000) return `${(v / 1000000).toFixed(1)}`;
							if (v >= 1000) return `${(v / 1000).toFixed(1)}`;
							return Math.round(v);
						})()}
						<span className="text-sm font-normal text-tertiary" style={{ marginLeft: '4px' }}>
							{stats.volume >= 1000000 ? 'kt' : stats.volume >= 1000 ? 't' : 'kg'}
						</span>
					</div>
					<div className="text-secondary text-sm">{t('Volume')} <span style={{ fontSize: '10px' }}>({t('Total')})</span></div>
				</div>
			</div>

			{/* Consistency Card with Tabs */}
			<div className="card p-4">
				<div className="flex items-center justify-between mb-4">
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<TrendingUp size={18} className="text-primary" />
						<h3 className="font-semibold">{t('Consistency')}</h3>
					</div>
				</div>

				{/* Tabs */}
				<div style={{
					display: 'flex',
					gap: '0',
					marginBottom: '16px',
					background: 'var(--bg-tertiary)',
					borderRadius: '8px',
					padding: '3px',
				}}>
					<button
						onClick={() => setConsistencyTab('weeks')}
						style={{
							flex: 1,
							padding: '8px 16px',
							fontSize: '13px',
							fontWeight: consistencyTab === 'weeks' ? 'bold' : 'normal',
							borderRadius: '6px',
							border: 'none',
							cursor: 'pointer',
							background: consistencyTab === 'weeks' ? 'var(--bg-secondary)' : 'transparent',
							color: consistencyTab === 'weeks' ? 'var(--primary)' : 'var(--text-secondary)',
							transition: 'all 0.2s ease',
							boxShadow: consistencyTab === 'weeks' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
						}}
					>
						{t('Weeks')}
					</button>
					<button
						onClick={() => setConsistencyTab('days')}
						style={{
							flex: 1,
							padding: '8px 16px',
							fontSize: '13px',
							fontWeight: consistencyTab === 'days' ? 'bold' : 'normal',
							borderRadius: '6px',
							border: 'none',
							cursor: 'pointer',
							background: consistencyTab === 'days' ? 'var(--bg-secondary)' : 'transparent',
							color: consistencyTab === 'days' ? 'var(--primary)' : 'var(--text-secondary)',
							transition: 'all 0.2s ease',
							boxShadow: consistencyTab === 'days' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
						}}
					>
						{t('Days')}
					</button>
				</div>

				{/* Chart */}
				<div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 0' }}>
					{consistencyTab === 'weeks' ? (
						weeklyData.map((count: number, i: number) => {
							const isCurrentWeek = i === weeklyData.length - 1;
							const isEmpty = count === 0;
							// If empty, show small bar (15%), else scale
							const barHeight = isEmpty ? 12 : Math.max(20, (count / maxWeekly) * 100);

							return (
								<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifySelf: 'end' }}>
									<div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
										<div style={{
											width: '100%',
											height: `${barHeight}%`,
											backgroundColor: isEmpty ? 'rgba(255,255,255,0.05)' : (isCurrentWeek ? 'var(--primary)' : 'var(--accent)'),
											borderRadius: '4px',
											opacity: isEmpty ? 1 : (isCurrentWeek ? 1 : 0.8),
											position: 'relative',
											transition: 'all 0.3s ease',
											minHeight: '4px'
										}}>
											{!isEmpty && (
												<span style={{
													position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
													fontSize: '10px', color: isCurrentWeek ? 'var(--primary)' : 'var(--text-tertiary)',
													fontWeight: isCurrentWeek ? 'bold' : 'normal'
												}}>
													{count}
												</span>
											)}
										</div>
									</div>
									<span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
										{i === 7 ? t('This week') : `W${weeklyData.length - i}`}
									</span>
								</div>
							);
						})
					) : (
						dailyData.map((count: number, i: number) => {
							const isToday = i === dailyData.length - 1;
							const isEmpty = count === 0;
							const barHeight = isEmpty ? 12 : Math.max(20, (count / maxDaily) * 100);

							return (
								<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}>
									<div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
										<div style={{
											width: '100%',
											height: `${barHeight}%`,
											backgroundColor: isEmpty ? 'rgba(255,255,255,0.05)' : (isToday ? 'var(--primary)' : 'var(--accent)'),
											borderRadius: '4px',
											opacity: isEmpty ? 1 : (isToday ? 1 : 0.8),
											position: 'relative',
											transition: 'all 0.3s ease',
											minHeight: '4px'
										}}>
											{!isEmpty && (
												<span style={{
													position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
													fontSize: '10px', color: isToday ? 'var(--primary)' : 'var(--text-tertiary)',
													fontWeight: isToday ? 'bold' : 'normal'
												}}>
													{count}
												</span>
											)}
										</div>
									</div>
									<span style={{ fontSize: '10px', color: isToday ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: isToday ? 'bold' : 'normal' }}>
										{adjustedDayLabels[i]}
									</span>
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* Streak */}
			<div className="mt-4 flex justify-between items-center text-sm" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
				<span className="text-secondary">{t('Active Streak')}</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Activity size={16} className="text-accent" />
					<span className="text-white font-bold" style={{ fontSize: '16px' }}>{streakWeeks} {t('weeks')}</span>
				</div>
			</div>
		</div>
	);
}
