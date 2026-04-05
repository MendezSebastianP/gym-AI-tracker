import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
	Activity,
	BarChart3,
	ChevronLeft,
	ChevronRight,
	Dumbbell,
	Flame,
	Play,
	Sparkles,
	TimerReset,
	Wand2,
	Zap,
} from 'lucide-react';
import CoinIcon from '../components/icons/CoinIcon';
import {
	STYLES,
	SLOT_SCALES,
	CRYSTAL_CLIP,
	PX_COLORS,
	CFG_C1,
	CFG_C2,
	CFG_C3,
	getState,
	FlameRow,
	FlameSlotA,
	FlameSlotB,
	FlameSlotOrb,
	FlameSlotD,
} from '../components/StreakFlames';
import type { WeekSlot, FlameState, OrbCfg } from '../components/StreakFlames';
import { motionTokens } from '../motion/routes';

const BASE_WEEKS: WeekSlot[] = [
	{ week: '', start_date: '', sessions: -1, claimed: false },
	{ week: '2026-W07', start_date: '2026-02-09', sessions: 0, claimed: false },
	{ week: '2026-W08', start_date: '2026-02-16', sessions: 3, claimed: true },
	{ week: '2026-W09', start_date: '2026-02-23', sessions: 2, claimed: true },
	{ week: '2026-W10', start_date: '2026-03-02', sessions: 2, claimed: true },
	{ week: '2026-W11', start_date: '2026-03-09', sessions: 4, claimed: true },
	{ week: '2026-W13', start_date: '2026-03-23', sessions: 1, claimed: false },
];

export type { WeekSlot, FlameState, OrbCfg };
export { SLOT_SCALES, CRYSTAL_CLIP, PX_COLORS };

type PlaygroundTab = 'cta' | 'claim' | 'ai' | 'session' | 'nav' | 'pages' | 'streak' | 'logos';
type PageFlowKind = 'public' | 'peer' | 'stack';

const tabs: Array<{ id: PlaygroundTab; label: string }> = [
	{ id: 'cta', label: 'Primary CTA' },
	{ id: 'claim', label: 'Claim / Reward' },
	{ id: 'ai', label: 'AI Actions' },
	{ id: 'session', label: 'Session Controls' },
	{ id: 'nav', label: 'Navigation' },
	{ id: 'pages', label: 'Page Transitions' },
	{ id: 'streak', label: 'Streak Skins' },
	{ id: 'logos', label: 'Logo Lab' },
];

const sectionCard: React.CSSProperties = {
	background: 'var(--bg-secondary, #1a1a1a)',
	border: '1px solid var(--border, #2e2e2e)',
	borderRadius: 18,
	padding: '22px 16px 20px',
	marginBottom: 22,
};
const variantLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary, #666)', textTransform: 'uppercase', marginBottom: 2 };
const variantTitle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: 'var(--text-primary, #fff)', marginBottom: 3 };
const variantDesc: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary, #999)', marginBottom: 18, lineHeight: 1.4 };

function useClaim() {
	const [claimed, setClaimed] = useState(false);
	const [flashing, setFlashing] = useState(false);
	const handleClaim = () => {
		setFlashing(true);
		setTimeout(() => {
			setFlashing(false);
			setClaimed(true);
		}, 520);
	};
	return { claimed, flashing, handleClaim };
}

function VariantA() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={sectionCard}>
			<div style={variantLabel}>Variant A</div>
			<div style={variantTitle}>Ember — Campfire</div>
			<div style={variantDesc}>Organic layered flame with rising licks. Charcoal smoke on extinguished.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS}
				highlightColor="rgba(255,120,0,0.14)"
				pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
					? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFA040', boxShadow: '0 0 5px 2px rgba(255,140,50,0.6)', animation: 'pendingDot 0.9s ease-in-out infinite' }} />
					: null}
				getSlot={(w, i) => <FlameSlotA state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
			/>
			<ClaimButton claimed={claimed} onClaim={handleClaim} color="linear-gradient(135deg, #FF8C00, #FF4500)" icon={<Flame size={15} />} label="Claim" />
		</div>
	);
}

function VariantB() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={{ ...sectionCard, background: 'linear-gradient(160deg, #1a0030 0%, #1a1a1a 60%)' }}>
			<div style={variantLabel}>Variant B</div>
			<div style={variantTitle}>Arcane — Crystal Flame</div>
			<div style={variantDesc}>Angular faceted crystal with violet/white gradient. Wind-blown tip motion.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS}
				highlightColor="rgba(170,0,255,0.14)"
				pendingDotEl={(i) => getState(BASE_WEEKS[i], i === 6 && claimed) === 'pending'
					? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#CE93D8', boxShadow: '0 0 6px 2px rgba(200,100,255,0.7)', animation: 'pendingDot 1s ease-in-out infinite' }} />
					: null}
				getSlot={(w, i) => <FlameSlotB state={getState(w, i === 6 && claimed)} index={i} flashing={i === 6 && flashing} />}
			/>
			<ClaimButton claimed={claimed} onClaim={handleClaim} color="linear-gradient(135deg, #7B1FA2, #E040FB)" icon={<span>✦</span>} label="Claim" claimedText="✦ Arcane power claimed!" claimedColor="#CE93D8" />
		</div>
	);
}

