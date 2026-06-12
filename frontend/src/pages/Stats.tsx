import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { LiveStreakRow, SKIN_ACCENTS } from '../components/StreakFlames';
import type { WeekSlot } from '../components/StreakFlames';
import {
	Clock, Target, Trophy, Rocket, Medal, Crown, Repeat, Zap, Mountain, Sparkles,
	Palette, Check, Gift, User as UserIcon, Flame, Star, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLiveQuery } from 'dexie-react-hooks';
import GettingStartedCard from '../components/GettingStartedCard';
import { Coin, SecLabel } from '../components/kit';

// ── Types ────────────────────────────────────────────────────────────────────

interface GamificationStats {
	level: number;
	experience: number;
	exp_to_next: number;
	currency: number;
	streak_reward_week?: string;
	streak_slots?: Array<{week: string; start_date: string; sessions: number; claimed: boolean}>;
	unclaimed_streak_weeks?: number;
	unclaimed_streak_coins?: number;
	unclaimed_next_coins?: number;
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
	is_weekly?: boolean;
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

interface SkinShopItem {
	id: string;
	name: string;
	accent: string;
	owned: boolean;
	rarity: string;
}

interface ShopData {
	items: ShopItem[];
	skin_items: SkinShopItem[];
	currency: number;
	active_theme: string;
	active_streak_skin: string;
}

const ICON_MAP: Record<string, any> = {
	target: Target, footprints: Target, rocket: Rocket, trophy: Trophy,
	medal: Medal, crown: Crown, repeat: Repeat, zap: Zap,
	weight: Target, mountain: Mountain, sparkles: Sparkles,
};

// Per-skin claim styling: one kairos button shape for every skin, tinted by the
// skin accent. Only the pixel skin keeps its own letterform (that IS the skin).
interface SkinClaimCfg {
	accent: string;    // skin accent color
	onAccent: string;  // readable text on the accent
	pixel?: boolean;   // skin_d: mono font, square corners, outline style
}
const SKIN_CLAIM_CFG: Record<string, SkinClaimCfg> = {
	skin_a:  { accent: '#FF8C00', onAccent: '#1D0E00' },
	skin_b:  { accent: '#CE93D8', onAccent: '#23062E' },
	skin_c1: { accent: '#FF9500', onAccent: '#1D0E00' },
	skin_c2: { accent: '#FFD700', onAccent: '#201700' },
	skin_c3: { accent: '#42A5F5', onAccent: '#04121F' },
	skin_d:  { accent: '#FF9900', onAccent: '#FF9900', pixel: true },
};

function claimLabel(cfg: SkinClaimCfg, coins: number) {
	const txt = `Claim week · ${coins} coins`;
	return cfg.pixel ? txt.toUpperCase() : txt;
}

function claimedLabel(cfg: SkinClaimCfg, streak: number) {
	const txt = `${streak}w streak — all rewards claimed`;
	return cfg.pixel ? txt.toUpperCase() : txt;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Stats() {
	const [consistencyTab, setConsistencyTab] = useState<'streak' | 'weeks' | 'days'>('streak');
	const [gamification, setGamification] = useState<GamificationStats | null>(null);
	const [quests, setQuests] = useState<QuestData[]>([]);
	const [claiming, setClaiming] = useState<number | null>(null);
	const [claimingStreak, setClaimingStreak] = useState(false);
	const [claimFlash, setClaimFlash] = useState(false);
	const [claimCooldown, setClaimCooldown] = useState(false);
	const [shop, setShop] = useState<ShopData | null>(null);
	const [buying, setBuying] = useState<string | null>(null);
	const [promoCode, setPromoCode] = useState('');
	const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);
	const { t } = useTranslation();
	const { user, updateUser } = useAuthStore();
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

	useEffect(() => {
		if (isDemo) return;
		api.get('/auth/me').then((res) => {
			updateUser(res.data);
			db.users.put(res.data).catch(() => {});
		}).catch(() => {});
	}, [isDemo, updateUser]);

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
				document.documentElement.setAttribute('data-theme', 'theme_' + themeId);
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
			setPromoMsg({ text: `+${res.data.coins_awarded.toLocaleString()} coins!`, ok: true });
			setPromoCode('');
			await fetchGamification();
		} catch (e: any) {
			setPromoMsg({ text: e?.response?.data?.detail || 'Invalid code', ok: false });
		}
		setTimeout(() => setPromoMsg(null), 3000);
	};

	const claimStreak = async () => {
		if (claimCooldown || claimingStreak) return;
		// Trigger one-shot burst animation
		setClaimFlash(true);
		setTimeout(() => setClaimFlash(false), 500);
		setClaimingStreak(true);
		try {
			const res = await api.post('/gamification/streak/claim');
			if (res.data.streak_coins > 0) {
				window.dispatchEvent(new CustomEvent('gamification-reward', {
					detail: {
						xp_gained: 0, rep_prs: 0, weight_prs: 0,
						leveled_up: false, new_level: gamification?.level || 1,
						old_level: gamification?.level || 1,
						experience: gamification?.experience || 0,
						exp_to_next: gamification?.exp_to_next || 100,
						currency: res.data.currency,
						streak_coins: res.data.streak_coins,
						streak_weeks: res.data.streak_weeks,
					}
				}));
			}
			await fetchGamification();
			await fetchShop();
			// If more weeks remain, impose 1s cooldown before next claim
			if ((res.data.remaining ?? 0) > 0) {
				setClaimCooldown(true);
				setTimeout(() => setClaimCooldown(false), 1000);
			}
		} catch (e) {
			console.error('Failed to claim streak', e);
		} finally {
			setClaimingStreak(false);
		}
	};

	// ── Local stats from Dexie ────────────────────────────────────────────────
	const stats = useLiveQuery(async () => {
		const completedSessions = await db.sessions
			.filter(s => !!s.completed_at)
			.toArray();

		const sessionIds = completedSessions.map(s => s.id!).filter(id => id !== undefined);
		const allSets = await db.sets
			.where('session_id')
			.anyOf(sessionIds)
			.toArray();
		const sets = allSets.filter((s: any) => (s.set_type || 'normal') === 'normal');

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

		// Duration stats
		const durationSessions = completedSessions.filter(s => (s as any).duration_seconds && (s as any).duration_seconds > 0);
		const totalDuration = durationSessions.reduce((sum, s) => sum + ((s as any).duration_seconds || 0), 0);
		const avgDuration = durationSessions.length > 0 ? Math.round(totalDuration / durationSessions.length) : 0;

		// 7-week slots for animated streak row (index 6 = current week)
		const weekSlots: WeekSlot[] = Array.from({ length: 7 }, (_, i) => {
			const wkBack = 6 - i;
			const ws = new Date(startOfWeek);
			ws.setDate(startOfWeek.getDate() - wkBack * 7);
			return {
				week: '',
				start_date: ws.toISOString().split('T')[0],
				sessions: weeklyCounts[i + 1] ?? 0,  // weeklyCounts[1..7] maps to i=0..6
				claimed: wkBack !== 0,
			};
		});

		return {
			sessions: weeklyTotalSessions,
			volume: totalVolume,
			weekly_sessions: weeklyCounts,
			daily_sessions: dailyCounts,
			streak_weeks: streak,
			total_duration_seconds: totalDuration,
			avg_duration_seconds: avgDuration,
			tracked_duration_sessions: durationSessions.length,
			weekSlots,
		};
	}, []);

	// ── Derived data ──────────────────────────────────────────────────────────
	// stats comes from Dexie (IndexedDB) and may load slightly after the API-
	// driven gamification data. Don't block the whole page on it — the level
	// bar and quests can show immediately; charts/counts wait for stats.
	const weeklyData = stats?.weekly_sessions ?? [0, 0, 0, 0, 0, 0, 0, 0];
	const dailyData = stats?.daily_sessions ?? [0, 0, 0, 0, 0, 0, 0];
	const maxWeekly = Math.max(...weeklyData, 1);
	const maxDaily = Math.max(...dailyData, 1);
	const adjustedDayLabels: string[] = [];
	const baseLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		let day = d.getDay();
		day = day === 0 ? 6 : day - 1;
		adjustedDayLabels.push(baseLabels[day]);
	}

	const activeQuests = quests
		.filter(q => !q.claimed)
		.sort((a, b) => (b.completed ? 1 : 0) - (a.completed ? 1 : 0));

	// Current ISO week string (e.g. "2026-W13")
	const currentISOWeek = (() => {
		const now = new Date();
		const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const wk = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
		return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
	})();
	const streakAlreadyClaimed = gamification?.streak_reward_week === currentISOWeek;
	const demoWeekSlots: WeekSlot[] = Array.from({ length: 7 }, (_, i) => {
		const weekBack = 6 - i;
		const d = new Date();
		d.setDate(d.getDate() - weekBack * 7);
		return {
			week: '',
			start_date: d.toISOString().split('T')[0],
			sessions: 1,
			claimed: i < 5,
		};
	});

	// Use server-side streak slots (immutable, not affected by date edits)
	const weekSlotsDisplay: WeekSlot[] = isDemo
		? demoWeekSlots
		: (gamification?.streak_slots as WeekSlot[] | undefined) ??
		stats?.weekSlots?.map((slot, i) =>
			i === 6 ? { ...slot, claimed: streakAlreadyClaimed } : slot
		) ?? [];

	// Derive streak count from server slots (immune to date edits); fall back to local Dexie count
	const streakWeeks = (() => {
		if (isDemo) {
			return weekSlotsDisplay.filter((slot) => slot.sessions > 0).length;
		}
		if (gamification?.streak_slots && weekSlotsDisplay.length > 0) {
			let count = 0;
			for (let i = weekSlotsDisplay.length - 1; i >= 0; i--) {
				if (weekSlotsDisplay[i].sessions > 0) count++;
				else break;
			}
			return count;
		}
		return stats?.streak_weeks ?? 0;
	})();

	const unclaimedWeeks = isDemo ? 2 : (gamification?.unclaimed_streak_weeks ?? 0);
	const nextClaimCoins = isDemo ? 21 : (gamification?.unclaimed_next_coins ?? 0);
	const activeSkinId = isDemo ? 'skin_a' : ((shop?.active_streak_skin) ?? (user?.settings as any)?.active_streak_skin ?? 'skin_a');
	const skinAccent = SKIN_ACCENTS[activeSkinId] ?? '#FF8C00';

	const xpPct = gamification
		? Math.max(3, Math.round((gamification.experience / gamification.exp_to_next) * 100))
		: 0;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="container">
			{/* Header */}
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<div style={{ flex: 1 }}>
					<div className="page-title">{t('Home')}</div>
				</div>
				<button
					className="icon-btn sm"
					onClick={() => setIsDemo(!isDemo)}
					aria-label={t('Toggle Demo Mode')}
					style={isDemo ? {
						color: 'var(--reward)',
						borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
						background: 'color-mix(in oklab, var(--reward) 12%, transparent)',
					} : undefined}
				>
					<UserIcon size={18} />
				</button>
			</header>

			{!isDemo && (
				<GettingStartedCard
					progressRaw={user?.onboarding_progress}
					onClaimed={async (result) => {
						if (result?.currency !== undefined) {
							setGamification((current) => current ? { ...current, currency: result.currency } : current);
						}
						await fetchGamification();
						await fetchShop();
					}}
				/>
			)}

			{/* ── Level / XP ── */}
			{gamification && (
				<div className="card" style={{ marginTop: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<Star size={17} style={{ color: 'var(--lime)' }} fill="currentColor" />
							<span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
								{t('Level')} <span className="num">{gamification.level}</span>
							</span>
						</div>
						<div className="num" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 700, color: 'var(--reward)' }}>
							<Coin size={16} />
							{gamification.currency}
						</div>
					</div>

					<div className="meter" style={{ height: 8, marginTop: 14 }}>
						<span style={{ width: `${xpPct}%` }} />
					</div>

					<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
						<span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-3)' }}>
							{gamification.experience} / {gamification.exp_to_next} XP
						</span>
						<span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-4)' }}>
							{t('Level')} {gamification.level + 1}
						</span>
					</div>
				</div>
			)}

			{/* ── Time stats ── */}
			{user?.settings?.track_time && stats && (stats.avg_duration_seconds > 0 || stats.total_duration_seconds > 0) && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
					{stats.avg_duration_seconds > 0 && (
						<div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
							<div className="num" style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
								<Clock size={16} style={{ color: 'var(--green-mid)', alignSelf: 'center' }} />
								{Math.round(stats.avg_duration_seconds / 60)}
								<span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>min</span>
							</div>
							<div className="mono" style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 5 }}>{t('Avg Duration')}</div>
						</div>
					)}

					{stats.total_duration_seconds > 0 && (
						<div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
							<div className="num" style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
								{stats.total_duration_seconds >= 3600
									? `${(stats.total_duration_seconds / 3600).toFixed(1)}`
									: Math.round(stats.total_duration_seconds / 60)}
								<span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>
									{stats.total_duration_seconds >= 3600 ? 'hrs' : 'min'}
								</span>
							</div>
							<div className="mono" style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 5 }}>{t('Total Time')}</div>
						</div>
					)}
				</div>
			)}

			{/* ── Consistency ── */}
			<SecLabel>{t('Consistency')}</SecLabel>
			<div className="card">
				<div className="seg" style={{ display: 'flex', width: '100%' }}>
					<button
						className={consistencyTab === 'streak' ? 'on' : ''}
						onClick={() => setConsistencyTab('streak')}
						style={{ flex: 1, justifyContent: 'center', position: 'relative', ...(consistencyTab === 'streak' ? { color: skinAccent } : {}) }}
					>
						<Flame size={13} />{t('Streak')}
						{unclaimedWeeks > 0 && (
							<span style={{
								position: 'absolute', top: -4, right: -2,
								background: 'var(--danger)', color: '#fff',
								borderRadius: 99, minWidth: 16, height: 16,
								fontSize: 9, fontWeight: 800,
								display: 'flex', alignItems: 'center', justifyContent: 'center',
								lineHeight: 1, padding: '0 3px',
							}}>
								{unclaimedWeeks}
							</span>
						)}
					</button>
					<button
						className={consistencyTab === 'weeks' ? 'on' : ''}
						onClick={() => setConsistencyTab('weeks')}
						style={{ flex: 1, justifyContent: 'center' }}
					>
						{t('Weeks')}
					</button>
					<button
						className={consistencyTab === 'days' ? 'on' : ''}
						onClick={() => setConsistencyTab('days')}
						style={{ flex: 1, justifyContent: 'center' }}
					>
						{t('Days')}
					</button>
				</div>

				{consistencyTab === 'streak' && weekSlotsDisplay.length > 0 && (
					<div style={{ marginTop: 16 }}>
						{(() => {
							const cfg = SKIN_CLAIM_CFG[activeSkinId] ?? SKIN_CLAIM_CFG.skin_a;
							return (
								<>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
										<span className="num" style={{ fontSize: 13.5, fontWeight: 800, color: skinAccent }}>
											{streakWeeks}w {t('streak')}
										</span>
										<Link to="/shop#skins" className="mono" style={{ fontSize: 9.5, color: 'var(--text-3)' }}>
											{t('More')} +
										</Link>
									</div>
									<LiveStreakRow skinId={activeSkinId} weeks={weekSlotsDisplay} />

									{unclaimedWeeks > 0 && (
										<button
											onClick={() => { if (!isDemo) claimStreak(); }}
											disabled={isDemo || claimingStreak || claimCooldown}
											style={{
												['--claim-accent' as any]: cfg.accent,
												marginTop: 14, width: '100%', height: 50,
												borderRadius: cfg.pixel ? 0 : 13,
												background: cfg.pixel ? 'transparent' : cfg.accent,
												color: cfg.pixel ? cfg.accent : cfg.onAccent,
												border: cfg.pixel ? `2px solid ${cfg.accent}` : 'none',
												fontFamily: cfg.pixel ? 'monospace' : 'var(--font-disp)',
												letterSpacing: cfg.pixel ? '0.06em' : '-0.01em',
												fontWeight: 700, fontSize: cfg.pixel ? 13 : 14.5,
												cursor: (isDemo || claimingStreak || claimCooldown) ? 'not-allowed' : 'pointer',
												opacity: isDemo ? 0.72 : (claimCooldown ? 0.55 : (claimingStreak ? 0.7 : 1)),
												display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
												animation: isDemo
													? 'none'
													: claimFlash
													? (cfg.pixel ? 'claimBurstPx 0.5s steps(2) forwards' : 'claimBurstK 0.5s ease-out forwards')
													: (claimCooldown || claimingStreak ? 'none' : 'claimPulseK 2s ease-in-out infinite'),
											}}
										>
											{claimLabel(cfg, nextClaimCoins)}
										</button>
									)}
									{isDemo && (
										<div className="hint" style={{ marginTop: 8 }}>
											Demo preview · 2 claimable weeks (21 + 21 coins)
										</div>
									)}
									{unclaimedWeeks === 0 && streakWeeks > 0 && (
										<div style={{
											marginTop: 12, padding: '9px 14px',
											borderRadius: cfg.pixel ? 0 : 11,
											background: `color-mix(in srgb, ${cfg.accent} 8%, transparent)`,
											border: `1px solid color-mix(in srgb, ${cfg.accent} 25%, transparent)`,
											fontFamily: cfg.pixel ? 'monospace' : 'var(--font-disp)',
											letterSpacing: cfg.pixel ? '0.06em' : undefined,
											display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
											fontSize: 12, fontWeight: 600, color: cfg.accent,
										}}>
											<Check size={13} />
											{claimedLabel(cfg, streakWeeks)}
										</div>
									)}
								</>
							);
						})()}
					</div>
				)}

				{consistencyTab !== 'streak' && (
					<div style={{ height: 140, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '24px 0 0' }}>
						{(consistencyTab === 'weeks' ? weeklyData : dailyData).map((count: number, i: number) => {
							const data = consistencyTab === 'weeks' ? weeklyData : dailyData;
							const maxVal = consistencyTab === 'weeks' ? maxWeekly : maxDaily;
							const isCurrent = i === data.length - 1;
							const isEmpty = count === 0;
							const barHeight = isEmpty ? 10 : Math.max(20, (count / maxVal) * 100);
							return (
								<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
									<div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
										<div style={{
											width: '100%', height: `${barHeight}%`,
											background: isEmpty
												? 'var(--raised)'
												: isCurrent
													? 'linear-gradient(180deg, var(--lime), var(--green-mid))'
													: 'var(--green-mid)',
											borderRadius: 5, opacity: isEmpty ? 1 : (isCurrent ? 1 : 0.75),
											position: 'relative', transition: 'all 0.3s ease', minHeight: 4,
										}}>
											{!isEmpty && (
												<span className="num" style={{
													position: 'absolute', top: -17, left: '50%', transform: 'translateX(-50%)',
													fontSize: 10, fontWeight: isCurrent ? 800 : 600,
													color: isCurrent ? 'var(--lime)' : 'var(--text-3)',
												}}>
													{count}
												</span>
											)}
										</div>
									</div>
									<span className="mono" style={{ fontSize: 8.5, color: isCurrent ? 'var(--text-2)' : 'var(--text-4)', whiteSpace: 'nowrap' }}>
										{consistencyTab === 'weeks'
											? (isCurrent ? t('Now') : `W${weeklyData.length - i}`)
											: adjustedDayLabels[i]}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* ── Quests (max 3 on home) ── */}
			{quests.length > 0 && (
				<>
					<div className="sec-label">
						<span className="mono">{t('Quests')}</span>
						<span style={{ flex: 1 }} />
						{quests.length > 3 && (
							<Link to="/quests" className="mono" style={{ fontSize: 9.5, color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 2 }}>
								{t('See All')}<ChevronRight size={11} />
							</Link>
						)}
					</div>

					{activeQuests.length > 0 ? (
						activeQuests.slice(0, 3).map(quest => {
							const IconComponent = ICON_MAP[quest.icon] || Target;
							const progress = Math.min(quest.progress, quest.req_value);
							const pct = Math.round((progress / quest.req_value) * 100);

							return (
								<div key={quest.id} className="card" style={{ marginBottom: 10 }}>
									<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
										<div
											className="ex-thumb"
											style={quest.completed ? { background: 'var(--green-deep)', color: 'var(--lime)', borderColor: 'color-mix(in oklab, var(--lime) 26%, transparent)' } : undefined}
										>
											<IconComponent size={19} />
										</div>

										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
												<div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
													<span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
														{quest.name}
													</span>
													{quest.is_weekly && <span className="tag">{t('Weekly')}</span>}
												</div>
												<span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
													{progress}/{quest.req_value}
												</span>
											</div>
											<p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 9px', lineHeight: 1.4 }}>
												{quest.description}
											</p>

											<div className="meter">
												<span style={{ width: `${pct}%` }} />
											</div>

											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
												<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
													<span className="mono num" style={{ fontSize: 9.5, color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 4 }}>
														<Star size={11} fill="currentColor" />{quest.exp_reward} XP
													</span>
													<span className="mono num" style={{ fontSize: 9.5, color: 'var(--reward)', display: 'flex', alignItems: 'center', gap: 4 }}>
														<Coin size={12} />{quest.currency_reward}
													</span>
												</div>

												{quest.completed && !quest.claimed && (
													<button
														className="apply-btn"
														onClick={() => !isDemo && claimReward(quest.id)}
														disabled={!!isDemo || claiming === quest.id}
														style={{ height: 34, padding: '0 15px', opacity: claiming === quest.id ? 0.6 : 1 }}
													>
														{isDemo ? 'Demo' : (claiming === quest.id ? '…' : t('Claim'))}
													</button>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})
					) : (
						<div className="topmark" style={{ padding: '18px 0' }}>{t('All quests completed!')}</div>
					)}
				</>
			)}

			{/* ── Shop ── */}
			{shop && (
				<>
					<div className="sec-label">
						<span className="mono">{t('Shop')}</span>
						<span style={{ flex: 1 }} />
						<Link to="/shop#skins" className="mono" style={{ fontSize: 9.5, color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 2 }}>
							{t('More')}<ChevronRight size={11} />
						</Link>
					</div>

					{shop.items.map(item => {
						const themeKey = item.id.replace('theme_', '');
						const isActive = shop.active_theme === themeKey;
						return (
							<div key={item.id} className="card" style={{ marginBottom: 10 }}>
								<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
									{/* Theme preview swatch */}
									<div style={{
										width: 44, height: 44, borderRadius: 12,
										background: `linear-gradient(135deg, ${item.preview.primary}, ${item.preview.accent})`,
										display: 'flex', alignItems: 'center', justifyContent: 'center',
										flexShrink: 0,
										border: isActive ? '2px solid var(--lime)' : '1px solid var(--line-strong)',
									}}>
										<Palette size={19} color={item.preview.text_primary || '#fff'} />
									</div>

									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
											<span style={{ fontSize: 14.5, fontWeight: 700 }}>{item.name}</span>
											{isActive && <span className="rt-badge" style={{ marginLeft: 0 }}>{t('Active')}</span>}
										</div>
										<p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '3px 0 0', lineHeight: 1.4 }}>
											{item.description}
										</p>
									</div>

									{/* Action */}
									<div style={{ flexShrink: 0 }}>
										{item.owned && isActive ? (
											<Check size={20} style={{ color: 'var(--lime)' }} />
										) : item.owned ? (
											<button
												className="tool-chip"
												onClick={() => !isDemo && activateTheme(themeKey)}
												disabled={!!isDemo}
											>
												{isDemo ? 'Demo' : t('Use')}
											</button>
										) : (
											<button
												className="tool-chip"
												onClick={() => !isDemo && buyItem(item.id)}
												disabled={!!isDemo || buying === item.id || (gamification?.currency || 0) < item.price}
												style={(!isDemo && (gamification?.currency || 0) >= item.price) ? {
													color: 'var(--reward)',
													borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
													background: 'color-mix(in oklab, var(--reward) 10%, transparent)',
													opacity: buying === item.id ? 0.6 : 1,
												} : { opacity: 0.6 }}
											>
												{isDemo ? 'Demo' : <><Coin size={13} />{item.price}</>}
											</button>
										)}
									</div>
								</div>
							</div>
						);
					})}

					{/* Promo code — only for non-demo */}
					{!isDemo && (
						<div className="card" style={{ marginBottom: 0 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
								<Gift size={15} style={{ color: 'var(--reward)' }} />
								<span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('Promo Code')}</span>
							</div>
							<div style={{ display: 'flex', gap: 8 }}>
								<input
									type="text"
									value={promoCode}
									onChange={(e) => setPromoCode(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && redeemPromo()}
									placeholder={t('Enter code...')}
									style={{
										flex: 1, minWidth: 0, height: 42, padding: '0 13px', fontSize: 14,
										borderRadius: 11, border: '1px solid var(--line)',
										background: 'var(--raised)', color: 'var(--text)',
										fontFamily: 'var(--font-disp)', fontWeight: 600, outline: 'none',
									}}
								/>
								<button
									className="tool-chip on"
									onClick={redeemPromo}
									disabled={!promoCode.trim()}
									style={{ height: 42, opacity: promoCode.trim() ? 1 : 0.5 }}
								>
									{t('Redeem')}
								</button>
							</div>
							{promoMsg && (
								<div style={{
									marginTop: 8, fontSize: 12.5, fontWeight: 700,
									color: promoMsg.ok ? 'var(--lime)' : 'var(--danger)',
								}}>
									{promoMsg.text}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
