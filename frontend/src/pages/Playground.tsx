import { useState } from 'react';
import { Flame } from 'lucide-react';
import CoinIcon from '../components/icons/CoinIcon';
import {
	STYLES, SLOT_SCALES, CRYSTAL_CLIP, PX_COLORS,
	CFG_C1, CFG_C2, CFG_C3,
	getState, fmtDate,
	FlameRow, FlameSlotA, FlameSlotB, FlameSlotOrb, FlameSlotD,
} from '../components/StreakFlames';
import type { WeekSlot, FlameState, OrbCfg } from '../components/StreakFlames';

// ── Mock data ─────────────────────────────────────────────────────────────────

const BASE_WEEKS: WeekSlot[] = [
	{ week: '',         start_date: '',           sessions: -1, claimed: false },
	{ week: '2026-W07', start_date: '2026-02-09', sessions:  0, claimed: false },
	{ week: '2026-W08', start_date: '2026-02-16', sessions:  3, claimed: true  },
	{ week: '2026-W09', start_date: '2026-02-23', sessions:  2, claimed: true  },
	{ week: '2026-W10', start_date: '2026-03-02', sessions:  2, claimed: true  },
	{ week: '2026-W11', start_date: '2026-03-09', sessions:  4, claimed: true  },
	{ week: '2026-W13', start_date: '2026-03-23', sessions:  1, claimed: false },
];

// Re-export so Playground still type-checks (no runtime use)
export type { WeekSlot, FlameState, OrbCfg };
export { SLOT_SCALES, CRYSTAL_CLIP, PX_COLORS };

// ── Shared section styles ─────────────────────────────────────────────────────

const sectionCard: React.CSSProperties = {
	background: 'var(--bg-secondary, #1a1a1a)',
	border: '1px solid var(--border, #2e2e2e)',
	borderRadius: 18, padding: '22px 16px 20px', marginBottom: 22,
};
const variantLabel: React.CSSProperties  = { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary, #666)', textTransform: 'uppercase', marginBottom: 2 };
const variantTitle: React.CSSProperties  = { fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #fff)', marginBottom: 3 };
const variantDesc: React.CSSProperties   = { fontSize: 11, color: 'var(--text-secondary, #999)', marginBottom: 18, lineHeight: 1.4 };

// ── Variant wrapper helpers ───────────────────────────────────────────────────

function useClaim() {
	const [claimed, setClaimed]   = useState(false);
	const [flashing, setFlashing] = useState(false);
	const handleClaim = () => { setFlashing(true); setTimeout(() => { setFlashing(false); setClaimed(true); }, 520); };
	return { claimed, flashing, handleClaim };
}

// ── Variant A ─────────────────────────────────────────────────────────────────

function VariantA() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={sectionCard}>
			<div style={variantLabel}>Variant A</div>
			<div style={variantTitle}>Ember — Campfire</div>
			<div style={variantDesc}>Organic layered flame with rising licks. Charcoal smoke on extinguished.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS} highlightColor="rgba(255,120,0,0.14)"
				pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
					? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFA040', boxShadow: '0 0 5px 2px rgba(255,140,50,0.6)', animation: 'pendingDot 0.9s ease-in-out infinite' }} />
					: null}
				getSlot={(w, i) => <FlameSlotA state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
			/>
			<ClaimButton claimed={claimed} onClaim={handleClaim} color="linear-gradient(135deg, #FF8C00, #FF4500)" icon={<Flame size={15} />} label="Claim" />
		</div>
	);
}

// ── Variant B ─────────────────────────────────────────────────────────────────

function VariantB() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={{ ...sectionCard, background: 'linear-gradient(160deg, #1a0030 0%, #1a1a1a 60%)' }}>
			<div style={variantLabel}>Variant B</div>
			<div style={variantTitle}>Arcane — Crystal Flame</div>
			<div style={variantDesc}>Angular faceted crystal with violet/white gradient. Wind-blown tip motion.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS} highlightColor="rgba(170,0,255,0.14)"
				pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
					? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#CE93D8', boxShadow: '0 0 6px 2px rgba(200,100,255,0.7)', animation: 'pendingDot 1s ease-in-out infinite' }} />
					: null}
				getSlot={(w, i) => <FlameSlotB state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
			/>
			<ClaimButton claimed={claimed} onClaim={handleClaim} color="linear-gradient(135deg, #7B1FA2, #E040FB)" icon={<span>✦</span>} label="Claim" claimedText="✦ Arcane power claimed!" claimedColor="#CE93D8" />
		</div>
	);
}

// ── Orb variant factory ───────────────────────────────────────────────────────

