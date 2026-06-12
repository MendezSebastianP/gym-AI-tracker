/**
 * StreakFlames.tsx — shared streak skin components.
 * Used by: Stats home (LiveStreakRow), Playground (preview), Shop (single-slot preview).
 *
 * Design rules (kairos): crisp vector shapes, no blur-stacked blobs, one calm
 * looping animation per element, glow as a single soft shadow. Each paid skin
 * keeps a distinct identity: A campfire · B arcane crystal · C1/2/3 orbs · D pixel.
 */
import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeekSlot {
	week: string;
	start_date: string;
	sessions: number;   // -1 = empty placeholder
	claimed: boolean;
}

export type FlameState = 'lit' | 'pending' | 'extinguished' | 'empty';

export function getState(w: WeekSlot, overrideClaimed = false): FlameState {
	if (w.sessions === -1) return 'empty';
	if (w.sessions === 0) return 'extinguished';
	if (w.claimed || overrideClaimed) return 'lit';
	return 'pending';
}

export function fmtDate(iso: string) {
	if (!iso) return '';
	const d = new Date(iso);
	return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SLOT_SCALES = [0.58, 0.65, 0.72, 0.79, 0.86, 0.93, 1.0];

export const SKIN_ACCENTS: Record<string, string> = {
	skin_a:  '#FF8C00',
	skin_b:  '#CE93D8',
	skin_c1: '#FF9500',
	skin_c2: '#FFD700',
	skin_c3: '#42A5F5',
	skin_d:  '#FF9900',
};

export const CRYSTAL_CLIP = 'polygon(50% 0%, 76% 25%, 93% 54%, 74% 84%, 50% 100%, 26% 84%, 7% 54%, 24% 25%)';

export const PX_COLORS = {
	ember: '#700000', l1: '#CC1100', l2: '#FF2200',
	l3: '#FF6600', l4: '#FF9900', l5: '#FFCC00', tip: '#FFE566',
};

// ── Orb configs ───────────────────────────────────────────────────────────────

export interface OrbCfg {
	id: 'c1' | 'c2' | 'c3';
	gradient: string;
	pendingGradient: string;
	extGradient: string;
	glowColor: string;
	swirlGradient: string;
	sparkColors: string[];
	borderColor: string;
	bolts: boolean;
	boltColor: string;
	swirlDur: string;
	swirlDir: string;
}

export const CFG_C1: OrbCfg = {
	id: 'c1',
	gradient:        'radial-gradient(circle at 38% 40%, #FFF5B0 0%, #FF9000 25%, #FF3300 55%, #990000 78%, #2A0000 100%)',
	pendingGradient: 'radial-gradient(circle at 38% 40%, #FFFAD0 0%, #FFA500 22%, #FF4400 52%, #AA0000 76%, #320000 100%)',
	extGradient:     'radial-gradient(circle at 38% 36%, #3A2020 0%, #1E1010 50%, #0D0808 100%)',
	glowColor: '255,80,0',
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(255,200,50,0.4) 14%, transparent 30%, rgba(255,80,0,0.32) 48%, transparent 62%, rgba(255,160,20,0.36) 80%, transparent 100%)',
	sparkColors: ['#FFE566', '#FF9500', '#FFCC00'],
	borderColor: 'rgba(255,120,0,0.45)',
	bolts: false, boltColor: '', swirlDur: '4.2s', swirlDir: 'orbSwirl',
};

export const CFG_C2: OrbCfg = {
	id: 'c2',
	gradient:        'radial-gradient(circle at 38% 38%, #FFFEE0 0%, #FFE800 18%, #FFB300 40%, #E07000 62%, #6B3300 82%, #1A0C00 100%)',
	pendingGradient: 'radial-gradient(circle at 38% 38%, #FFFFFF 0%, #FFF200 16%, #FFC000 38%, #E88000 60%, #7A3800 80%, #220F00 100%)',
	extGradient:     'radial-gradient(circle at 38% 36%, #2A1A00 0%, #1A1000 50%, #0D0800 100%)',
	glowColor: '210,160,0',
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,180,0.4) 12%, rgba(255,220,50,0.5) 22%, transparent 38%, rgba(255,170,0,0.32) 56%, transparent 72%, rgba(255,200,40,0.36) 88%, transparent 100%)',
	sparkColors: ['#FFFDE7', '#FFD700', '#FFA000'],
	borderColor: 'rgba(255,200,0,0.5)',
	bolts: false, boltColor: '', swirlDur: '5.6s', swirlDir: 'orbSwirlRev',
};

