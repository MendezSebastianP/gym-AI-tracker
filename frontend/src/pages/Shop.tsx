import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, ShoppingBag, Palette, Flame } from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import CoinIcon from '../components/icons/CoinIcon';
import {
	STYLES, CFG_C1, CFG_C2, CFG_C3,
	FlameSlotA, FlameSlotB, FlameSlotOrb, FlameSlotD,
} from '../components/StreakFlames';

// ── Extra CSS for theme animations ────────────────────────────────────────────

const THEME_STYLES = `
@keyframes lightThemeShimmer {
	0%   { box-shadow: 0 2px 6px rgba(99,102,241,0.15); }
	50%  { box-shadow: 0 3px 14px rgba(99,102,241,0.32), 0 0 0 1px rgba(99,102,241,0.12); }
	100% { box-shadow: 0 2px 6px rgba(99,102,241,0.15); }
}
@keyframes lightSweep {
	0%   { transform: translateX(-120%) skewX(-15deg); }
	100% { transform: translateX(220%)  skewX(-15deg); }
}
@keyframes goldThemeGlow {
	0%, 100% { box-shadow: 0 0 8px rgba(255,200,0,0.35), 0 0 0 1px rgba(255,215,0,0.2); }
	50%       { box-shadow: 0 0 22px rgba(255,200,0,0.75), 0 0 0 2px rgba(255,215,0,0.5); }
}
@keyframes goldThemeSweep {
	0%   { background-position: -100% 50%; }
	100% { background-position: 200%  50%; }
}
@keyframes goldSparkle {
	0%, 100% { opacity: 0; transform: scale(0.4); }
	50%       { opacity: 1; transform: scale(1);   }
}
`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeItem {
	id: string;
	name: string;
	description: string;
	price: number;
	type: string;
	owned: boolean;
	preview: Record<string, string>;
}

interface SkinItem {
	id: string;
	name: string;
	description: string;
	price: number;
	type: string;
	rarity: string;
	accent: string;
	owned: boolean;
	included_with?: string;
}

interface ShopData {
	items: ThemeItem[];
	skin_items: SkinItem[];
	currency: number;
	active_theme: string;
	active_streak_skin: string;
}

// ── Rarity config ─────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
	common:    'rgba(160,160,160,0.45)',
	rare:      'rgba(99,102,241,0.55)',
	epic:      'rgba(168,85,247,0.60)',
	legendary: 'rgba(251,191,36,0.65)',
};
const RARITY_BORDER: Record<string, string> = {
	common:    'rgba(180,180,180,0.18)',
	rare:      'rgba(99,102,241,0.22)',
	epic:      'rgba(168,85,247,0.28)',
	legendary: 'rgba(251,191,36,0.32)',
};

// ── Theme preview card ────────────────────────────────────────────────────────