function makeOrbVariant(label: string, title: string, desc: string, cfg: OrbCfg, accent: string, bgGrad?: string) {
	return function OrbVariant() {
		const { claimed, flashing, handleClaim } = useClaim();
		return (
			<div style={{ ...sectionCard, ...(bgGrad ? { background: bgGrad } : {}) }}>
				<div style={variantLabel}>{label}</div>
				<div style={variantTitle}>{title}</div>
				<div style={variantDesc}>{desc}</div>
				<FlameRow
					BASE_WEEKS={BASE_WEEKS}
					highlightColor={accent}
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

const VariantC1 = makeOrbVariant('Variant C1', 'Inferno Orb — Fire', 'Molten fire sphere, rotating inner swirl, 3 orbiting sparks when claimable.', CFG_C1, 'rgba(255,100,0,0.14)');
const VariantC2 = makeOrbVariant('Variant C2', 'Aurum Orb — Gold', 'Liquid gold sphere. Slow reverse swirl. Sweeping sheen + caustic blob.', CFG_C2, 'rgba(220,170,0,0.14)', 'linear-gradient(160deg, #1a1200 0%, #1a1a1a 60%)');
const VariantC3 = makeOrbVariant('Variant C3', 'Tempest Orb — Storm', 'Electric blue sphere. Lightning bolts arc inside. Fast swirl + triple orbit sparks.', CFG_C3, 'rgba(30,120,255,0.14)', 'linear-gradient(160deg, #00051a 0%, #1a1a1a 60%)');

function VariantD() {
	const { claimed, flashing, handleClaim } = useClaim();
	return (
		<div style={{ ...sectionCard, background: 'linear-gradient(160deg, #0d0d00 0%, #1a1a1a 55%)', border: '1px solid rgba(255,100,0,0.25)' }}>
			<div style={{ ...variantLabel, fontFamily: 'monospace' }}>Variant D</div>
			<div style={{ ...variantTitle, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>8-BIT — Pixel Fire</div>
			<div style={{ ...variantDesc, fontFamily: 'monospace', fontSize: 10 }}>Stacked pixel blocks with steps() jumps. Scanline CRT overlay. Chunky retro feel.</div>
			<FlameRow
				BASE_WEEKS={BASE_WEEKS}
				highlightColor="rgba(255,100,0,0.15)"
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

function ClaimButton({ claimed, onClaim, color, icon, label, claimedText, claimedColor }: {
	claimed: boolean;
	onClaim: () => void;
	color: string;
	icon: ReactNode;
	label: string;
	claimedText?: string;
	claimedColor?: string;
}) {
	return (
		<div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
			{!claimed ? (
				<button onClick={onClaim} style={{ display: 'flex', alignItems: 'center', gap: 6, background: color, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', animation: 'claimBtnPulse 1.8s ease-in-out infinite' }}>
					{icon} {label} +10 <CoinIcon size={13} />
				</button>
			) : (
				<div style={{ fontSize: 13, color: claimedColor || '#FF8C00', fontWeight: 600 }}>{claimedText || '✓ Claimed! +10 coins'}</div>
			)}
		</div>
	);
}

function LabCard({
	eyebrow,
	title,
	description,
	recommended = false,
	children,
}: {
	eyebrow: string;
	title: string;
	description: string;
	recommended?: boolean;
	children: ReactNode;
}) {
	return (
		<div className={`motion-lab-card ${recommended ? 'is-recommended' : ''}`.trim()}>
			<div className="motion-lab-card-head">
				<div>
					<div className="motion-lab-kicker">{eyebrow}</div>
					<strong>{title}</strong>
					<p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{description}</p>
				</div>
				{recommended ? <span className="motion-lab-reco">Recommended</span> : null}
			</div>
			{children}
		</div>
	);
}

function PrimaryCTATab() {
	return (
		<div className="motion-lab-grid">
			<LabCard eyebrow="Variant A" title="Lift + sheen" description="Best balance for landing and auth. Keeps the click readable and premium." recommended>
				<div className="motion-lab-state-row">
					<div className="motion-lab-state">
						<span>Logged out</span>
						<button className="btn motion-btn motion-btn--cta motion-btn--public" style={{ background: 'var(--primary)', color: '#000', padding: '12px 18px', borderRadius: 999, border: 'none', fontWeight: 800 }}>Register</button>
						<button className="btn motion-btn motion-btn--cta motion-btn--soft motion-btn--public" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', padding: '12px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>Login</button>
					</div>
					<div className="motion-lab-state">
						<span>In app</span>
						<button className="btn motion-btn motion-btn--cta" style={{ background: 'var(--primary)', color: '#000', padding: '12px 18px', borderRadius: 14, border: 'none', fontWeight: 800 }}>Start Workout</button>
						<button className="btn motion-btn motion-btn--cta motion-btn--soft" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>Create Routine</button>
					</div>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant B" title="Edge charge" description="Lighter lift, more border energy. Cleaner if we want less glow and more precision.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--cta motion-btn--soft" style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary-border)', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>Register</button>
					<button className="btn motion-btn motion-btn--cta motion-btn--soft" style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 18px', borderRadius: 999, fontWeight: 700 }}>Login</button>
					<button className="btn motion-btn motion-btn--cta motion-btn--soft" style={{ background: 'rgba(204,255,0,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(204,255,0,0.18)', padding: '12px 18px', borderRadius: 14, fontWeight: 700 }}>Create Routine</button>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant C" title="Magnetic surface" description="More expressive and heavier. Stronger presence, but easier to overuse.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--cta" style={{ background: 'linear-gradient(135deg, var(--primary), #00e5b0)', color: '#000', padding: '12px 18px', borderRadius: 999, border: 'none', fontWeight: 800 }}>Register</button>
					<button className="btn motion-btn motion-btn--cta motion-btn--soft" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color: 'var(--text-primary)', padding: '12px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>Login</button>
					<button className="btn motion-btn motion-btn--cta" style={{ background: 'linear-gradient(135deg, var(--primary), #97ff48)', color: '#000', padding: '12px 18px', borderRadius: 14, border: 'none', fontWeight: 800 }}>Start Workout</button>
				</div>
			</LabCard>
		</div>
	);
}

function ClaimRewardTab() {
	return (
		<div className="motion-lab-grid">
			<LabCard eyebrow="Variant A" title="Coin pulse" description="Best fit for real Home claims. Clear ready state, satisfying burst, then calm claimed state." recommended>
				<div className="motion-lab-state-row">
					<div className="motion-lab-state">
						<span>Locked</span>
						<button className="btn motion-btn motion-btn--claim is-claimed" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>Finish 1 more point</button>
					</div>
					<div className="motion-lab-state">
						<span>Ready</span>
						<button className="btn motion-btn motion-btn--claim is-ready" style={{ background: 'linear-gradient(135deg, #FFD76A, #F59E0B)', color: '#1b1200', padding: '12px 18px', borderRadius: 14, border: 'none', fontWeight: 800 }}>Claim +50 <CoinIcon size={14} /></button>
					</div>
					<div className="motion-lab-state">
						<span>Claiming</span>
						<button className="btn motion-btn motion-btn--claim is-ready is-bursting" style={{ background: 'linear-gradient(135deg, #FFD76A, #F59E0B)', color: '#1b1200', padding: '12px 18px', borderRadius: 14, border: 'none', fontWeight: 800 }}>Collecting...</button>
					</div>
					<div className="motion-lab-state">
						<span>Claimed</span>
						<button className="btn motion-btn motion-btn--claim is-claimed" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>Claimed</button>
					</div>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant B" title="Sweep burst" description="More horizontal glint. Feels a little more premium, a little less tactile.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--claim is-ready" style={{ background: 'rgba(255, 214, 10, 0.12)', color: '#FFE58A', border: '1px solid rgba(255, 214, 10, 0.28)', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>Claim weekly coins</button>
					<button className="btn motion-btn motion-btn--claim is-ready is-bursting" style={{ background: 'rgba(255, 214, 10, 0.12)', color: '#FFE58A', border: '1px solid rgba(255, 214, 10, 0.28)', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>Claim quest reward</button>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant C" title="Vault pop" description="Most playful of the three. Good for rewards, but easiest to make too loud.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--claim is-ready" style={{ background: 'linear-gradient(135deg, #FFED9E, #F5C542)', color: '#2a2100', padding: '12px 18px', borderRadius: 16, border: 'none', fontWeight: 800 }}>Claim +21</button>
					<button className="btn motion-btn motion-btn--claim is-ready is-bursting" style={{ background: 'linear-gradient(135deg, #FFED9E, #F5C542)', color: '#2a2100', padding: '12px 18px', borderRadius: 16, border: 'none', fontWeight: 800 }}>Claim +50</button>
				</div>
			</LabCard>
		</div>
	);
}

function AIActionsTab() {
	return (
		<div className="motion-lab-grid">
			<LabCard eyebrow="Variant A" title="Spark trace" description="Best production direction. Active enough to feel special, calm enough to stay believable." recommended>
				<div className="motion-lab-state-row">
					<div className="motion-lab-state">
						<span>Idle</span>
						<button className="btn motion-btn motion-btn--ai" style={{ background: 'linear-gradient(135deg, rgba(204,255,0,0.18), rgba(0,229,176,0.16))', color: 'var(--text-primary)', border: '1px solid rgba(204,255,0,0.25)', padding: '12px 18px', borderRadius: 14, fontWeight: 800 }}><Wand2 size={16} /> Generate with AI</button>
					</div>
					<div className="motion-lab-state">
						<span>Loading</span>
						<button className="btn motion-btn motion-btn--ai is-loading" style={{ background: 'linear-gradient(135deg, rgba(204,255,0,0.18), rgba(0,229,176,0.16))', color: 'var(--text-primary)', border: '1px solid rgba(204,255,0,0.25)', padding: '12px 18px', borderRadius: 14, fontWeight: 800 }}>Analysing...</button>
					</div>
					<div className="motion-lab-state">
						<span>Low coins</span>
						<button className="btn motion-btn motion-btn--ai is-low-coins" style={{ background: 'rgba(255, 179, 71, 0.12)', color: '#FFB347', border: '1px solid rgba(255, 179, 71, 0.28)', padding: '12px 18px', borderRadius: 14, fontWeight: 800 }}>Go to quests</button>
					</div>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant B" title="Scan beam" description="Feels more futuristic and more visible. Good if we want AI to read as a stronger product surface.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--ai" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--primary)', border: '1px solid rgba(204,255,0,0.26)', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}><Sparkles size={16} /> Generate report</button>
					<button className="btn motion-btn motion-btn--ai is-loading" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--primary)', border: '1px solid rgba(204,255,0,0.26)', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>Checking progress...</button>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant C" title="Orbit spark" description="Most expressive. Good for Playground, probably too playful for broad rollout.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--ai" style={{ background: 'linear-gradient(135deg, rgba(204,255,0,0.14), rgba(99,102,241,0.16))', color: 'var(--text-primary)', border: '1px solid rgba(99,102,241,0.24)', padding: '12px 18px', borderRadius: 16, fontWeight: 800 }}>Suggest progression</button>
					<button className="btn motion-btn motion-btn--ai is-low-coins" style={{ background: 'linear-gradient(135deg, rgba(255,179,71,0.12), rgba(255,255,255,0.03))', color: '#FFB347', border: '1px solid rgba(255,179,71,0.24)', padding: '12px 18px', borderRadius: 16, fontWeight: 800 }}>Need more coins</button>
				</div>
			</LabCard>
		</div>
	);
}

function SessionControlsTab() {
	return (
		<div className="motion-lab-grid">
			<LabCard eyebrow="Variant A" title="Snap press" description="Best match for workout logging. Tight, direct, and fast under repetition." recommended>
				<div className="motion-lab-state-row">
					<div className="motion-lab-state">
						<span>Toolbar</span>
						<button className="btn motion-btn motion-btn--session motion-btn--soft" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: 12, fontWeight: 700 }}><TimerReset size={14} /> Rest</button>
						<button className="btn motion-btn motion-btn--ai motion-btn--soft" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--accent)', border: '1px solid rgba(0,229,176,0.22)', padding: '10px 14px', borderRadius: 12, fontWeight: 700 }}>Check suggestions</button>
					</div>
					<div className="motion-lab-state">
						<span>Exercise</span>
						<button className="btn motion-btn motion-btn--session" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 18px', borderRadius: 12, fontWeight: 700 }}>+ Add Set</button>
						<button className="btn motion-btn motion-btn--session motion-btn--soft" style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px dashed rgba(245,158,11,0.6)', padding: '12px 18px', borderRadius: 12, fontWeight: 700 }}>+ Add Drop Set</button>
					</div>
					<div className="motion-lab-state">
						<span>Completion</span>
						<button className="btn motion-btn motion-btn--session" style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>All done</button>
						<button className="btn motion-btn motion-btn--session is-finish" style={{ background: 'var(--primary)', color: '#000', border: 'none', padding: '12px 18px', borderRadius: 999, fontWeight: 800 }}>Finish</button>
					</div>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant B" title="Insert pulse" description="Better for add-set actions than for finish. Slightly more visible than the recommended direction.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--session" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 18px', borderRadius: 14, fontWeight: 700 }}>+ Add Set</button>
					<button className="btn motion-btn motion-btn--session is-finish" style={{ background: 'linear-gradient(135deg, var(--primary), #97ff48)', color: '#000', border: 'none', padding: '12px 18px', borderRadius: 14, fontWeight: 800 }}>Finish workout</button>
				</div>
			</LabCard>

			<LabCard eyebrow="Variant C" title="Check stamp" description="Most celebratory. Good for completed-state buttons, too heavy for every workout action.">
				<div className="motion-lab-stack">
					<button className="btn motion-btn motion-btn--session" style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 16, fontWeight: 800 }}>Apply suggestion</button>
					<button className="btn motion-btn motion-btn--session" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 18px', borderRadius: 16, fontWeight: 700 }}>Collapse all</button>
				</div>
			</LabCard>
		</div>
	);
}

function NavPreviewCard({
	title,
	description,
	recommended = false,
	frameTone,
}: {
	title: string;
	description: string;
	recommended?: boolean;
	frameTone: 'default' | 'soft' | 'glow';
}) {
	const [active, setActive] = useState('/sessions');
	const frameStyle = useMemo<React.CSSProperties>(() => {
		if (frameTone === 'soft') {
			return { background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18))' };
		}
		if (frameTone === 'glow') {
			return { background: 'linear-gradient(180deg, rgba(204,255,0,0.08), rgba(0,0,0,0.22))', borderColor: 'rgba(204,255,0,0.18)' };
		}
		return {};
	}, [frameTone]);

	const navItems = [
		{ id: '/home', label: 'Home', icon: Activity },
		{ id: '/dashboard', label: 'Stats', icon: BarChart3 },
		{ id: '/sessions', label: 'Sessions', icon: Play },
		{ id: '/routines', label: 'Routines', icon: Dumbbell },
		{ id: '/settings', label: 'Settings', icon: Zap },
	];

	return (
		<LabCard eyebrow="Navigation" title={title} description={description} recommended={recommended}>
			<div className="motion-lab-nav-preview" style={frameStyle}>
				<LayoutGroup>
					<div className="app-nav-inner" style={{ width: '100%' }}>
						{navItems.map((item) => {
							const Icon = item.icon;
							const selected = active === item.id;
							return (
								<button key={item.id} type="button" className="app-nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setActive(item.id)}>
									<div className="app-nav-item-frame">
										{selected ? (
											<motion.span layoutId={`nav-pill-${title}`} className="app-nav-pill" transition={motionTokens.spring.nav} />
										) : null}
										<motion.span animate={{ y: selected ? -2 : 0, scale: selected ? 1.04 : 1 }} transition={{ duration: 0.22, ease: motionTokens.ease.out }}>
											<Icon size={20} color={selected ? 'var(--primary)' : 'var(--text-tertiary)'} />
										</motion.span>
										<motion.span className="app-nav-item-label" animate={{ opacity: selected ? 1 : 0.78, y: selected ? 0 : 1, color: selected ? 'var(--primary)' : 'var(--text-tertiary)' }} transition={{ duration: 0.22, ease: motionTokens.ease.out }}>{item.label}</motion.span>
									</div>
								</button>
							);
						})}
					</div>
				</LayoutGroup>
			</div>
		</LabCard>
	);
}

function NavigationTab() {
	return (
		<div className="motion-lab-grid">
			<NavPreviewCard title="Sliding pill" description="Best fit for the app shell. Reads clearly on mobile and makes route changes feel connected." recommended frameTone="default" />
			<NavPreviewCard title="Underline rail" description="Lighter, quieter, and more neutral. Good if we want less glow in the shell." frameTone="soft" />
			<NavPreviewCard title="Glow dock" description="Most expressive. Works visually, but it starts to compete with the page content." frameTone="glow" />
		</div>
	);
}

const pageFlows: Record<PageFlowKind, Array<{ id: string; title: string; chips: string[]; blocks: string[] }>> = {
	public: [
		{ id: 'landing', title: 'Landing', chips: ['Preview panels', 'Scroll cue', 'Register CTA'], blocks: ['Hero proof stack', 'Readable charts', 'AI and rewards'] },
		{ id: 'login', title: 'Login', chips: ['Back to home', 'Language switcher'], blocks: ['Email', 'Password', 'Continue to Home'] },
		{ id: 'register', title: 'Register', chips: ['Back to home', 'Legal links'], blocks: ['Email', 'Password', 'Create account'] },
	],
	peer: [
		{ id: 'home', title: 'Home', chips: ['Getting Started', 'Streak', 'Quests'], blocks: ['Claim reward', 'Current level', 'Progress cards'] },
		{ id: 'sessions', title: 'Sessions', chips: ['Up next', 'Resume', 'History'], blocks: ['Start Workout', 'Routine filter', 'Session history'] },
		{ id: 'routines', title: 'Routines', chips: ['Active routine', 'New'], blocks: ['Routine cards', 'Progress report', 'Archive'] },
	],
	stack: [
		{ id: 'list', title: 'Routines', chips: ['List view', 'Active'], blocks: ['Routine cards', 'New routine'] },
		{ id: 'detail', title: 'Routine Detail', chips: ['Edit', 'Start'], blocks: ['Day structure', 'Exercise list'] },
		{ id: 'report', title: 'Progression Report', chips: ['AI report', 'Apply all'], blocks: ['Assessment', 'Exercise changes'] },
	],
};

function PageTransitionPreview() {
	const [flow, setFlow] = useState<PageFlowKind>('public');
	const [index, setIndex] = useState(0);
	const [frame, setFrame] = useState<'mobile' | 'desktop'>('mobile');
	const [reduced, setReduced] = useState(false);
	const [direction, setDirection] = useState<1 | -1>(1);

	const pages = pageFlows[flow];
	const current = pages[index];

	const step = (nextDirection: 1 | -1) => {
		setDirection(nextDirection);
		setIndex((currentIndex) => {
			const nextIndex = currentIndex + nextDirection;
			if (nextIndex < 0) return pages.length - 1;
			if (nextIndex >= pages.length) return 0;
			return nextIndex;
		});
	};

	return (
		<div className="motion-lab-grid" style={{ gridTemplateColumns: '1fr' }}>
			<LabCard eyebrow="Route choreography" title="Page transition simulator" description="Tests the three route families before we wire every screen. Includes direction, frame size, and reduced-motion toggles." recommended>
				<div className="motion-lab-controls">
					{(['public', 'peer', 'stack'] as PageFlowKind[]).map((kind) => (
						<button key={kind} type="button" className="motion-lab-control-btn" onClick={() => { setFlow(kind); setIndex(0); }} style={flow === kind ? { color: 'var(--primary)', borderColor: 'var(--primary-border)' } : undefined}>
							{kind === 'public' ? 'Public flow' : kind === 'peer' ? 'App peer flow' : 'App stack flow'}
						</button>
					))}
					<button type="button" className="motion-lab-control-btn" onClick={() => setFrame((currentFrame) => currentFrame === 'mobile' ? 'desktop' : 'mobile')}>
						{frame === 'mobile' ? 'Switch to desktop' : 'Switch to mobile'}
					</button>
					<button type="button" className="motion-lab-control-btn" onClick={() => setReduced((currentReduced) => !currentReduced)}>
						{reduced ? 'Disable reduced motion' : 'Enable reduced motion'}
					</button>
				</div>

				<div className="motion-lab-page-frame" style={{ maxWidth: frame === 'mobile' ? 420 : '100%', justifySelf: frame === 'mobile' ? 'center' : 'stretch' }}>
					<div className="motion-lab-frame-label">{frame === 'mobile' ? 'Mobile frame' : 'Desktop frame'}</div>
					<div className="motion-lab-page-viewport" style={{ height: frame === 'mobile' ? 260 : 220 }}>
						<AnimatePresence mode="wait" initial={false} custom={{ direction, reduced }}>
							<motion.div
								key={`${flow}-${current.id}`}
								className="motion-lab-page-content"
								custom={{ direction, reduced }}
								initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 28 : -18, scale: flow === 'stack' ? 0.992 : 0.997, filter: 'blur(8px)' }}
								animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', transition: { duration: flow === 'public' ? 0.36 : 0.26, ease: motionTokens.ease.out } }}
								exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -14 : 18, scale: 0.996, filter: 'blur(6px)', transition: { duration: 0.2, ease: motionTokens.ease.in } }}
							>
								<div className="motion-lab-page-chip-row">
									{current.chips.map((chip) => <span key={chip} className="motion-lab-chip">{chip}</span>)}
								</div>
								<div style={{ display: 'grid', gap: 6 }}>
									<strong style={{ fontSize: 24, letterSpacing: '-0.04em' }}>{current.title}</strong>
									<p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>Preview of the route family. Use forward/back to inspect direction and pacing.</p>
								</div>
								{current.blocks.map((block) => (
									<div key={block} className="motion-lab-page-block">{block}</div>
								))}
							</motion.div>
						</AnimatePresence>
					</div>
					<div className="motion-lab-controls">
						<button type="button" className="motion-lab-control-btn" onClick={() => step(-1)}><ChevronLeft size={14} /> Play backward</button>
						<button type="button" className="motion-lab-control-btn" onClick={() => step(1)}><ChevronRight size={14} /> Play forward</button>
					</div>
				</div>
			</LabCard>
		</div>
	);
}