export const CFG_C3: OrbCfg = {
	id: 'c3',
	gradient:        'radial-gradient(circle at 38% 40%, #FFFFFF 0%, #A8D8FF 12%, #2196F3 32%, #0D47A1 58%, #001055 80%, #00001C 100%)',
	pendingGradient: 'radial-gradient(circle at 38% 40%, #FFFFFF 0%, #C8E8FF 10%, #42A5F5 30%, #1565C0 56%, #001266 78%, #000022 100%)',
	extGradient:     'radial-gradient(circle at 38% 36%, #0A1A30 0%, #050E1C 50%, #020508 100%)',
	glowColor: '30,130,255',
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(180,230,255,0.42) 16%, rgba(100,200,255,0.5) 26%, transparent 44%, rgba(30,160,255,0.32) 60%, transparent 76%, rgba(80,190,255,0.36) 92%, transparent 100%)',
	sparkColors: ['#E8F4FD', '#42A5F5', '#90CAF9'],
	borderColor: 'rgba(80,170,255,0.55)',
	bolts: true, boltColor: '#90CAFF', swirlDur: '3.4s', swirlDir: 'orbSwirl',
};

// ── CSS Keyframes ─────────────────────────────────────────────────────────────
// One purposeful loop per element. Flicker reads as fire because the timing is
// slightly off-beat between layers, not because everything pulses at once.