function ThemePreview({ item }: { item: ThemeItem }) {
	const isLight = item.id === 'theme_light';
	const isGold  = item.id === 'theme_gold';
	const isDark  = item.id === 'theme_dark';

	return (
		<div style={{
			width: 60, height: 70, borderRadius: 12, flexShrink: 0,
			background: isGold
				? `linear-gradient(110deg, #1A1510 0%, #2A2318 25%, #FFD700 50%, #2A2318 75%, #1A1510 100%)`
				: `linear-gradient(135deg, ${item.preview.bg_primary}, ${item.preview.bg_secondary})`,
			backgroundSize: isGold ? '300% 100%' : undefined,
			animation: isGold
				? 'goldThemeGlow 1.6s ease-in-out infinite, goldThemeSweep 2s linear infinite'
				: isLight ? 'lightThemeShimmer 2.2s ease-in-out infinite'
				: undefined,
			border: isDark ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${item.preview.primary}33`,
			position: 'relative', overflow: 'hidden',
			display: 'flex', alignItems: 'center', justifyContent: 'center',
		}}>
			{/* mock UI lines */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', zIndex: 1 }}>
				<div style={{ width: 24, height: 5, borderRadius: 3, background: item.preview.primary }} />
				<div style={{ width: 18, height: 3, borderRadius: 2, background: `${item.preview.text_primary}55` }} />
				<div style={{ width: 18, height: 3, borderRadius: 2, background: `${item.preview.text_primary}28` }} />
				<div style={{ width: 14, height: 3, borderRadius: 2, background: `${item.preview.accent}55` }} />
			</div>
			{/* Light: soft shimmer pass */}
			{isLight && (
				<div style={{
					position: 'absolute', top: 0, bottom: 0, width: '35%',
					background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
					animation: 'lightSweep 2.8s ease-in-out 1.4s infinite',
				}} />
			)}
			{/* Gold: bright sweep + corner sparkles */}
			{isGold && <>
				<div style={{
					position: 'absolute', top: 0, bottom: 0, width: '28%',
					background: 'linear-gradient(90deg, transparent, rgba(255,240,160,0.75), transparent)',
					animation: 'lightSweep 1.6s ease-in-out infinite',
					zIndex: 2,
				}} />
				{[{ top: 6, left: 8 }, { top: 10, right: 7 }, { bottom: 9, left: 11 }, { bottom: 7, right: 8 }].map((pos, i) => (
					<div key={i} style={{
						position: 'absolute', ...pos, width: 3, height: 3, borderRadius: '50%',
						background: '#FFE566',
						boxShadow: '0 0 4px 2px #FFE566',
						animation: `goldSparkle 1.2s ease-in-out ${i * 0.28}s infinite`,
						zIndex: 2,
					}} />
				))}
			</>}
		</div>
	);
}

// ── Skin preview ──────────────────────────────────────────────────────────────

function SkinPreview({ skinId }: { skinId: string }) {
	return (
		<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: 60, height: 70, flexShrink: 0 }}>
			{skinId === 'skin_b'  && <FlameSlotB   state="lit" index={3} />}
			{skinId === 'skin_c1' && <FlameSlotOrb cfg={CFG_C1} state="lit" index={3} />}
			{skinId === 'skin_c2' && <FlameSlotOrb cfg={CFG_C2} state="lit" index={3} />}
			{skinId === 'skin_c3' && <FlameSlotOrb cfg={CFG_C3} state="lit" index={3} />}
			{skinId === 'skin_d'  && <FlameSlotD   state="lit" index={3} />}
			{skinId === 'skin_a'  && <FlameSlotA   state="lit" index={3} />}
		</div>
	);
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 8 }}>
			{icon}
			<span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</span>
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Shop() {
	const navigate = useNavigate();
	const { user, updateUser } = useAuthStore();
	const [shop, setShop] = useState<ShopData | null>(null);
	const [buying, setBuying]       = useState<string | null>(null);
	const [activating, setActivating] = useState<string | null>(null);
	const [currency, setCurrency]   = useState(0);
	const [activeSkin, setActiveSkin]   = useState('skin_a');
	const [activeTheme, setActiveTheme] = useState('dark');
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

	useEffect(() => {
		api.get('/gamification/shop').then(res => {
			setShop(res.data);
			setCurrency(res.data.currency);
			setActiveSkin(res.data.active_streak_skin || 'skin_a');
			setActiveTheme(res.data.active_theme || 'dark');
			// Scroll to skins section if linked via #skins
			if (window.location.hash === '#skins') {
				setTimeout(() => {
					document.getElementById('skins-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}, 100);
			}
		}).catch(() => {});
	}, []);

	const flashMsg = (ok: boolean, text: string) => {
		setMsg({ ok, text });
		setTimeout(() => setMsg(null), 3000);
	};

	const buyItem = async (itemId: string) => {
		if (buying) return;
		setBuying(itemId);
		try {
			const res = await api.post('/gamification/shop/buy', { item_id: itemId });
			setCurrency(res.data.currency);
			setShop(prev => {
				if (!prev) return prev;
				const updatedItems = prev.items.map(t => t.id === itemId ? { ...t, owned: true } : t);
				const updatedSkins = prev.skin_items.map(s => s.id === itemId ? { ...s, owned: true }
					// Gold Edition also unlocks Aurum Orb
					: s.id === 'skin_c2' && itemId === 'theme_gold' ? { ...s, owned: true }
					: s);
				return { ...prev, items: updatedItems, skin_items: updatedSkins, currency: res.data.currency };
			});
			updateUser({ settings: {
				...(user?.settings || {}),
				purchased_themes: res.data.purchased_themes,
				purchased_skins: res.data.purchased_skins,
			}});
			flashMsg(true, itemId === 'theme_gold' ? 'Gold Edition unlocked! Aurum Orb included.' : 'Unlocked!');
		} catch (e: any) {
			flashMsg(false, e?.response?.data?.detail || 'Purchase failed');
		} finally {
			setBuying(null);
		}
	};

	const activateThemeItem = async (themeKey: string) => {
		if (activating) return;
		setActivating(themeKey);
		try {
			await api.post('/gamification/shop/activate', { theme: themeKey });
			setActiveTheme(themeKey);
			setShop(prev => prev ? { ...prev, active_theme: themeKey } : prev);
			if (themeKey !== 'dark') {
				document.documentElement.setAttribute('data-theme', 'theme_' + themeKey);
			} else {
				document.documentElement.removeAttribute('data-theme');
			}
			updateUser({ settings: { ...(user?.settings || {}), active_theme: themeKey } });
			flashMsg(true, 'Theme applied!');
		} catch (e: any) {
			flashMsg(false, e?.response?.data?.detail || 'Failed to apply theme');
		} finally {
			setActivating(null);
		}
	};

	const activateSkin = async (skinId: string) => {
		if (activating) return;
		setActivating(skinId);
		try {
			await api.post('/gamification/shop/activate-skin', { skin_id: skinId });
			setActiveSkin(skinId);
			setShop(prev => prev ? { ...prev, active_streak_skin: skinId } : prev);
			updateUser({ settings: { ...(user?.settings || {}), active_streak_skin: skinId } });
			flashMsg(true, 'Skin equipped!');
		} catch (e: any) {
			flashMsg(false, e?.response?.data?.detail || 'Failed to equip skin');
		} finally {
			setActivating(null);
		}
	};

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '0 0 80px' }}>
			<style>{STYLES + THEME_STYLES}</style>

			{/* Header */}
			<div style={{
				position: 'sticky', top: 0, zIndex: 50,
				background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)',
				padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
			}}>
				<button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}>
					<ChevronLeft size={22} />
				</button>
				<div style={{ flex: 1 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<ShoppingBag size={18} color="var(--primary)" />
						<span style={{ fontWeight: 700, fontSize: 17 }}>Shop</span>
					</div>
					<div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Themes & streak skins</div>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '5px 10px' }}>
					<CoinIcon size={14} style={{ color: 'var(--gold)' }} />
					<span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold)' }}>{currency}</span>
				</div>
			</div>

			{/* Feedback */}
			{msg && (
				<div style={{
					margin: '12px 16px 0', padding: '10px 14px', borderRadius: 10,
					background: msg.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
					border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
					fontSize: 13, fontWeight: 600,
					color: msg.ok ? '#4ade80' : '#f87171',
				}}>
					{msg.text}
				</div>
			)}

			{!shop && (
				<div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
			)}

			{shop && (
				<div style={{ padding: '16px 16px 0' }}>

					{/* ── Themes section ────────────────────────────────────────── */}
					<SectionHeading icon={<Palette size={18} color="var(--primary)" />} title="Themes" />

					{shop.items.map(theme => {
						const themeKey = theme.id.replace('theme_', '');
						const isActive = activeTheme === themeKey;
						const canAfford = currency >= theme.price;
						const isGold = theme.id === 'theme_gold';

						return (
							<div key={theme.id} style={{
								background: isActive
									? isGold ? 'linear-gradient(135deg, rgba(30,22,8,0.95), rgba(20,16,5,0.8))' : 'var(--bg-secondary)'
									: 'var(--bg-secondary)',
								border: isActive
									? isGold ? '1.5px solid rgba(255,215,0,0.5)' : '1.5px solid var(--primary)'
									: '1px solid var(--border)',
								borderRadius: 16, padding: '14px', marginBottom: 12,
								boxShadow: isActive && isGold ? '0 0 22px 4px rgba(255,200,0,0.18)' : 'none',
								transition: 'all 0.25s',
							}}>
								<div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
									<ThemePreview item={theme} />
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
											<span style={{ fontWeight: 700, fontSize: 14 }}>{theme.name}</span>
											{isActive && (
												<span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: isGold ? 'rgba(255,215,0,0.18)' : 'rgba(99,102,241,0.18)', color: isGold ? '#FFD700' : 'var(--primary)', fontWeight: 700 }}>Active</span>
											)}
											{isGold && (
												<span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(251,191,36,0.65)', color: '#000', fontWeight: 700 }}>legendary</span>
											)}
										</div>
										<p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 4px', lineHeight: 1.4 }}>
											{theme.description}
										</p>
										{isGold && (
											<p style={{ fontSize: 11, color: '#FFD700', margin: '0 0 8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
												<Flame size={12} color="#FFD700" style={{ flexShrink: 0 }} />Includes Aurum Orb streak skin
											</p>
										)}
										{/* Action */}
										<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
											{theme.owned ? (
												isActive ? (
													<div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: isGold ? '#FFD700' : 'var(--primary)', fontWeight: 600 }}>
														<Check size={14} /> Applied
													</div>
												) : (
													<button
														onClick={() => activateThemeItem(themeKey)}
														disabled={!!activating}
														style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: `1.5px solid ${isGold ? 'rgba(255,215,0,0.4)' : 'var(--primary)'}`, background: isGold ? 'rgba(255,215,0,0.1)' : 'rgba(99,102,241,0.1)', color: isGold ? '#FFD700' : 'var(--primary)', cursor: 'pointer' }}
													>
														Apply
													</button>
												)
											) : (
												<button
													onClick={() => buyItem(theme.id)}
													disabled={!!buying || !canAfford}
													style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: canAfford ? (isGold ? 'linear-gradient(135deg, #B8860B, #FFD700, #B8860B)' : 'linear-gradient(135deg, var(--primary), var(--accent))') : 'rgba(255,255,255,0.06)', color: canAfford ? (isGold ? '#000' : '#fff') : 'var(--text-tertiary)', cursor: (!canAfford || !!buying) ? 'not-allowed' : 'pointer', opacity: buying === theme.id ? 0.6 : 1 }}
												>
													{theme.price === 0 ? 'Free' : <><CoinIcon size={12} /> {theme.price}</>}
												</button>
											)}
											{!theme.owned && !canAfford && theme.price > 0 && (
												<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Need {theme.price - currency} more</span>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}

					{/* ── Streak Skins section ──────────────────────────────────── */}
					<div id="skins-section" style={{ scrollMarginTop: 70 }} />
					<SectionHeading icon={<Flame size={18} color="var(--text-secondary)" />} title="Streak Skins" />

					{shop.skin_items.map(skin => {
						const isActive = activeSkin === skin.id;
						const canAfford = currency >= skin.price;
						const rarityColor  = RARITY_COLORS[skin.rarity]  || RARITY_COLORS.common;
						const rarityBorder = RARITY_BORDER[skin.rarity] || RARITY_BORDER.common;

						return (
							<div key={skin.id} style={{
								background: isActive ? 'linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1))' : 'var(--bg-secondary)',
								border: isActive ? `1.5px solid ${skin.accent}55` : `1px solid ${rarityBorder}`,
								borderRadius: 16, padding: '14px', marginBottom: 12,
								boxShadow: isActive ? `0 0 20px 4px ${skin.accent}22` : 'none',
								transition: 'all 0.25s',
							}}>
								<div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
									<SkinPreview skinId={skin.id} />
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
											<span style={{ fontWeight: 700, fontSize: 14 }}>{skin.name}</span>
											{isActive && (
												<span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: `${skin.accent}22`, color: skin.accent, fontWeight: 700, border: `1px solid ${skin.accent}44` }}>Equipped</span>
											)}
											<span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: rarityColor, color: '#fff', fontWeight: 600, marginLeft: 'auto' }}>{skin.rarity}</span>
										</div>
										<p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4 }}>
											{skin.description}
											{skin.included_with === 'theme_gold' && (
												<span style={{ color: '#FFD700', marginLeft: 4 }}>Included with Gold Edition.</span>
											)}
										</p>
										<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
											{skin.owned ? (
												isActive ? (
													<div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: skin.accent, fontWeight: 600 }}>
														<Check size={14} /> Equipped
													</div>
												) : (
													<button onClick={() => activateSkin(skin.id)} disabled={!!activating} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: `1.5px solid ${skin.accent}55`, background: `${skin.accent}18`, color: skin.accent, cursor: activating ? 'not-allowed' : 'pointer', opacity: activating === skin.id ? 0.6 : 1 }}>
														Equip
													</button>
												)
											) : (
												<button onClick={() => buyItem(skin.id)} disabled={!!buying || !canAfford} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: canAfford ? `linear-gradient(135deg, ${skin.accent}cc, ${skin.accent}88)` : 'rgba(255,255,255,0.06)', color: canAfford ? '#000' : 'var(--text-tertiary)', cursor: (buying || !canAfford) ? 'not-allowed' : 'pointer', opacity: buying === skin.id ? 0.6 : 1 }}>
													{skin.price === 0 ? 'Free' : <><CoinIcon size={12} /> {skin.price}</>}
												</button>
											)}
											{!skin.owned && !canAfford && skin.price > 0 && (
												<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Need {skin.price - currency} more</span>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}

					<div style={{ padding: '4px 4px 16px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
						Skins change your streak display on the Home screen.
					</div>
				</div>
			)}
		</div>
	);
}