// ── Logo Lab ─────────────────────────────────────────────────────────────────

const LIME = '#CCFF00';
const CYAN = '#00FFFF';
const GOLD = '#FFD700';
const APP_DARK = '#121212';
const APP_BORDER = '#333333';

// ── 6 K styles on 80×80 viewBox ──────────────────────────────────────────────

// 1 · Greek — slab serifs on bar ends, classical proportions
function K1({ c }: { c: string }) {
	return (
		<>
			<rect x="16" y="18" width="7" height="44" fill={c} />
			<rect x="11" y="14" width="17" height="5" fill={c} />
			<rect x="11" y="61" width="17" height="5" fill={c} />
			<polygon points="23,39 27,33 61,15 57,21" fill={c} />
			<polygon points="23,41 27,47 57,59 61,65" fill={c} />
		</>
	);
}
// 2 · Blade — super sharp arms extending to box corners, aggressive
function K2({ c }: { c: string }) {
	return <path d="M13,66 L22,66 L22,46 L67,74 L68,65 L30,40 L68,15 L67,6 L22,34 L22,14 L13,14 Z" fill={c} />;
}
// 3 · Sport — bold K sheared right, athletic italic
function K3({ c }: { c: string }) {
	return <path d="M11,66 L23,66 L26,47 L64,68 L63,60 L34,40 L69,20 L72,12 L28,33 L31,14 L19,14 Z" fill={c} />;
}
// 4 · Arcade — 8-bit pixel art, 9px pixels on 11px pitch
function K4({ c }: { c: string }) {
	const ps = 9, pit = 11, ox = 9, oy = 4;
	const pixels: [number, number][] = [
		[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
		[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],
		[4,0],[3,1],[2,2],
		[2,4],[3,5],[4,6],
	];
	return (
		<>
			{pixels.map(([col, row]) => (
				<rect key={`${col}-${row}`} x={ox + col * pit} y={oy + row * pit} width={ps} height={ps} fill={c} />
			))}
		</>
	);
}
// 5 · Cyber — bar split by a diagonal lightning-bolt gap, futuristic
function K5({ c }: { c: string }) {
	return (
		<>
			<polygon points="15,14 23,14 23,35 19,41 15,37" fill={c} />
			<polygon points="15,43 19,39 23,45 23,66 15,66" fill={c} />
			<polygon points="23,33 27,27 64,11 66,17 32,39" fill={c} />
			<polygon points="23,47 32,41 66,63 64,69 27,53" fill={c} />
		</>
	);
}
// 6 · Bubble — extremely thick round strokes, bubbly/tag feel
function K6({ c }: { c: string }) {
	return (
		<>
			<line x1="19" y1="13" x2="19" y2="67" stroke={c} strokeWidth="15" strokeLinecap="round" />
			<line x1="22" y1="40" x2="64" y2="13" stroke={c} strokeWidth="13" strokeLinecap="round" />
			<line x1="22" y1="40" x2="64" y2="67" stroke={c} strokeWidth="13" strokeLinecap="round" />
		</>
	);
}

// Active K used in logos — K3 Sport/Italic (selected)
function KFill({ c }: { c: string }) { return <K3 c={c} />; }
function KGrad({ id }: { id: string }) {
	return (
		<>
			<rect x="16" y="18" width="7" height="44" fill={`url(#${id})`} />
			<rect x="11" y="14" width="17" height="5" fill={`url(#${id})`} />
			<rect x="11" y="61" width="17" height="5" fill={`url(#${id})`} />
			<polygon points="23,39 27,33 61,15 57,21" fill={`url(#${id})`} />
			<polygon points="23,41 27,47 57,59 61,65" fill={`url(#${id})`} />
		</>
	);
}

function KShowcase() {
	const styles = [
		{ label: '1 · Greek', el: <K1 c={LIME} /> },
		{ label: '2 · Blade', el: <K2 c={LIME} /> },
		{ label: '3 · Sport', el: <K3 c={LIME} /> },
		{ label: '4 · Arcade', el: <K4 c={LIME} /> },
		{ label: '5 · Cyber', el: <K5 c={LIME} /> },
		{ label: '6 · Bubble', el: <K6 c={LIME} /> },
	];
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
			{styles.map(({ label, el }) => (
				<div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
					<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
						<rect width="80" height="80" rx="16" fill={APP_DARK} />
						{el}
					</svg>
					<div style={{ fontSize: 10, color: '#666', letterSpacing: '0.08em' }}>{label}</div>
				</div>
			))}
		</div>
	);
}