function makeOrbVariant(label: string, title: string, desc: string, cfg: OrbCfg, accent: string, bgGrad?: string) {
	return function OrbVariant() {
		const { claimed, flashing, handleClaim } = useClaim();
		return (
			<div style={{ ...sectionCard, ...(bgGrad ? { background: bgGrad } : {}) }}>
				<div style={variantLabel}>{label}</div>
				<div style={variantTitle}>{title}</div>
				<div style={variantDesc}>{desc}</div>
				<FlameRow
					BASE_WEEKS={BASE_WEEKS} highlightColor={accent}
					pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
						? <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.sparkColors[0], boxShadow: `0 0 5px 2px ${cfg.sparkColors[0]}88`, animation: 'pendingDot 1s ease-in-out infinite' }} />
						: null}
					getSlot={(w, i) => <FlameSlotOrb cfg={cfg} state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
				/>
				<div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
					{!claimed ? (
						<button onClick={handleClaim} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `rgba(${cfg.glowColor},0.18)`, color: cfg.sparkColors[1], border: `1.5px solid rgba(${cfg.glowColor},0.38)`, borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)', animation: 'claimBtnPulse 1.8s ease-in-out infinite' }}>
							✦ Claim +10 <CoinIcon size={13} />
						</button>
					) : (
						<div style={{ fontSize: 13, color: cfg.sparkColors[1], fontWeight: 600 }}>✦ Orb claimed! +10 coins</div>
					)}
				</div>
			</div>
		);
	};
}

const VariantC1 = makeOrbVariant('Variant C1', 'Inferno Orb — Fire',  'Molten fire sphere, rotating inner swirl, 3 orbiting sparks when claimable.',         CFG_C1, 'rgba(255,100,0,0.14)');
const VariantC2 = makeOrbVariant('Variant C2', 'Aurum Orb — Gold',    'Liquid gold sphere. Slow reverse swirl. Sweeping sheen + caustic blob.',              CFG_C2, 'rgba(220,170,0,0.14)', 'linear-gradient(160deg, #1a1200 0%, #1a1a1a 60%)');
const VariantC3 = makeOrbVariant('Variant C3', 'Tempest Orb — Storm', 'Electric blue sphere. Lightning bolts arc inside. Fast swirl + triple orbit sparks.', CFG_C3, 'rgba(30,120,255,0.14)',  'linear-gradient(160deg, #00051a 0%, #1a1a1a 60%)');

// ── Variant D ─────────────────────────────────────────────────────────────────

function VariantD() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={{ ...sectionCard, background: 'linear-gradient(160deg, #0d0d00 0%, #1a1a1a 55%)', border: '1px solid rgba(255,100,0,0.25)' }}>
			<div style={{ ...variantLabel, fontFamily: 'monospace' }}>Variant D</div>
			<div style={{ ...variantTitle, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>8-BIT — Pixel Fire</div>
			<div style={{ ...variantDesc, fontFamily: 'monospace', fontSize: 10 }}>Stacked pixel blocks with steps() jumps. Scanline CRT overlay. Chunky retro feel.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS} highlightColor="rgba(255,100,0,0.15)"
				dateFont={{ fontFamily: 'monospace', letterSpacing: '-0.02em' }}
				pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
					? <div style={{ width: 4, height: 4, background: PX_COLORS.l4, animation: 'pxBlink 0.5s steps(2) infinite', imageRendering: 'pixelated' }} />
					: null}
				getSlot={(w, i) => <FlameSlotD state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
			/>
			<div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
				{!claimed ? (
					<button onClick={handleClaim} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: PX_COLORS.l4, border: `2px solid ${PX_COLORS.l3}`, borderRadius: 0, padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.06em', animation: 'pxBlink 1.2s steps(2) infinite' }}>
						▶ CLAIM +10 COINS
					</button>
				) : (
					<div style={{ fontSize: 12, color: PX_COLORS.l4, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em' }}>▶ CLAIMED! +10 COINS</div>
				)}
			</div>
		</div>
	);
}

// ── Reusable claim button ─────────────────────────────────────────────────────

function ClaimButton({ claimed, onClaim, color, icon, label, claimedText, claimedColor }: {
	claimed: boolean; onClaim: () => void; color: string;
	icon: React.ReactNode; label: string;
	claimedText?: string; claimedColor?: string;
}) {
	return (
		<div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
			{!claimed ? (
				<button onClick={onClaim} style={{ display: 'flex', alignItems: 'center', gap: 6, background: color, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', animation: 'claimBtnPulse 1.8s ease-in-out infinite' }}>
					{icon} {label} +10 <CoinIcon size={13} />
				</button>
			) : (
				<div style={{ fontSize: 13, color: claimedColor || '#FF8C00', fontWeight: 600 }}>{claimedText || `✓ Claimed! +10 coins`}</div>
			)}
		</div>
	);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Playground() {
	return (
		<div style={{ minHeight: '100vh', background: 'var(--bg-primary, #121212)', padding: '22px 14px 80px', maxWidth: 460, margin: '0 auto' }}>
			<style>{STYLES}</style>

			<div style={{ marginBottom: 26 }}>
				<div style={{ fontSize: 21, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔥 Streak Skins</div>
				<div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
					6 variants · current week is largest · each shows{' '}
					<span style={{ color: 'rgba(255,255,255,0.3)' }}>empty</span> ·{' '}
					<span style={{ color: '#555' }}>dead</span> ·{' '}
					<span style={{ color: '#FF8C00' }}>lit ×4</span> ·{' '}
					<span style={{ color: '#FFD600' }}>claimable</span>
				</div>
			</div>

			<VariantA />
			<VariantB />
			<VariantC1 />
			<VariantC2 />
			<VariantC3 />
			<VariantD />
		</div>
	);
}