export const STYLES = `
/* ─────── VARIANT A: Campfire (crisp vector) ─────── */
@keyframes fireSwayA {
  0%   { transform: skewX(0deg)    scaleY(1);     }
  28%  { transform: skewX(-2.4deg) scaleY(1.035); }
  52%  { transform: skewX(1.6deg)  scaleY(0.975); }
  76%  { transform: skewX(-1.1deg) scaleY(1.02);  }
  100% { transform: skewX(0deg)    scaleY(1);     }
}
@keyframes fireInnerA {
  0%   { transform: translateY(0)     scale(1);    opacity: 0.96; }
  40%  { transform: translateY(-1.2px) scale(0.94); opacity: 0.85; }
  70%  { transform: translateY(0.4px)  scale(1.04); opacity: 1;    }
  100% { transform: translateY(0)     scale(1);    opacity: 0.96; }
}
@keyframes emberRiseA {
  0%   { transform: translateY(0)    scale(1);   opacity: 0;   }
  12%  { opacity: 0.95; }
  70%  { transform: translateY(-19px) scale(0.6); opacity: 0.4; }
  100% { transform: translateY(-26px) scale(0.3); opacity: 0;   }
}
@keyframes smokeRiseA {
  0%   { opacity: 0.5; transform: translateY(0)     scaleX(1);   }
  50%  { opacity: 0.2; transform: translateY(-9px)  scaleX(1.4); }
  100% { opacity: 0;   transform: translateY(-20px) scaleX(0.5); }
}

/* ─────── VARIANT B: Arcane Crystal ─────── */
@keyframes crystalSwayB {
  0%   { transform: rotate(0deg)    scaleY(1);     }
  30%  { transform: rotate(2.6deg)  scaleY(0.985); }
  62%  { transform: rotate(-2.2deg) scaleY(1.025); }
  100% { transform: rotate(0deg)    scaleY(1);     }
}
@keyframes crystalGlintB {
  0%, 64%  { transform: translateX(-26px) rotate(18deg); opacity: 0;   }
  70%      { opacity: 0.85; }
  80%      { transform: translateX(22px)  rotate(18deg); opacity: 0.5; }
  86%, 100%{ transform: translateX(26px)  rotate(18deg); opacity: 0;   }
}
@keyframes crystalCoreB {
  0%, 100% { opacity: 0.85; transform: scale(1);    }
  50%       { opacity: 1;    transform: scale(1.06); }
}
@keyframes runeFloatB {
  0%, 100% { transform: translateY(0);    opacity: 0.85; }
  50%       { transform: translateY(-4px); opacity: 0.45; }
}
@keyframes crystalSmokeB {
  0%   { opacity: 0.45; transform: translateY(0)     scaleX(1);   }
  50%  { opacity: 0.18; transform: translateY(-8px)  scaleX(1.3); }
  100% { opacity: 0;    transform: translateY(-17px) scaleX(0.5); }
}

/* ─────── ORBS (C1 / C2 / C3) ─────── */
@keyframes orbBreathe {
  0%, 100% { transform: scale(1);     }
  50%       { transform: scale(1.035); }
}
@keyframes orbSwirl    { from { transform: rotate(0deg); }   to { transform: rotate(360deg);  } }
@keyframes orbSwirlRev { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
@keyframes orbSmoke {
  0%   { opacity: 0.45; transform: translateY(0)     scaleX(1);    }
  50%  { opacity: 0.16; transform: translateY(-9px)  scaleX(1.35); }
  100% { opacity: 0;    transform: translateY(-19px) scaleX(0.5);  }
}
@keyframes orbitSpark {
  from { transform: rotate(0deg)   translateX(24px) rotate(0deg);    }
  to   { transform: rotate(360deg) translateX(24px) rotate(-360deg); }
}
@keyframes innerFlameC1 {
  0%   { transform: scaleY(1)    skewX(0deg);  opacity: 0.85; }
  35%  { transform: scaleY(1.14) skewX(-3deg); opacity: 0.7;  }
  65%  { transform: scaleY(0.9)  skewX(2deg);  opacity: 0.8;  }
  100% { transform: scaleY(1)    skewX(0deg);  opacity: 0.85; }
}
@keyframes goldSweep {
  0%, 58%  { transform: translateX(-52px) skewX(-20deg); opacity: 0;    }
  64%      { opacity: 0.75; }
  78%      { transform: translateX(50px)  skewX(-20deg); opacity: 0.45; }
  84%,100% { transform: translateX(52px)  skewX(-20deg); opacity: 0;    }
}
@keyframes zapBolt {
  0%, 78%, 100% { opacity: 0;    }
  80%  { opacity: 1;    }
  83%  { opacity: 0.15; }
  86%  { opacity: 0.9;  }
  90%  { opacity: 0.25; }
  94%  { opacity: 0;    }
}

/* ─────── VARIANT D: Pixel Art ─────── */
@keyframes pxL1 { 0%  { width: 28px; }  33% { width: 24px; }  66% { width: 30px; } }
@keyframes pxL2 { 0%  { width: 22px; }  33% { width: 24px; }  66% { width: 20px; } }
@keyframes pxL3 { 0%  { width: 16px; }  33% { width: 18px; }  66% { width: 14px; } }
@keyframes pxL4 { 0%  { width: 10px; }  33% { width: 8px;  }  66% { width: 12px; } }
@keyframes pxL5 {
  0%  { width: 5px; opacity: 1;   }
  33% { width: 7px; opacity: 0.7; }
  66% { width: 3px; opacity: 0.5; }
}
@keyframes pxBlink  { 0%, 49% { opacity: 1; }  50%, 100% { opacity: 0.25; } }
@keyframes pxSmokeD { 0% { opacity: 0.5; transform: translateY(0) scaleX(1); } 100% { opacity: 0; transform: translateY(-16px) scaleX(0.4); } }

/* ─────── Shared ─────── */
@keyframes pendingDot {
  0%, 100% { transform: translateY(0);    opacity: 0.9; }
  50%       { transform: translateY(-4px); opacity: 0.4; }
}
@keyframes claimFlash {
  0%   { transform: scale(1);    }
  22%  { transform: scale(1.3);  }
  58%  { transform: scale(0.92); }
  100% { transform: scale(1);    }
}

/* Claim button — one shape for every skin, tinted via --claim-accent */
@keyframes claimPulseK {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--claim-accent, #FF8C00) 45%, transparent); }
  60%       { box-shadow: 0 0 0 9px color-mix(in srgb, var(--claim-accent, #FF8C00) 0%, transparent); }
}
@keyframes claimBurstK {
  0%   { transform: scale(1);    filter: brightness(1);   }
  18%  { transform: scale(1.07); filter: brightness(1.45); }
  45%  { transform: scale(0.96); filter: brightness(1.1);  }
  72%  { transform: scale(1.02); }
  100% { transform: scale(1);    filter: brightness(1);   }
}
@keyframes claimBurstPx {
  0%        { opacity: 1; transform: scale(1);    }
  12%, 22%  { opacity: 0; transform: scale(1.06); }
  32%, 42%  { opacity: 1; transform: scale(1);    }
  52%, 62%  { opacity: 0; transform: scale(1.03); }
  72%, 100% { opacity: 1; transform: scale(1);    }
}
`;