function LogoA() {
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
			<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
				<rect width="80" height="80" rx="18" fill={APP_DARK} />
				<KFill c={LIME} />
			</svg>
			<div style={{ background: APP_DARK, padding: '18px 24px', borderRadius: 14, border: `1px solid ${APP_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
				<svg width="40" height="40" viewBox="0 0 80 80" fill="none">
					<rect width="80" height="80" rx="12" fill={APP_DARK} />
					<KFill c={LIME} />
				</svg>
				<div>
					<div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
						KAIROS<span style={{ color: LIME }}> lift</span>
					</div>
					<div style={{ fontSize: 10, color: '#555', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: 2 }}>Seize the moment</div>
				</div>
			</div>
		</div>
	);
}

function LogoB() {
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
			<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
				<defs>
					<filter id="lb-glow" x="-40%" y="-40%" width="180%" height="180%">
						<feGaussianBlur stdDeviation="4" result="blur" />
						<feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
					</filter>
				</defs>
				<rect width="80" height="80" rx="18" fill="#050505" />
				<g filter="url(#lb-glow)"><KFill c={LIME} /></g>
			</svg>
			<div style={{ background: '#050505', padding: '18px 24px', borderRadius: 14, border: '1px solid #1c1c1c', display: 'inline-flex', alignItems: 'center', gap: 14 }}>
				<svg width="40" height="40" viewBox="0 0 80 80" fill="none">
					<defs>
						<filter id="lb-glow2" x="-40%" y="-40%" width="180%" height="180%">
							<feGaussianBlur stdDeviation="4" result="blur" />
							<feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
						</filter>
					</defs>
					<rect width="80" height="80" rx="12" fill="#050505" />
					<g filter="url(#lb-glow2)"><KFill c={LIME} /></g>
				</svg>
				<div>
					<div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', textShadow: `0 0 18px ${LIME}55` }}>
						KAIROS<span style={{ color: LIME, textShadow: `0 0 10px ${LIME}` }}> lift</span>
					</div>
					<div style={{ fontSize: 10, color: '#444', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: 2 }}>Seize the moment</div>
				</div>
			</div>
		</div>
	);
}

function LogoC() {
	// Stacked typographic — no icon, pure wordmark
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
			<div style={{ background: APP_DARK, padding: '28px 36px', borderRadius: 14, border: `1px solid ${APP_BORDER}` }}>
				<div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '0.06em', color: '#fff', lineHeight: 1 }}>KAIROS</div>
				<div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '0.06em', color: LIME, lineHeight: 1, marginTop: 4 }}>lift</div>
				<div style={{ fontSize: 10, color: '#444', letterSpacing: '0.22em', textTransform: 'uppercase' as const, marginTop: 14 }}>Seize the moment</div>
			</div>
			<div style={{ background: APP_DARK, padding: '20px 28px', borderRadius: 14, border: `1px solid ${APP_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 18 }}>
				<svg width="52" height="52" viewBox="0 0 80 80" fill="none">
					<KFill c={LIME} />
				</svg>
				<div>
					<div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.04em', color: '#fff', lineHeight: 1 }}>KAIROS</div>
					<div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.04em', color: LIME, lineHeight: 1.1 }}>lift</div>
					<div style={{ fontSize: 10, color: '#444', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: 8 }}>Seize the moment</div>
				</div>
			</div>
		</div>
	);
}

