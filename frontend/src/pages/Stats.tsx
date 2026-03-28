import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { useTranslation } from 'react-i18next';
import { LiveStreakRow, WeekSlot, SKIN_ACCENTS } from '../components/StreakFlames';
import {
	PlusCircle, Activity, TrendingUp, Dumbbell, Star, Coins, Clock,
	Target, Trophy, Rocket, Medal, Crown, Repeat, Zap, Mountain, Sparkles,
	ShoppingBag, Palette, Check, Gift, User as UserIcon, Flame
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import CoinIcon from '../components/icons/CoinIcon';
import StarIcon from '../components/icons/StarIcon';

function formatPace(secondsPerKm: number): string {
	if (!secondsPerKm || !isFinite(secondsPerKm)) return '--:--';
	const m = Math.floor(secondsPerKm / 60);
	const s = Math.round(secondsPerKm % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

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

// Per-skin styles for the claim button and claimed badge
interface SkinClaimCfg {
	btnBg: string; btnColor: string; btnBorder: string;
	btnRadius: number | string; btnFont?: string; btnSpacing?: string;
	btnAnim: string; burstAnim: string;
	claimedBg: string; claimedBorder: string; claimedColor: string;
	btnLabel: (coins: number) => string;
	claimedLabel: (streak: number) => string;
}
const SKIN_CLAIM_CFG: Record<string, SkinClaimCfg> = {
	skin_a: {
		btnBg: 'linear-gradient(135deg, #FF8C00, #FF4500)', btnColor: '#fff', btnBorder: 'none',
		btnRadius: 10, btnAnim: 'claimBtnPulse 1.8s ease-in-out infinite',
		burstAnim: 'claimBurstA 0.48s ease-out forwards',
		claimedBg: 'rgba(255,140,0,0.07)', claimedBorder: '1px solid rgba(255,140,0,0.2)', claimedColor: '#FF8C00',
		btnLabel: (c) => `Claim week · ${c} coins`,
		claimedLabel: (s) => `${s}w streak — all rewards claimed`,
	},
	skin_b: {
		btnBg: 'linear-gradient(135deg, #7B1FA2, #E040FB)', btnColor: '#fff', btnBorder: 'none',
		btnRadius: 10, btnAnim: 'claimBtnPulse 1.8s ease-in-out infinite',
		burstAnim: 'claimBurstB 0.44s ease-out forwards',
		claimedBg: 'rgba(170,0,255,0.07)', claimedBorder: '1px solid rgba(170,0,255,0.22)', claimedColor: '#CE93D8',
		btnLabel: (c) => `Claim week · ${c} coins`,
		claimedLabel: (s) => `${s}w streak — all rewards claimed`,
	},
	skin_c1: {
		btnBg: 'rgba(255,80,0,0.18)', btnColor: '#FF9500', btnBorder: '1.5px solid rgba(255,80,0,0.38)',
		btnRadius: 10, btnAnim: 'claimBtnPulse 1.8s ease-in-out infinite',
		burstAnim: 'claimBurstOrb 0.46s ease-out forwards',
		claimedBg: 'rgba(255,80,0,0.07)', claimedBorder: '1px solid rgba(255,80,0,0.22)', claimedColor: '#FF9500',
		btnLabel: (c) => `Claim week · ${c} coins`,
		claimedLabel: (s) => `${s}w streak — all rewards claimed`,
	},
	skin_c2: {
		btnBg: 'rgba(210,160,0,0.18)', btnColor: '#FFD700', btnBorder: '1.5px solid rgba(210,160,0,0.38)',
		btnRadius: 10, btnAnim: 'claimBtnPulse 1.8s ease-in-out infinite',
		burstAnim: 'claimBurstOrb 0.46s ease-out forwards',
		claimedBg: 'rgba(210,160,0,0.07)', claimedBorder: '1px solid rgba(210,160,0,0.22)', claimedColor: '#FFD700',
		btnLabel: (c) => `Claim week · ${c} coins`,
		claimedLabel: (s) => `${s}w streak — all rewards claimed`,
	},
	skin_c3: {
		btnBg: 'rgba(30,130,255,0.18)', btnColor: '#42A5F5', btnBorder: '1.5px solid rgba(30,130,255,0.38)',
		btnRadius: 10, btnAnim: 'claimBtnPulse 1.8s ease-in-out infinite',
		burstAnim: 'claimBurstOrb 0.46s ease-out forwards',
		claimedBg: 'rgba(30,130,255,0.07)', claimedBorder: '1px solid rgba(30,130,255,0.22)', claimedColor: '#42A5F5',
		btnLabel: (c) => `Claim week · ${c} coins`,
		claimedLabel: (s) => `${s}w streak — all rewards claimed`,
	},
	skin_d: {
		btnBg: 'transparent', btnColor: '#FF9900', btnBorder: '2px solid #FF6600',
		btnRadius: 0, btnFont: 'monospace', btnSpacing: '0.06em', btnAnim: 'pxBlink 1.2s steps(2) infinite',
		burstAnim: 'claimBurstPx 0.5s steps(2) forwards',
		claimedBg: 'transparent', claimedBorder: '1px solid rgba(255,102,0,0.28)', claimedColor: '#FF9900',
		btnLabel: (c) => `CLAIM WEEK · ${c} COINS`,
		claimedLabel: (s) => `${s}W STREAK — CLAIMED`,
	},
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Stats() {
	const [hasRoutines, setHasRoutines] = useState<boolean | null>(null);
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
	const { user } = useAuthStore();
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

	// Use server-side streak slots (immutable, not affected by date edits)
	const weekSlotsDisplay: WeekSlot[] = (gamification?.streak_slots as WeekSlot[] | undefined) ??
		stats?.weekSlots?.map((slot, i) =>
			i === 6 ? { ...slot, claimed: streakAlreadyClaimed } : slot
		) ?? [];

	// Derive streak count from server slots (immune to date edits); fall back to local Dexie count
	const streakWeeks = (() => {
		if (gamification?.streak_slots && weekSlotsDisplay.length > 0) {
			let count = 0;
			for (let i = weekSlotsDisplay.length - 1; i >= 0; i--) {
				if (weekSlotsDisplay[i].sessions > 0) count++;
				else break;
			}
			return count;
		}
		return stats.streak_weeks;
	})();

	const unclaimedWeeks = gamification?.unclaimed_streak_weeks ?? 0;
	const unclaimedCoins = gamification?.unclaimed_streak_coins ?? 0;
	const activeSkinId = (shop?.active_streak_skin) ?? (user?.settings as any)?.active_streak_skin ?? 'skin_a';
	const skinAccent = SKIN_ACCENTS[activeSkinId] ?? '#FF8C00';

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
					padding: '20px', marginBottom: '16px',
					background: 'linear-gradient(135deg, rgba(204, 255, 0, 0.1), rgba(0, 229, 176, 0.05))',
					border: '1px solid rgba(204, 255, 0, 0.25)',
					position: 'relative',
					animation: 'xpCardGlow 4s ease-in-out infinite'
				}}>
					<style>{`
						@keyframes xpCardGlow {
							0%, 100% { box-shadow: 0 0 10px rgba(204,255,0,0.05); }
							50% { box-shadow: 0 0 20px rgba(204,255,0,0.15); }
						}
						@keyframes xpStripesFlow {
							0% { background-position: 0 0; }
							100% { background-position: 40px 0; }
						}
						@keyframes xpPulseGlow {
							0%, 100% { filter: drop-shadow(0 0 3px rgba(0, 229, 176, 0.4)); }
							50% { filter: drop-shadow(0 0 8px rgba(0, 229, 176, 0.8)); }
						}
					`}</style>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<StarIcon size={20} style={{ color: 'var(--primary)' }} />
							<span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>
								{t('Level')} {gamification.level}
							</span>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
							<CoinIcon size={16} style={{ color: 'var(--gold)' }} />
							<span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gold)' }}>
								{gamification.currency} {t('coins')}
							</span>
						</div>
					</div>

					{/* Highly Animated 3D Game XP Bar */}
					<div style={{
						height: '24px', borderRadius: '12px',
						background: 'rgba(0,0,0,0.4)', padding: '4px',
						border: '1px solid rgba(255,255,255,0.08)',
						boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
						marginBottom: '10px'
					}}>
						<div style={{
							height: '100%', borderRadius: '8px',
							width: `${Math.max(3, Math.round((gamification.experience / gamification.exp_to_next) * 100))}%`,
							background: 'linear-gradient(90deg, #008f6b 0%, var(--primary) 70%, #00ffc4 100%)',
							position: 'relative',
							transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
							animation: 'xpPulseGlow 3s infinite ease-in-out'
						}}>
							{/* Diagonal Moving Stripes overlay */}
							<div style={{
								position: 'absolute', inset: 0, borderRadius: '8px',
								background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 10px, transparent 10px, transparent 20px)',
								animation: 'xpStripesFlow 1s linear infinite'
							}} />

							{/* Glossy top highlight */}
							<div style={{
								position: 'absolute', top: 0, left: '2px', right: '2px', height: '45%',
								background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
								borderRadius: '8px 8px 0 0'
							}} />

							{/* Bright leading spark edge */}
							<div style={{
								position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px',
								background: '#fff', borderRadius: '4px',
								boxShadow: '0 0 10px var(--primary), 0 0 4px #fff'
							}} />
						</div>
					</div>

					<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
						<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
							<span style={{ color: 'var(--text-primary)' }}>{gamification.experience}</span>
							/ {gamification.exp_to_next} XP
						</span>
						<span>{t('Level')} {gamification.level + 1}</span>
					</div>
				</div>
			)}

			{/* ── Stats Cards ─────────────────────────────────────────────── */}
			{user?.settings?.track_time && (stats.avg_duration_seconds > 0 || stats.total_duration_seconds > 0) && (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
					{stats.avg_duration_seconds > 0 && (
						<div className="card text-center p-4" style={{ marginBottom: 0 }}>
							<div className="text-3xl font-bold mb-1" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
								<Clock size={20} />
								{Math.round(stats.avg_duration_seconds / 60)}
								<span className="text-sm font-normal text-tertiary">min</span>
							</div>
							<div className="text-secondary text-sm">{t('Avg Duration')}</div>
						</div>
					)}

					{stats.total_duration_seconds > 0 && (
						<div className="card text-center p-4" style={{ marginBottom: 0 }}>
							<div className="text-3xl font-bold mb-1" style={{ color: 'var(--accent)' }}>
								{stats.total_duration_seconds >= 3600
									? `${(stats.total_duration_seconds / 3600).toFixed(1)}`
									: Math.round(stats.total_duration_seconds / 60)}
								<span className="text-sm font-normal text-tertiary" style={{ marginLeft: '4px' }}>
									{stats.total_duration_seconds >= 3600 ? 'hrs' : 'min'}
								</span>
							</div>
							<div className="text-secondary text-sm">{t('Total Time')}</div>
						</div>
					)}
				</div>
			)}

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
						onClick={() => setConsistencyTab('streak')}
						style={{
							flex: 1, padding: '8px 10px', fontSize: '12px',
							fontWeight: consistencyTab === 'streak' ? 'bold' : 'normal',
							borderRadius: '6px', border: 'none', cursor: 'pointer',
							background: consistencyTab === 'streak' ? 'var(--bg-secondary)' : 'transparent',
							color: consistencyTab === 'streak' ? skinAccent : 'var(--text-secondary)',
							transition: 'all 0.2s ease',
							boxShadow: consistencyTab === 'streak' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
							display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
							position: 'relative',
						}}
					>
						<Flame size={12} />Streak
						{unclaimedWeeks > 0 && (
							<span style={{
								position: 'absolute', top: -5, right: -4,
								background: '#E53935', color: '#fff',
								borderRadius: '50%', minWidth: 16, height: 16,
								fontSize: 9, fontWeight: 800,
								display: 'flex', alignItems: 'center', justifyContent: 'center',
								lineHeight: 1, padding: '0 3px',
								boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
								pointerEvents: 'none',
							}}>
								{unclaimedWeeks}
							</span>
						)}
					</button>
					<button
						onClick={() => setConsistencyTab('weeks')}
						style={{
							flex: 1, padding: '8px 10px', fontSize: '12px',
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
							flex: 1, padding: '8px 10px', fontSize: '12px',
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

				{consistencyTab === 'streak' && weekSlotsDisplay.length > 0 && (
					<div>
						{(() => {
							const cfg = SKIN_CLAIM_CFG[activeSkinId] ?? SKIN_CLAIM_CFG.skin_a;
							return (
								<>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
										<span style={{ fontSize: 13, fontWeight: 700, color: skinAccent }}>{streakWeeks}w streak</span>
										<Link to="/shop#skins" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>More +</Link>
									</div>
									<LiveStreakRow skinId={activeSkinId} weeks={weekSlotsDisplay} />

									{unclaimedWeeks > 0 && (
										<button
											onClick={claimStreak}
											disabled={claimingStreak || claimCooldown}
											style={{
												marginTop: 14, width: '100%', padding: '11px 10px',
												borderRadius: cfg.btnRadius, background: cfg.btnBg,
												color: cfg.btnColor, fontWeight: 700, fontSize: 14,
												border: cfg.btnBorder,
												fontFamily: cfg.btnFont,
												letterSpacing: cfg.btnSpacing,
												cursor: (claimingStreak || claimCooldown) ? 'not-allowed' : 'pointer',
												opacity: claimCooldown ? 0.55 : (claimingStreak ? 0.7 : 1),
												display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
												animation: claimFlash
													? cfg.burstAnim
													: (claimCooldown || claimingStreak ? 'none' : cfg.btnAnim),
											}}
										>
											{cfg.btnLabel(gamification?.unclaimed_next_coins ?? 0)}
										</button>
									)}
									{unclaimedWeeks === 0 && streakWeeks > 0 && (
										<div style={{
											marginTop: 12, padding: '8px 14px',
											borderRadius: cfg.btnRadius,
											background: cfg.claimedBg,
											border: cfg.claimedBorder,
											fontFamily: cfg.btnFont,
											letterSpacing: cfg.btnSpacing,
											display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
											fontSize: 12, fontWeight: 600, color: cfg.claimedColor,
										}}>
											<Check size={13} />
											{cfg.claimedLabel(streakWeeks)}
										</div>
									)}
								</>
							);
						})()}
					</div>
				)}

				<div style={{ height: consistencyTab === 'streak' ? 0 : '140px', overflow: 'hidden', display: consistencyTab !== 'streak' ? 'flex' : 'none', alignItems: 'flex-end', gap: '8px', padding: consistencyTab !== 'streak' ? '10px 0' : 0 }}>
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
									<span style={{ fontSize: '10px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
										{i === weeklyData.length - 1 ? t('Now') : `W${weeklyData.length - i}`}
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
													? 'linear-gradient(135deg, rgba(204, 255, 0, 0.2), rgba(0, 229, 176, 0.1))'
													: 'rgba(255, 255, 255, 0.05)',
												display: 'flex', alignItems: 'center', justifyContent: 'center',
												flexShrink: 0,
												border: quest.completed ? '1px solid rgba(204, 255, 0, 0.3)' : '1px solid rgba(255,255,255,0.08)'
											}}>
												<IconComponent size={20} color={quest.completed ? 'var(--primary)' : 'var(--text-tertiary)'} />
											</div>

											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
													<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
														<h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{quest.name}</h3>
														{quest.is_weekly && (
															<span style={{
																fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
																background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1',
																padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px'
															}}>Weekly</span>
														)}
													</div>
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
															? 'linear-gradient(90deg, var(--primary), #00e5b0)'
															: 'var(--primary)',
														transition: 'width 0.5s ease'
													}} />
												</div>

												{/* Rewards + Claim */}
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
													<div style={{ display: 'flex', gap: '8px' }}>
														<span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
															<StarIcon size={12} /> {quest.exp_reward} XP
														</span>
														<span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
															<CoinIcon size={13} style={{ color: 'var(--gold)' }} /> {quest.currency_reward}
														</span>
													</div>

													{quest.completed && !quest.claimed && (
														<button
															onClick={() => !isDemo && claimReward(quest.id)}
															disabled={!!isDemo || claiming === quest.id}
															style={{
																padding: '6px 16px', fontSize: '12px',
																fontWeight: 700, borderRadius: '8px',
																background: isDemo ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--primary), var(--primary-dim))',
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
						<Link to="/shop#skins" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}>More +</Link>
					</div>

					{/* Theme items */}
					<div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
						{shop.items.map(item => {
							const themeKey = item.id.replace('theme_', '');
							const isActive = shop.active_theme === themeKey;
							return (
								<div key={item.id} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
									<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
										{/* Theme preview swatch */}
										<div style={{
											width: '44px', height: '44px', borderRadius: '12px',
											background: `linear-gradient(135deg, ${item.preview.primary}, ${item.preview.accent})`,
											display: 'flex', alignItems: 'center', justifyContent: 'center',
											flexShrink: 0,
											border: isActive ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
											boxShadow: isActive ? '0 0 12px rgba(204, 255, 0, 0.3)' : 'none'
										}}>
											<Palette size={20} color={item.preview.text_primary || '#fff'} />
										</div>

										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
												<h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{item.name}</h3>
												{isActive && (
													<span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(204,255,0,0.15)', color: 'var(--primary)', fontWeight: 600 }}>
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
												<Check size={20} color="var(--primary)" />
											) : item.owned ? (
												<button
													onClick={() => !isDemo && activateTheme(themeKey)}
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
																? 'linear-gradient(135deg, var(--gold), #DAA520)'
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
								<Gift size={16} color="var(--gold)" />
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
									color: promoMsg.ok ? 'var(--primary)' : '#ff6b6b',
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