// ── Shared layout ─────────────────────────────────────────────────────────────

const weekLabel: React.CSSProperties = {
	fontFamily: 'var(--font-mono, monospace)',
	fontSize: 8,
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: 'var(--text-4, #666)',
	fontWeight: 600,
};

export function FlameRow({
	BASE_WEEKS, getSlot, highlightColor, pendingDotEl, dateFont,
}: {
	BASE_WEEKS: WeekSlot[];
	getSlot: (w: WeekSlot, i: number, isCurrent: boolean) => React.ReactNode;
	highlightColor: string;
	pendingDotEl: (i: number) => React.ReactNode;
	dateFont?: React.CSSProperties;
}) {
	return (
		<div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'space-between' }}>
			{BASE_WEEKS.map((w, i) => {
				const scale = SLOT_SCALES[i];
				const isCurrent = i === 6;
				return (
					<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
						<div style={{ height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							{pendingDotEl(i)}
						</div>
						<div style={{ position: 'relative', transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
							{isCurrent && (
								<div style={{
									position: 'absolute', inset: '-12px -13px -6px', borderRadius: 14,
									background: highlightColor,
									border: `1px solid ${highlightColor.replace('0.14', '0.3').replace('0.15', '0.3')}`,
									pointerEvents: 'none', zIndex: 0,
								}} />
							)}
							<div style={{ position: 'relative', zIndex: 1 }}>
								{getSlot(w, i, isCurrent)}
							</div>
						</div>
						<span style={{ ...weekLabel, ...dateFont, opacity: 0.35 + scale * 0.65 }}>
							{i === 6 ? 'Now' : `W-${6 - i}`}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT A — Campfire. Crisp layered flame over crossed logs; embers when hot.
// ═══════════════════════════════════════════════════════════════════════════════

const FLAME_PATH = 'M20 2 C22 9 14 12 14 20 a6 6 0 0 0 12 0 c0-3 5 2 5 9 a11 11 0 1 1 -22 0 c0-8 9-13 11-27z';

function CampfireLogs() {
	return (
		<svg width="34" height="9" viewBox="0 0 34 9" style={{ display: 'block' }}>
			<rect x="1" y="2.4" width="32" height="4.2" rx="2.1" fill="#4A2E14" transform="rotate(-6 17 4.5)" />
			<rect x="1" y="2.4" width="32" height="4.2" rx="2.1" fill="#5C3A1A" transform="rotate(6 17 4.5)" />
		</svg>
	);
}

export function FlameSlotA({ state, index, flashing }: { state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.22;
	if (state === 'empty') return (
		<div style={{ width: 40, height: 56, borderRadius: 12, border: '1px dashed rgba(255,140,0,0.18)', background: 'rgba(255,140,0,0.03)' }} />
	);
	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: 40, height: 56 }}>
			<div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}><CampfireLogs /></div>
			<div style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', width: 14, height: 6, borderRadius: '50%', background: '#3A3A3A' }} />
			{[{ x: '46%', d: '0s' }, { x: '58%', d: '1.2s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 12, left: s.x, transform: 'translateX(-50%)', width: 4, height: 9, borderRadius: '50%', background: 'rgba(150,150,150,0.32)', animation: `smokeRiseA 2.6s ease-out ${s.d} infinite` }} />
			))}
		</div>
	);
	const p = state === 'pending';
	return (
		<div style={{ position: 'relative', width: 40, height: 56, animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			{/* embers — only while the week is still hot (pending) */}
			{p && [{ x: 13, dur: 1.9, off: 0 }, { x: 25, dur: 2.3, off: 0.8 }].map((e, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 26, left: e.x, width: 3, height: 3, borderRadius: '50%', background: '#FFCC55', boxShadow: '0 0 4px 1px rgba(255,160,40,0.7)', animation: `emberRiseA ${e.dur}s ease-out ${d + e.off}s infinite` }} />
			))}
			{/* flame body — two crisp layers, slightly off-beat */}
			<svg
				width="40" height="48" viewBox="0 0 40 48"
				style={{
					position: 'absolute', bottom: 5, left: 0,
					transformOrigin: 'bottom center',
					animation: `fireSwayA ${p ? 1.9 : 2.6}s ease-in-out ${d}s infinite`,
					filter: `drop-shadow(0 2px 7px rgba(255,100,0,${p ? 0.5 : 0.32}))`,
				}}
			>
				<defs>
					<linearGradient id="fgA" x1="0" y1="1" x2="0" y2="0">
						<stop offset="0" stopColor="#E03000" />
						<stop offset="0.55" stopColor="#FF6A00" />
						<stop offset="1" stopColor="#FFA62B" />
					</linearGradient>
				</defs>
				<path d={FLAME_PATH} fill="url(#fgA)" transform={`translate(20 47) scale(${p ? 1.06 : 0.96}) translate(-20 -47) translate(0 4)`} />
			</svg>
			<svg
				width="40" height="48" viewBox="0 0 40 48"
				style={{
					position: 'absolute', bottom: 5, left: 0,
					transformOrigin: 'bottom center',
					animation: `fireInnerA ${p ? 1.3 : 1.8}s ease-in-out ${d + 0.25}s infinite`,
				}}
			>
				<defs>
					<linearGradient id="fgAi" x1="0" y1="1" x2="0" y2="0">
						<stop offset="0" stopColor="#FFD24A" />
						<stop offset="1" stopColor="#FFF6D8" />
					</linearGradient>
				</defs>
				<path d={FLAME_PATH} fill="url(#fgAi)" transform="translate(20 47) scale(0.46) translate(-20 -47) translate(0 1)" />
			</svg>
			<div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}><CampfireLogs /></div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT B — Arcane Crystal. Faceted shard, slow sway, periodic glint.
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotB({ state, index, flashing }: { state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.3;
	if (state === 'empty') return (
		<div style={{ position: 'relative', width: 36, height: 54 }}>
			<div style={{ position: 'absolute', bottom: 0, left: 3, width: 30, height: 46, clipPath: CRYSTAL_CLIP, background: 'rgba(180,0,255,0.06)', border: '1px dashed rgba(180,0,255,0.2)' }} />
		</div>
	);
	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: 36, height: 54 }}>
			{[{ w: 11, h: 19, l: '30%', b: 0, r: -9 }, { w: 8, h: 14, l: '58%', b: 0, r: 7 }, { w: 5, h: 10, l: '46%', b: 14, r: -3 }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: s.b, left: s.l, transform: `translateX(-50%) rotate(${s.r}deg)`, width: s.w, height: s.h, background: 'linear-gradient(to top, #170028, #2A0048)', clipPath: CRYSTAL_CLIP, opacity: 0.55 + i * 0.12 }} />
			))}
			{[{ x: '48%', d: '0s' }, { x: '40%', d: '1.1s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 24, left: s.x, transform: 'translateX(-50%)', width: 4, height: 8, borderRadius: '50%', background: 'rgba(120,80,150,0.28)', animation: `crystalSmokeB 2.4s ease-out ${s.d} infinite` }} />
			))}
		</div>
	);
	const p = state === 'pending';
	return (
		<div style={{ position: 'relative', width: 36, height: 58, animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			{/* shard */}
			<div style={{
				position: 'absolute', bottom: 0, left: '50%', marginLeft: p ? -15 : -13,
				width: p ? 30 : 26, height: p ? 50 : 44,
				transformOrigin: 'bottom center',
				animation: `crystalSwayB ${p ? 2.6 : 3.4}s ease-in-out ${d}s infinite`,
				filter: `drop-shadow(0 0 ${p ? 10 : 6}px rgba(200,80,255,${p ? 0.6 : 0.4}))`,
			}}>
				<div style={{ position: 'absolute', inset: 0, clipPath: CRYSTAL_CLIP, background: 'linear-gradient(to top, #2E0055, #7B1FA2 45%, #C45FE0 72%, #F2D8FF 94%)', overflow: 'hidden' }}>
					{/* facet edge */}
					<div style={{ position: 'absolute', top: '12%', bottom: '8%', left: '46%', width: 1.5, background: 'rgba(255,255,255,0.32)', transform: 'rotate(4deg)' }} />
					<div style={{ position: 'absolute', top: '30%', left: '12%', right: '14%', height: 1.2, background: 'rgba(255,255,255,0.18)', transform: 'rotate(-14deg)' }} />
					{/* travelling glint */}
					<div style={{ position: 'absolute', top: '-12%', bottom: '-12%', left: '38%', width: 7, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.85), transparent)', animation: `crystalGlintB 3.6s ease-in-out ${d}s infinite` }} />
				</div>
			</div>
			{/* inner core */}
			<div style={{
				position: 'absolute', bottom: 11, left: '50%', marginLeft: -5,
				width: 10, height: 16, clipPath: CRYSTAL_CLIP,
				background: 'linear-gradient(to top, #D02CFF, #FFC8FF)',
				animation: `crystalCoreB ${p ? 1.6 : 2.2}s ease-in-out ${d + 0.4}s infinite`,
			}} />
			{/* floating rune mote */}
			{p && (
				<div style={{ position: 'absolute', top: 4, left: '50%', marginLeft: 8, width: 4, height: 4, clipPath: CRYSTAL_CLIP, background: '#E9B5FF', boxShadow: '0 0 5px 2px rgba(210,130,255,0.7)', animation: `runeFloatB 1.6s ease-in-out ${d}s infinite` }} />
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORBS — C1 / C2 / C3. Gradient sphere, one slow swirl, calm breathing.
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotOrb({ cfg, state, index, flashing }: { cfg: OrbCfg; state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.35;
	const ORB = 46;

	if (state === 'empty') return (
		<div style={{ width: ORB, height: ORB + 14, display: 'flex', alignItems: 'flex-end' }}>
			<div style={{ width: ORB, height: ORB, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }} />
		</div>
	);

	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: ORB, height: ORB + 14 }}>
			{[{ x: '50%', d: '0s' }, { x: '40%', d: '1.2s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: ORB - 4, left: s.x, transform: 'translateX(-50%)', width: 4, height: 9, borderRadius: '50%', background: 'rgba(130,130,130,0.28)', animation: `orbSmoke 2.4s ease-out ${s.d} infinite` }} />
			))}
			<div style={{ position: 'absolute', bottom: 0, left: 0, width: ORB, height: ORB, borderRadius: '50%', background: cfg.extGradient, border: '1.5px solid rgba(60,60,60,0.4)', overflow: 'hidden' }}>
				<div style={{ position: 'absolute', top: 6, left: 8, width: 11, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', transform: 'rotate(-20deg)' }} />
			</div>
		</div>
	);

	const p = state === 'pending';
	const boltAngles = cfg.id === 'c3' ? [12, -40, 64, -78] : [];
	const innerFlamesC1 = [
		{ left: '22%', w: 7, h: ORB * 0.42, dur: '1.5s', dOff: 0    },
		{ left: '44%', w: 9, h: ORB * 0.52, dur: '1.9s', dOff: 0.4  },
		{ left: '66%', w: 6, h: ORB * 0.38, dur: '1.3s', dOff: 0.75 },
	];

	return (
		<div style={{ position: 'relative', width: ORB, height: ORB + 14 }}>
			<div style={{
				position: 'absolute', bottom: 0, left: '50%', marginLeft: -ORB / 2,
				width: ORB, height: ORB, borderRadius: '50%',
				background: p ? cfg.pendingGradient : cfg.gradient,
				border: `1.5px solid ${cfg.borderColor}`,
				overflow: 'hidden',
				animation: `${flashing ? 'claimFlash 0.5s ease-out, ' : ''}orbBreathe ${p ? '2s' : '3s'} ease-in-out ${d}s infinite`,
				boxShadow: `0 0 ${p ? 18 : 12}px ${p ? 5 : 3}px rgba(${cfg.glowColor},${p ? 0.5 : 0.3})`,
			}}>
				{/* single slow swirl */}
				<div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: cfg.swirlGradient, animation: `${cfg.swirlDir} ${cfg.swirlDur} linear ${d}s infinite` }} />
				{cfg.id === 'c1' && innerFlamesC1.map((f, fi) => (
					<div key={fi} style={{ position: 'absolute', bottom: 0, left: f.left, width: f.w, height: f.h, background: 'linear-gradient(to top, rgba(255,50,0,0.85), rgba(255,180,0,0.5), transparent)', borderRadius: '50% 50% 30% 30% / 80% 80% 40% 40%', transformOrigin: 'bottom center', animation: `innerFlameC1 ${f.dur} ease-in-out ${d + f.dOff}s infinite` }} />
				))}
				{cfg.id === 'c2' && (
					<div style={{ position: 'absolute', top: -4, left: -14, width: '55%', height: '115%', background: 'linear-gradient(108deg, transparent 0%, rgba(255,255,210,0.6) 35%, rgba(255,248,180,0.78) 50%, rgba(255,255,210,0.6) 65%, transparent 100%)', animation: `goldSweep 4.4s ease-in-out ${d}s infinite` }} />
				)}
				{/* molten core */}
				<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -44%)', width: cfg.id === 'c1' ? 18 : 14, height: cfg.id === 'c1' ? 20 : 16, borderRadius: '50% 50% 40% 40% / 60% 60% 50% 50%', background: 'radial-gradient(circle at 50% 60%, rgba(255,255,240,0.85) 0%, rgba(255,230,80,0.3) 55%, transparent 100%)' }} />
				{/* spec highlight */}
				<div style={{ position: 'absolute', top: 5, left: 7, width: 14, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.26)', transform: 'rotate(-22deg)' }} />
				{cfg.id === 'c3' && boltAngles.map((angle, bi) => (
					<div key={bi} style={{ position: 'absolute', top: '50%', left: '50%', width: bi % 2 === 0 ? 2.5 : 1.5, height: ORB * (bi % 2 === 0 ? 0.72 : 0.6), marginTop: -(ORB * (bi % 2 === 0 ? 0.36 : 0.3)), marginLeft: bi % 2 === 0 ? -1.25 : -0.75, background: `linear-gradient(to bottom, transparent 0%, ${cfg.boltColor}44 15%, ${cfg.boltColor} 42%, #ffffff 50%, ${cfg.boltColor} 58%, ${cfg.boltColor}44 85%, transparent 100%)`, transform: `rotate(${angle}deg)`, animation: `zapBolt ${2.6 + bi * 0.5}s ease-in-out ${d + bi * 0.4}s infinite`, borderRadius: 1 }} />
				))}
			</div>
			{/* one orbiting spark while claimable */}
			{p && (
				<div style={{ position: 'absolute', bottom: ORB / 2, left: '50%', marginLeft: -2.5, marginBottom: -2.5, width: 5, height: 5, borderRadius: '50%', background: cfg.sparkColors[0], boxShadow: `0 0 5px 3px ${cfg.sparkColors[0]}88`, animation: `orbitSpark 2.6s linear ${d}s infinite` }} />
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT D — Pixel Art. Kept chunky on purpose; slightly slower step timing.
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotD({ state, index, flashing }: { state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.15;
	if (state === 'empty') return (
		<div style={{ width: 34, height: 52, border: '2px solid rgba(255,100,0,0.2)', borderRadius: 2, background: 'rgba(255,60,0,0.04)', imageRendering: 'pixelated' }} />
	);
	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: 34, height: 52, imageRendering: 'pixelated' }}>
			{[{ w: 32, h: 6, b: 0, c: '#3A3A3A' }, { w: 24, h: 6, b: 6, c: '#2A2A2A' }, { w: 16, h: 6, b: 12, c: '#1E1E1E' }].map((blk, i) => (
				<div key={i} style={{ position: 'absolute', bottom: blk.b, left: '50%', transform: 'translateX(-50%)', width: blk.w, height: blk.h, background: blk.c, borderRadius: 0 }} />
			))}
			{[{ x: '44%', d: '0s' }, { x: '56%', d: '0.7s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 20, left: s.x, transform: 'translateX(-50%)', width: 2, height: 8, background: 'rgba(150,150,150,0.4)', animation: `pxSmokeD 1.8s steps(4) ${s.d} infinite` }} />
			))}
		</div>
	);
	const p = state === 'pending';
	const layers = [
		{ w: p ? 30 : 28, b: 0,  c: PX_COLORS.l1,  anim: `pxL1 0.62s steps(3) ${d}s infinite`          },
		{ w: p ? 24 : 22, b: 8,  c: PX_COLORS.l2,  anim: `pxL2 0.62s steps(3) ${d + 0.1}s infinite`   },
		{ w: p ? 18 : 16, b: 16, c: PX_COLORS.l3,  anim: `pxL3 0.62s steps(3) ${d + 0.2}s infinite`   },
		{ w: p ? 12 : 10, b: 24, c: PX_COLORS.l4,  anim: `pxL4 0.62s steps(3) ${d + 0.3}s infinite`   },
		{ w: p ? 7  : 5,  b: 32, c: PX_COLORS.tip, anim: `pxL5 0.68s steps(3) ${d + 0.06}s infinite`  },
	];
	return (
		<div style={{ position: 'relative', width: 34, height: 52, imageRendering: 'pixelated', animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			<div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 34, height: 10, background: PX_COLORS.ember, borderRadius: 0 }} />
			{layers.map((lyr, li) => (
				<div key={li} style={{ position: 'absolute', bottom: lyr.b, left: '50%', transform: 'translateX(-50%)', width: lyr.w, height: 8, background: lyr.c, borderRadius: 0, animation: lyr.anim }} />
			))}
			{p && !flashing && (
				<div style={{ position: 'absolute', inset: -3, border: `2px solid ${PX_COLORS.l4}`, borderRadius: 0, animation: 'pxBlink 0.7s steps(2) infinite', pointerEvents: 'none' }} />
			)}
			<div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)', pointerEvents: 'none' }} />
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LiveStreakRow — used on Home with the active skin
// ═══════════════════════════════════════════════════════════════════════════════

const SKIN_HIGHLIGHT: Record<string, string> = {
	skin_a:  'rgba(255,120,0,0.14)',
	skin_b:  'rgba(170,0,255,0.14)',
	skin_c1: 'rgba(255,100,0,0.14)',
	skin_c2: 'rgba(220,170,0,0.14)',
	skin_c3: 'rgba(30,120,255,0.14)',
	skin_d:  'rgba(255,100,0,0.15)',
};

const SKIN_DOT_COLOR: Record<string, string> = {
	skin_a:  '#FFA040',
	skin_b:  '#CE93D8',
	skin_c1: '#FFE566',
	skin_c2: '#FFD700',
	skin_c3: '#90CAF9',
	skin_d:  '#FF9900',
};

export function LiveStreakRow({ skinId, weeks }: { skinId: string; weeks: WeekSlot[] }) {
	const highlight = SKIN_HIGHLIGHT[skinId] ?? SKIN_HIGHLIGHT.skin_a;
	const dotColor  = SKIN_DOT_COLOR[skinId]  ?? SKIN_DOT_COLOR.skin_a;
	const isPixel   = skinId === 'skin_d';

	return (
		<>
			<style>{STYLES}</style>
			<FlameRow
				BASE_WEEKS={weeks}
				highlightColor={highlight}
				dateFont={isPixel ? { fontFamily: 'monospace' } : undefined}
				pendingDotEl={(i) => {
					if (getState(weeks[i]) !== 'pending') return null;
					return <div style={{ width: 5, height: 5, borderRadius: isPixel ? 0 : '50%', background: dotColor, boxShadow: `0 0 5px 2px ${dotColor}88`, animation: isPixel ? 'pxBlink 0.5s steps(2) infinite' : 'pendingDot 0.9s ease-in-out infinite' }} />;
				}}
				getSlot={(w, i) => {
					const st = getState(w);
					if (skinId === 'skin_b')  return <FlameSlotB   state={st} index={i} />;
					if (skinId === 'skin_c1') return <FlameSlotOrb cfg={CFG_C1} state={st} index={i} />;
					if (skinId === 'skin_c2') return <FlameSlotOrb cfg={CFG_C2} state={st} index={i} />;
					if (skinId === 'skin_c3') return <FlameSlotOrb cfg={CFG_C3} state={st} index={i} />;
					if (skinId === 'skin_d')  return <FlameSlotD   state={st} index={i} />;
					return <FlameSlotA state={st} index={i} />;
				}}
			/>
		</>
	);
}
