import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import {
	PlusCircle, Activity, TrendingUp, Dumbbell, Star, Coins,
	Target, Trophy, Rocket, Medal, Crown, Repeat, Zap, Mountain, Sparkles,
	ShoppingBag, Palette, Check, Gift, User as UserIcon
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

// ── Types ────────────────────────────────────────────────────────────────────

interface GamificationStats {
	level: number;
	experience: number;
	exp_to_next: number;
	currency: number;
}

interface QuestData {
	id: number;
	quest_id: number;
	name: string;
	description: string;
	icon: string;
	req_type: string;
	req_value: number;
	exp_reward: number;
	currency_reward: number;
	progress: number;
	completed: boolean;
	claimed: boolean;
	completed_at: string | null;
}

interface ShopItem {
	id: string;
	name: string;
	description: string;
	price: number;
	type: string;
	owned: boolean;
	preview: Record<string, string>;
}

interface ShopData {
	items: ShopItem[];
	currency: number;
	active_theme: string;
}

const ICON_MAP: Record<string, any> = {
	target: Target, footprints: Target, rocket: Rocket, trophy: Trophy,
	medal: Medal, crown: Crown, repeat: Repeat, zap: Zap,
	weight: Target, mountain: Mountain, sparkles: Sparkles,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Stats() {
	const [hasRoutines, setHasRoutines] = useState<boolean | null>(null);
	const [consistencyTab, setConsistencyTab] = useState<'weeks' | 'days'>('weeks');
	const [gamification, setGamification] = useState<GamificationStats | null>(null);
	const [quests, setQuests] = useState<QuestData[]>([]);
	const [claiming, setClaiming] = useState<number | null>(null);
	const [shop, setShop] = useState<ShopData | null>(null);
	const [buying, setBuying] = useState<string | null>(null);
	const [promoCode, setPromoCode] = useState('');
	const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);
	const { t } = useTranslation();
	const [isDemo, setIsDemo] = useState(false);

	// ── Fetch gamification stats ──────────────────────────────────────────────
	const fetchGamification = async () => {
		try {
			const endpoint = isDemo ? '/gamification/stats/demo' : '/gamification/stats';
			const res = await api.get(endpoint);
			setGamification(res.data);
		} catch (e) {
			console.error('Failed to fetch gamification stats', e);
		}
	};

	const fetchQuests = async () => {
		try {
			const endpoint = isDemo ? '/gamification/quests/demo' : '/gamification/quests';
			const res = await api.get(endpoint);
			setQuests(res.data);
		} catch (e) {
			console.error('Failed to load quests', e);
		}
	};

	const fetchShop = async () => {
		try {
			const endpoint = isDemo ? '/gamification/shop/demo' : '/gamification/shop';
			const res = await api.get(endpoint);
			setShop(res.data);
		} catch (e) {
			console.error('Failed to load shop', e);
		}
	};

	useEffect(() => {
		fetchGamification();
		fetchQuests();
		fetchShop();

		const handler = () => {
			fetchGamification();
			fetchQuests();
			fetchShop();
		};
		window.addEventListener('gamification-reward', handler);
		return () => window.removeEventListener('gamification-reward', handler);
	}, [isDemo]);

	// ── Claim quest ───────────────────────────────────────────────────────────
	const claimReward = async (userQuestId: number) => {
		setClaiming(userQuestId);
		try {
			const res = await api.post(`/gamification/quests/${userQuestId}/claim`);
			if (res.data && !res.data.error) {
				window.dispatchEvent(new CustomEvent('gamification-reward', {
					detail: {
						xp_gained: res.data.exp_reward,
						rep_prs: 0, weight_prs: 0,
						leveled_up: res.data.leveled_up,
						new_level: res.data.new_level,
						old_level: res.data.new_level - (res.data.leveled_up ? 1 : 0),
						experience: res.data.experience,
						exp_to_next: res.data.exp_to_next,
						currency: res.data.currency,
					}
				}));
			}
			await fetchQuests();
			await fetchGamification();
		} catch (e) {
			console.error('Failed to claim quest', e);
		} finally {
			setClaiming(null);
		}
	};

	// ── Buy shop item ─────────────────────────────────────────────────────────
	const buyItem = async (itemId: string) => {
		setBuying(itemId);
		try {
			await api.post('/gamification/shop/buy', { item_id: itemId });
			await fetchShop();
			await fetchGamification();
		} catch (e: any) {
			console.error('Failed to buy item', e);
			alert(e?.response?.data?.detail || 'Purchase failed');
		} finally {
			setBuying(null);
		}
	};

	const activateTheme = async (themeId: string) => {
		try {
			await api.post('/gamification/shop/activate', { theme: themeId });
			// Apply theme to DOM
			if (themeId !== 'dark') {
				document.documentElement.setAttribute('data-theme', themeId);
			} else {
				document.documentElement.removeAttribute('data-theme');
			}
			await fetchShop();
		} catch (e) {
			console.error('Failed to activate theme', e);
		}
	};

	const redeemPromo = async () => {
		if (!promoCode.trim()) return;
		try {
			const res = await api.post('/gamification/shop/promo', { code: promoCode.trim() });
			setPromoMsg({ text: `🎉 +${res.data.coins_awarded.toLocaleString()} coins!`, ok: true });
			setPromoCode('');
			await fetchGamification();
		} catch (e: any) {
			setPromoMsg({ text: e?.response?.data?.detail || 'Invalid code', ok: false });
		}
		setTimeout(() => setPromoMsg(null), 3000);
	};

	// ── Local stats from Dexie ────────────────────────────────────────────────
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

		const now = new Date();
		const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
		const weeklyCounts = [0, 0, 0, 0, 0, 0, 0, 0];

		const currentDay = now.getDay();
		const diffToMon = currentDay === 0 ? 6 : currentDay - 1;
		const startOfWeek = new Date(now);
		startOfWeek.setHours(0, 0, 0, 0);
		startOfWeek.setDate(now.getDate() - diffToMon);

		let totalVolume = 0;
		let weeklyTotalSessions = 0;

		completedSessions.forEach(session => {
			const d = new Date(session.completed_at!);
			d.setHours(0, 0, 0, 0);

			const isCurrentWeek = d.getTime() >= startOfWeek.getTime();
			const sessionSets = sets.filter(s => s.session_id === session.id);

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

			totalVolume += vol;
			if (isCurrentWeek) {
				weeklyTotalSessions++;
			}

			const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < 7) {
				dailyCounts[6 - diffDays]++;
			}

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

		let streak = 0;
		let checkIndex = 7;
		if (weeklyCounts[7] === 0) {
			checkIndex = weeklyCounts[6] > 0 ? 6 : -1;
		}
		if (checkIndex !== -1) {
			for (let i = checkIndex; i >= 0; i--) {
				if (weeklyCounts[i] > 0) streak++;
				else break;
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
			if (localCount > 0) { setHasRoutines(true); return; }
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

	// ── Loading & Empty states ────────────────────────────────────────────────
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

	// ── Derived data ──────────────────────────────────────────────────────────
	const weeklyData = stats.weekly_sessions;
	const dailyData = stats.daily_sessions;
	const maxWeekly = Math.max(...weeklyData, 1);
	const maxDaily = Math.max(...dailyData, 1);
	const streakWeeks = stats.streak_weeks;

	const adjustedDayLabels: string[] = [];
	const baseLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		let day = d.getDay();
		day = day === 0 ? 6 : day - 1;
		adjustedDayLabels.push(baseLabels[day]);
	}

	const activeQuests = quests.filter(q => !q.claimed);

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<Dumbbell size={28} color="var(--primary)" />
					<h1 className="text-2xl font-bold">{t('Weights Lifted')}</h1>
				</div>
				<button
					onClick={() => setIsDemo(!isDemo)}
					style={{
						background: isDemo ? 'rgba(255,179,71,0.15)' : 'none',
						border: isDemo ? '1px solid #FFB347' : '1px solid transparent',
						borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
						display: 'flex', alignItems: 'center', gap: '4px'
					}}
				>
					<UserIcon size={18} color={isDemo ? '#FFB347' : 'var(--text-tertiary)'} />
					{isDemo && <span style={{ fontSize: '11px', color: '#FFB347', fontWeight: 600 }}>Demo</span>}
				</button>
			</div>

			{/* ─── Level Card ──────────────────────────────────────────────── */}
			{gamification && (
				<div className="card" style={{
					padding: '16px', marginBottom: '16px',
					background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.06))',
					border: '1px solid rgba(99, 102, 241, 0.2)',
				}}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Star size={18} color="#CCFF00" fill="#CCFF00" />
							<span style={{ fontSize: '15px', fontWeight: 700 }}>
								{t('Level')} {gamification.level}
							</span>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
							<Coins size={15} color="#FFD700" />
							<span style={{ fontSize: '14px', fontWeight: 600, color: '#FFD700' }}>
								{gamification.currency.toLocaleString()}
							</span>
						</div>
					</div>
					<div style={{
						height: '8px', borderRadius: '4px',
						background: 'rgba(255, 255, 255, 0.08)',
						overflow: 'hidden', marginBottom: '6px',
					}}>
						<div style={{
							height: '100%', borderRadius: '4px',
							width: `${Math.round((gamification.experience / gamification.exp_to_next) * 100)}%`,
							background: 'linear-gradient(90deg, #6366f1, #CCFF00)',
							transition: 'width 0.5s ease',
						}} />
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
						<span>{gamification.experience} / {gamification.exp_to_next} XP</span>
						<span>{t('Level')} {gamification.level + 1}</span>
					</div>
				</div>
			)}

			{/* ─── Stats Cards ─────────────────────────────────────────────── */}
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

			{/* ─── Consistency Card ────────────────────────────────────────── */}
			<div className="card p-4">
				<div className="flex items-center justify-between mb-4">
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<TrendingUp size={18} className="text-primary" />
						<h3 className="font-semibold">{t('Consistency')}</h3>
					</div>
				</div>

				<div style={{
					display: 'flex', gap: '0', marginBottom: '16px',
					background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px',
				}}>
					<button
						onClick={() => setConsistencyTab('weeks')}
						style={{
							flex: 1, padding: '8px 16px', fontSize: '13px',
							fontWeight: consistencyTab === 'weeks' ? 'bold' : 'normal',
							borderRadius: '6px', border: 'none', cursor: 'pointer',
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
							flex: 1, padding: '8px 16px', fontSize: '13px',
							fontWeight: consistencyTab === 'days' ? 'bold' : 'normal',
							borderRadius: '6px', border: 'none', cursor: 'pointer',
							background: consistencyTab === 'days' ? 'var(--bg-secondary)' : 'transparent',
							color: consistencyTab === 'days' ? 'var(--primary)' : 'var(--text-secondary)',
							transition: 'all 0.2s ease',
							boxShadow: consistencyTab === 'days' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
						}}
					>
						{t('Days')}
					</button>
				</div>

				<div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 0' }}>
					{consistencyTab === 'weeks' ? (
						weeklyData.map((count: number, i: number) => {
							const isCurrentWeek = i === weeklyData.length - 1;
							const isEmpty = count === 0;
							const barHeight = isEmpty ? 12 : Math.max(20, (count / maxWeekly) * 100);
							return (
								<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifySelf: 'end' }}>
									<div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
										<div style={{
											width: '100%', height: `${barHeight}%`,
											backgroundColor: isEmpty ? 'rgba(255,255,255,0.05)' : (isCurrentWeek ? 'var(--primary)' : 'var(--accent)'),
											borderRadius: '4px', opacity: isEmpty ? 1 : (isCurrentWeek ? 1 : 0.8),
											position: 'relative', transition: 'all 0.3s ease', minHeight: '4px'
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
											width: '100%', height: `${barHeight}%`,
											backgroundColor: isEmpty ? 'rgba(255,255,255,0.05)' : (isToday ? 'var(--primary)' : 'var(--accent)'),
											borderRadius: '4px', opacity: isEmpty ? 1 : (isToday ? 1 : 0.8),
											position: 'relative', transition: 'all 0.3s ease', minHeight: '4px'
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

			{/* ─── Streak ──────────────────────────────────────────────────── */}
			<div className="mt-4 flex justify-between items-center text-sm" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
				<span className="text-secondary">{t('Active Streak')}</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
					<Activity size={16} className="text-accent" />
					<span className="text-white font-bold" style={{ fontSize: '16px' }}>{streakWeeks} {t('weeks')}</span>
				</div>
			</div>

			{/* ─── Quests Section (max 3 on home) ──────────────────────────── */}
			{quests.length > 0 && (
				<div style={{ marginTop: '24px' }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Trophy size={20} color="var(--primary)" />
							<h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t('Quests')}</h2>
						</div>
						{quests.length > 3 && (
							<Link to="/quests" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
								{t('See All')} →
							</Link>
						)}
					</div>

					{/* Active quests (show max 3) */}
					{activeQuests.length > 0 && (
						<div style={{ display: 'grid', gap: '10px' }}>
							{activeQuests.slice(0, 3).map(quest => {
								const IconComponent = ICON_MAP[quest.icon] || Target;
								const progress = Math.min(quest.progress, quest.req_value);
								const pct = Math.round((progress / quest.req_value) * 100);

								return (
									<div key={quest.id} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
										<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
											<div style={{
												width: '42px', height: '42px', borderRadius: '12px',
												background: quest.completed
													? 'linear-gradient(135deg, rgba(204, 255, 0, 0.2), rgba(99, 102, 241, 0.1))'
													: 'rgba(255, 255, 255, 0.05)',
												display: 'flex', alignItems: 'center', justifyContent: 'center',
												flexShrink: 0,
												border: quest.completed ? '1px solid rgba(204, 255, 0, 0.3)' : '1px solid rgba(255,255,255,0.08)'
											}}>
												<IconComponent size={20} color={quest.completed ? '#CCFF00' : 'var(--text-tertiary)'} />
											</div>

											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
													<h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{quest.name}</h3>
													<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
														{progress}/{quest.req_value}
													</span>
												</div>
												<p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
													{quest.description}
												</p>

												{/* Progress bar */}
												<div style={{
													height: '6px', borderRadius: '3px',
													background: 'rgba(255, 255, 255, 0.08)',
													overflow: 'hidden', marginBottom: '8px'
												}}>
													<div style={{
														height: '100%', borderRadius: '3px',
														width: `${pct}%`,
														background: quest.completed
															? 'linear-gradient(90deg, #CCFF00, #6366f1)'
															: 'var(--primary)',
														transition: 'width 0.5s ease'
													}} />
												</div>

												{/* Rewards + Claim */}
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
													<div style={{ display: 'flex', gap: '8px' }}>
														<span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
															⭐ {quest.exp_reward} XP
														</span>
														<span style={{ fontSize: '11px', color: '#FFD700', fontWeight: 600 }}>
															🪙 {quest.currency_reward}
														</span>
													</div>

													{quest.completed && !quest.claimed && (
														<button
															onClick={() => !isDemo && claimReward(quest.id)}
															disabled={!!isDemo || claiming === quest.id}
															style={{
																padding: '6px 16px', fontSize: '12px',
																fontWeight: 700, borderRadius: '8px',
																background: isDemo ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #CCFF00, #a0cc00)',
																color: isDemo ? 'var(--text-tertiary)' : '#000',
																border: 'none',
																cursor: isDemo ? 'not-allowed' : 'pointer',
																opacity: claiming === quest.id ? 0.6 : 1,
																transition: 'all 0.2s'
															}}
														>
															{isDemo ? 'Demo' : (claiming === quest.id ? '...' : t('Claim'))}
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{activeQuests.length === 0 && (
						<div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
							<Trophy size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
							<p style={{ fontSize: '13px' }}>{t('All quests completed!')}</p>
						</div>
					)}
				</div>
			)}

			{/* ─── Shop Section ─────────────────────────────────────────────── */}
			{shop && (
				<div style={{ marginTop: '24px' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
						<ShoppingBag size={20} color="var(--primary)" />
						<h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t('Shop')}</h2>
					</div>

					{/* Theme items */}
					<div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
						{shop.items.map(item => {
							const isActive = shop.active_theme === item.id.replace('theme_', '');
							return (
								<div key={item.id} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
									<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
										{/* Theme preview swatch */}
										<div style={{
											width: '44px', height: '44px', borderRadius: '12px',
											background: `linear-gradient(135deg, ${item.preview.primary}, ${item.preview.accent})`,
											display: 'flex', alignItems: 'center', justifyContent: 'center',
											flexShrink: 0,
											border: isActive ? '2px solid #CCFF00' : '1px solid rgba(255,255,255,0.1)',
											boxShadow: isActive ? '0 0 12px rgba(204, 255, 0, 0.3)' : 'none'
										}}>
											<Palette size={20} color={item.preview.text_primary || '#fff'} />
										</div>

										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
												<h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{item.name}</h3>
												{isActive && (
													<span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(204,255,0,0.15)', color: '#CCFF00', fontWeight: 600 }}>
														{t('Active')}
													</span>
												)}
											</div>
											<p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
												{item.description}
											</p>
										</div>

										{/* Action button */}
										<div style={{ flexShrink: 0 }}>
											{item.owned && isActive ? (
												<Check size={20} color="#CCFF00" />
											) : item.owned ? (
												<button
													onClick={() => !isDemo && activateTheme(item.id.replace('theme_', ''))}
													disabled={!!isDemo}
													style={{
														padding: '6px 12px', fontSize: '11px', fontWeight: 600,
														borderRadius: '8px',
														border: isDemo ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(99,102,241,0.3)',
														background: isDemo ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.1)',
														color: isDemo ? 'var(--text-tertiary)' : 'var(--primary)',
														cursor: isDemo ? 'not-allowed' : 'pointer',
														transition: 'all 0.2s'
													}}
												>
													{isDemo ? 'Demo' : t('Use')}
												</button>
											) : (
												<button
													onClick={() => !isDemo && buyItem(item.id)}
													disabled={!!isDemo || buying === item.id || (gamification?.currency || 0) < item.price}
													style={{
														padding: '6px 12px', fontSize: '11px', fontWeight: 700,
														borderRadius: '8px', border: 'none',
														background: isDemo
															? 'rgba(255,255,255,0.06)'
															: (gamification?.currency || 0) >= item.price
																? 'linear-gradient(135deg, #FFD700, #DAA520)'
																: 'rgba(255,255,255,0.06)',
														color: isDemo
															? 'var(--text-tertiary)'
															: (gamification?.currency || 0) >= item.price ? '#000' : 'var(--text-tertiary)',
														cursor: (isDemo || (gamification?.currency || 0) < item.price) ? 'not-allowed' : 'pointer',
														opacity: buying === item.id ? 0.6 : 1,
														transition: 'all 0.2s',
														display: 'flex', alignItems: 'center', gap: '4px'
													}}
												>
													{isDemo ? 'Demo' : <><Coins size={12} />{item.price}</>}
												</button>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>

					{/* Promo code - only for non-demo */}
					{!isDemo && (
						<div className="card" style={{
							padding: '14px 16px', marginBottom: 0,
							background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.06), rgba(218, 165, 32, 0.03))',
							border: '1px solid rgba(255, 215, 0, 0.15)',
						}}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
								<Gift size={16} color="#FFD700" />
								<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('Promo Code')}</span>
							</div>
							<div style={{ display: 'flex', gap: '8px' }}>
								<input
									type="text"
									value={promoCode}
									onChange={(e) => setPromoCode(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && redeemPromo()}
									placeholder={t('Enter code...')}
									style={{
										flex: 1, padding: '8px 12px', fontSize: '13px',
										borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
										background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
										outline: 'none',
									}}
								/>
								<button
									onClick={redeemPromo}
									disabled={!promoCode.trim()}
									style={{
										padding: '8px 14px', fontSize: '12px', fontWeight: 600,
										borderRadius: '8px', border: 'none',
										background: promoCode.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
										color: promoCode.trim() ? '#fff' : 'var(--text-tertiary)',
										cursor: promoCode.trim() ? 'pointer' : 'not-allowed',
										transition: 'all 0.2s'
									}}
								>
									{t('Redeem')}
								</button>
							</div>
							{promoMsg && (
								<div style={{
									marginTop: '8px', fontSize: '12px', fontWeight: 600,
									color: promoMsg.ok ? '#CCFF00' : '#ff6b6b',
									transition: 'all 0.3s'
								}}>
									{promoMsg.text}
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