function LogoD() {
	// Inverted — lime background, black K (high contrast, distinctive)
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
			<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
				<rect width="80" height="80" rx="18" fill={LIME} />
				<K1 c="#000" />
			</svg>
			<div style={{ background: APP_DARK, padding: '18px 24px', borderRadius: 14, border: `1px solid ${APP_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
				<svg width="44" height="44" viewBox="0 0 80 80" fill="none">
					<rect width="80" height="80" rx="12" fill={LIME} />
					<K1 c="#000" />
				</svg>
				<div>
					<div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
						KAIROS<span style={{ color: LIME }}> lift</span>
					</div>
					<div style={{ fontSize: 10, color: '#555', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: 2 }}>Seize the moment</div>
				</div>
			</div>
		</div>
	);
}

function LogoE() {
	// Circle ring badge — K inside a thin lime ring
	return (
		<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
			<svg width="80" height="80" viewBox="0 0 80 80" fill="none">
				<circle cx="40" cy="40" r="37" stroke={LIME} strokeWidth="1.5" fill="none" />
				<KFill c={LIME} />
			</svg>
			<div style={{ background: APP_DARK, padding: '18px 24px', borderRadius: 14, border: `1px solid ${APP_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
				<svg width="44" height="44" viewBox="0 0 80 80" fill="none">
					<circle cx="40" cy="40" r="37" stroke={LIME} strokeWidth="2" fill="none" />
					<KFill c={LIME} />
				</svg>
				<div>
					<div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>
						KAIROS<span style={{ color: LIME }}> lift</span>
					</div>
					<div style={{ fontSize: 10, color: '#555', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: 2 }}>Seize the moment</div>
				</div>
			</div>
		</div>
	);
}

function LogosTab() {
	return (
		<div>
			<div style={{ marginBottom: 26 }}>
				<div style={{ fontSize: 21, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Logo Lab — Kairos lift</div>
				<div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>Pick a K style below, then choose a logo direction</div>
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>K Styles</div>
				<div style={variantTitle}>6 lettermark variants</div>
				<div style={variantDesc}>All on app dark background with #CCFF00. Tell me which number you prefer.</div>
				<KShowcase />
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>Logo A</div>
				<div style={variantTitle}>Primary — flat lime on dark</div>
				<div style={variantDesc}>K icon + KAIROS lift wordmark. Clean, no effects. Works at any size.</div>
				<LogoA />
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>Logo B</div>
				<div style={variantTitle}>Glow — neon bloom</div>
				<div style={variantDesc}>Same K with SVG blur glow. Matches the XP / gamification energy of the app.</div>
				<LogoB />
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>Logo C</div>
				<div style={variantTitle}>Stack — pure wordmark</div>
				<div style={variantDesc}>KAIROS + lift stacked, no icon. Typographic direction — clean and editorial.</div>
				<LogoC />
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>Logo D</div>
				<div style={variantTitle}>Inverted — lime background</div>
				<div style={variantDesc}>Black K cut out on #CCFF00 square. High contrast, distinctive as an app icon.</div>
				<LogoD />
			</div>
			<div style={sectionCard}>
				<div style={variantLabel}>Logo E</div>
				<div style={variantTitle}>Ring — K in circle badge</div>
				<div style={variantDesc}>Thin lime circle ring around the K. Badge / seal aesthetic.</div>
				<LogoE />
			</div>
		</div>
	);
}

export default function Playground() {
	const [tab, setTab] = useState<PlaygroundTab>('cta');

	return (
		<div style={{ minHeight: '100vh', background: 'var(--bg-primary, #121212)', padding: '22px 14px 80px', maxWidth: 1040, margin: '0 auto' }}>
			<style>{STYLES}</style>

			<div style={{ marginBottom: 22 }}>
				<div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Motion Lab</div>
				<div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, maxWidth: 720 }}>
					Compare button personalities and route transitions before we promote them into production. Each tab shows multiple options side by side, with one marked as the current recommended direction.
				</div>
			</div>

			<div className="motion-lab-shell">
				<div className="motion-lab-tabs">
					{tabs.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`motion-lab-tab ${tab === item.id ? 'is-active' : ''}`.trim()}
							onClick={() => setTab(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>

				{tab === 'cta' && <PrimaryCTATab />}
				{tab === 'claim' && <ClaimRewardTab />}
				{tab === 'ai' && <AIActionsTab />}
				{tab === 'session' && <SessionControlsTab />}
				{tab === 'nav' && <NavigationTab />}
				{tab === 'pages' && <PageTransitionPreview />}
				{tab === 'logos' && <LogosTab />}
				{tab === 'streak' && (
					<>
						<div style={{ marginBottom: 26 }}>
							<div style={{ fontSize: 21, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Streak Skins</div>
							<div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
								6 variants · current week is largest · each shows empty · dead · lit ×4 · claimable
							</div>
						</div>
						<VariantA />
						<VariantB />
						<VariantC1 />
						<VariantC2 />
						<VariantC3 />
						<VariantD />
					</>
				)}
			</div>
		</div>
	);
}
