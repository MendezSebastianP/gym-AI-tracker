/**
 * StreakFlames.tsx — shared streak skin components.
 * Used by: Dashboard (LiveStreakRow), Playground (preview), Shop (single-slot preview).
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
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(255,200,50,0.55) 14%, transparent 28%, rgba(255,80,0,0.45) 44%, transparent 58%, rgba(255,160,20,0.5) 74%, transparent 88%, rgba(255,240,80,0.3) 96%, transparent 100%)',
	sparkColors: ['#FFE566', '#FF9500', '#FFCC00'],
	borderColor: 'rgba(255,120,0,0.5)',
	bolts: false, boltColor: '', swirlDur: '2.2s', swirlDir: 'orbSwirl',
};

export const CFG_C2: OrbCfg = {
	id: 'c2',
	gradient:        'radial-gradient(circle at 38% 38%, #FFFEE0 0%, #FFE800 18%, #FFB300 40%, #E07000 62%, #6B3300 82%, #1A0C00 100%)',
	pendingGradient: 'radial-gradient(circle at 38% 38%, #FFFFFF 0%, #FFF200 16%, #FFC000 38%, #E88000 60%, #7A3800 80%, #220F00 100%)',
	extGradient:     'radial-gradient(circle at 38% 36%, #2A1A00 0%, #1A1000 50%, #0D0800 100%)',
	glowColor: '210,160,0',
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,180,0.6) 12%, rgba(255,220,50,0.8) 20%, transparent 34%, rgba(255,170,0,0.5) 50%, rgba(255,240,100,0.6) 60%, transparent 74%, rgba(255,200,40,0.55) 88%, transparent 100%)',
	sparkColors: ['#FFFDE7', '#FFD700', '#FFA000'],
	borderColor: 'rgba(255,200,0,0.6)',
	bolts: false, boltColor: '', swirlDur: '3.5s', swirlDir: 'orbSwirlRev',
};

export const CFG_C3: OrbCfg = {
	id: 'c3',
	gradient:        'radial-gradient(circle at 38% 40%, #FFFFFF 0%, #A8D8FF 12%, #2196F3 32%, #0D47A1 58%, #001055 80%, #00001C 100%)',
	pendingGradient: 'radial-gradient(circle at 38% 40%, #FFFFFF 0%, #C8E8FF 10%, #42A5F5 30%, #1565C0 56%, #001266 78%, #000022 100%)',
	extGradient:     'radial-gradient(circle at 38% 36%, #0A1A30 0%, #050E1C 50%, #020508 100%)',
	glowColor: '30,130,255',
	swirlGradient: 'conic-gradient(from 0deg, transparent 0%, rgba(180,230,255,0.65) 16%, rgba(100,200,255,0.8) 24%, transparent 40%, rgba(30,160,255,0.5) 56%, rgba(160,220,255,0.65) 68%, transparent 82%, rgba(80,190,255,0.55) 94%, transparent 100%)',
	sparkColors: ['#E8F4FD', '#42A5F5', '#90CAF9'],
	borderColor: 'rgba(80,170,255,0.65)',
	bolts: true, boltColor: '#90CAFF', swirlDur: '1.6s', swirlDir: 'orbSwirl',
};

// ── CSS Keyframes ─────────────────────────────────────────────────────────────

export const STYLES = `
/* ─────── VARIANT A: Campfire ─────── */
@keyframes flameCoreA {
  0%   { transform: scaleX(1)    scaleY(1)    rotate(-0.5deg); }
  25%  { transform: scaleX(0.93) scaleY(1.06) rotate(0.9deg);  }
  50%  { transform: scaleX(1.07) scaleY(0.95) rotate(-0.3deg); }
  75%  { transform: scaleX(0.96) scaleY(1.04) rotate(0.6deg);  }
  100% { transform: scaleX(1)    scaleY(1)    rotate(-0.5deg); }
}
@keyframes flameLickA {
  0%   { transform: translateY(0)    scaleX(1)    scaleY(1);   opacity: 0;    }
  8%   { opacity: 0.85; }
  35%  { transform: translateY(-8px)  scaleX(0.7)  scaleY(1.25); opacity: 0.75; }
  65%  { transform: translateY(-18px) scaleX(0.4)  scaleY(1.0);  opacity: 0.38; }
  85%  { transform: translateY(-25px) scaleX(0.18) scaleY(0.7);  opacity: 0.08; }
  100% { transform: translateY(-28px) scaleX(0.08) scaleY(0.4);  opacity: 0;    }
}
@keyframes smokeRiseA {
  0%   { opacity: 0.55; transform: translateY(0)     scaleX(1);   }
  50%  { opacity: 0.22; transform: translateY(-9px)  scaleX(1.45);}
  100% { opacity: 0;    transform: translateY(-22px) scaleX(0.55);}
}

/* ─────── VARIANT B: Arcane Crystal Flame ─────── */
@keyframes crystalBodyB {
  0%   { clip-path: polygon(50% 0%, 77% 24%, 94% 53%, 74% 84%, 50% 100%, 26% 84%, 6%  53%, 23% 24%);
         transform: rotate(0deg)   translateX(0px)  scaleY(1);    }
  18%  { clip-path: polygon(63% 1%, 84% 24%, 97% 54%, 76% 85%, 50% 100%, 24% 84%, 5%  53%, 20% 23%);
         transform: rotate(5deg)   translateX(4px)  scaleY(0.96); }
  36%  { clip-path: polygon(56% 1%, 80% 25%, 95% 54%, 75% 83%, 50% 100%, 25% 85%, 7%  52%, 22% 24%);
         transform: rotate(2deg)   translateX(2px)  scaleY(1.04); }
  54%  { clip-path: polygon(37% 1%, 67% 22%, 89% 53%, 72% 86%, 50% 100%, 28% 83%, 4%  57%, 27% 21%);
         transform: rotate(-5deg)  translateX(-4px) scaleY(0.95); }
  72%  { clip-path: polygon(44% 1%, 73% 23%, 92% 53%, 73% 84%, 50% 100%, 27% 85%, 7%  52%, 25% 25%);
         transform: rotate(-2deg)  translateX(-2px) scaleY(1.03); }
  100% { clip-path: polygon(50% 0%, 77% 24%, 94% 53%, 74% 84%, 50% 100%, 26% 84%, 6%  53%, 23% 24%);
         transform: rotate(0deg)   translateX(0px)  scaleY(1);    }
}
@keyframes crystalCoreB {
  0%   { transform: rotate(0deg)    translateX(0px)  scaleY(1);    }
  22%  { transform: rotate(4deg)    translateX(3px)  scaleY(0.97); }
  50%  { transform: rotate(-4deg)   translateX(-3px) scaleY(0.96); }
  75%  { transform: rotate(-1.5deg) translateX(-1px) scaleY(1.03); }
  100% { transform: rotate(0deg)    translateX(0px)  scaleY(1);    }
}
@keyframes crystalLickB {
  0%   { transform: translateY(0)    scaleX(1);   opacity: 0;    }
  10%  { opacity: 0.85; }
  38%  { transform: translateY(-10px) scaleX(0.65); opacity: 0.7;  }
  68%  { transform: translateY(-20px) scaleX(0.38); opacity: 0.28; }
  100% { transform: translateY(-26px) scaleX(0.1);  opacity: 0;    }
}
@keyframes crystalSmokeB {
  0%   { opacity: 0.5;  transform: translateY(0)     scaleX(1);   }
  50%  { opacity: 0.2;  transform: translateY(-8px)  scaleX(1.3); }
  100% { opacity: 0;    transform: translateY(-18px) scaleX(0.5); }
}
@keyframes crystalGlowB {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(180,0,255,0.8))  drop-shadow(0 0 3px rgba(255,100,255,0.5));  }
  50%       { filter: drop-shadow(0 0 18px rgba(220,80,255,1.0)) drop-shadow(0 0 8px rgba(255,150,255,0.7)); }
}

/* ─────── ORBS (C1 / C2 / C3) ─────── */
@keyframes orbPulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.05); }
}
@keyframes orbSwirl {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes orbSwirlRev {
  from { transform: rotate(0deg);    }
  to   { transform: rotate(-360deg); }
}
@keyframes orbSmoke {
  0%   { opacity: 0.5;  transform: translateY(0)     scaleX(1);    }
  50%  { opacity: 0.18; transform: translateY(-10px) scaleX(1.4);  }
  100% { opacity: 0;    transform: translateY(-22px) scaleX(0.55); }
}
@keyframes orbitSpark {
  from { transform: rotate(0deg)   translateX(24px) rotate(0deg);   }
  to   { transform: rotate(360deg) translateX(24px) rotate(-360deg); }
}
@keyframes innerFlameC1 {
  0%   { transform: scaleX(1)    scaleY(1)    rotate(-1.5deg); opacity: 0.92; }
  20%  { transform: scaleX(0.7)  scaleY(1.26) rotate(2.5deg);  opacity: 0.78; }
  45%  { transform: scaleX(1.14) scaleY(0.86) rotate(-0.8deg); opacity: 0.85; }
  70%  { transform: scaleX(0.82) scaleY(1.16) rotate(1.8deg);  opacity: 0.72; }
  100% { transform: scaleX(1)    scaleY(1)    rotate(-1.5deg); opacity: 0.92; }
}
@keyframes goldSweep {
  0%   { transform: translateX(-55px) skewX(-20deg); opacity: 0;    }
  12%  { opacity: 0.9; }
  42%  { transform: translateX(52px)  skewX(-20deg); opacity: 0.65; }
  52%  { opacity: 0; }
  100% { transform: translateX(-55px) skewX(-20deg); opacity: 0;    }
}
@keyframes causticsC2 {
  0%, 100% { transform: translate(0px, 0px)   scale(1);    opacity: 0.22; }
  35%       { transform: translate(4px, -3px)  scale(1.25); opacity: 0.38; }
  70%       { transform: translate(-3px, 2px)  scale(0.82); opacity: 0.14; }
}
@keyframes electricCrown {
  0%, 100% { box-shadow: 0 0 0 1px rgba(100,200,255,0.5), 0 0 10px 2px rgba(50,150,255,0.3); }
  33%       { box-shadow: 0 0 0 3px rgba(180,230,255,0.9), 0 0 20px 6px rgba(30,130,255,0.6); }
  66%       { box-shadow: 0 0 0 1px rgba(120,210,255,0.6), 0 0 14px 4px rgba(60,160,255,0.4); }
}
@keyframes zapBolt {
  0%, 58%, 100% { opacity: 0;    }
  60%  { opacity: 1;    }
  63%  { opacity: 0.12; }
  66%  { opacity: 0.95; }
  70%  { opacity: 0.3;  }
  73%  { opacity: 0.88; }
  77%  { opacity: 0.05; }
  80%  { opacity: 0.72; }
  85%  { opacity: 0;    }
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
@keyframes claimBtnPulse {
  0%, 100% { box-shadow: 0 0 0 0px rgba(255,165,0,0.6); }
  50%       { box-shadow: 0 0 0 8px rgba(255,165,0,0);   }
}
@keyframes slideDown {
  from { transform: translateX(-50%) translateY(-120%); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
}

/* ─────── CLAIM BURST ANIMATIONS (one-shot on button press) ─────── */
@keyframes claimBurstA {
  0%   { transform: scale(1);    box-shadow: none; }
  18%  { transform: scale(1.16); box-shadow: 0 0 24px rgba(255,100,0,0.85); }
  40%  { transform: scale(0.91); box-shadow: 0 0 8px rgba(255,100,0,0.4); }
  65%  { transform: scale(1.06); }
  82%  { transform: scale(0.98); }
  100% { transform: scale(1);    box-shadow: none; }
}
@keyframes claimBurstB {
  0%   { transform: scale(1);    filter: brightness(1); }
  15%  { transform: scale(1.14); filter: brightness(2.2); }
  38%  { transform: scale(0.92); filter: brightness(1.3); }
  65%  { transform: scale(1.05); filter: brightness(1.1); }
  100% { transform: scale(1);    filter: brightness(1); }
}
@keyframes claimBurstOrb {
  0%   { transform: scale(1);    filter: brightness(1); }
  20%  { transform: scale(1.13); filter: brightness(1.7); }
  45%  { transform: scale(0.93); filter: brightness(1.2); }
  70%  { transform: scale(1.05); }
  100% { transform: scale(1);    filter: brightness(1); }
}
@keyframes claimBurstPx {
  0%        { opacity: 1; transform: scale(1);    }
  12%, 22%  { opacity: 0; transform: scale(1.1);  }
  32%, 42%  { opacity: 1; transform: scale(1);    }
  52%, 62%  { opacity: 0; transform: scale(1.05); }
  72%, 100% { opacity: 1; transform: scale(1);    }
}
`;

// ── Shared layout ─────────────────────────────────────────────────────────────

const dateLabel: React.CSSProperties = {
	fontSize: 9, color: 'var(--text-tertiary, #666)', fontWeight: 500,
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
					<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
						<div style={{ height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							{pendingDotEl(i)}
						</div>
						<div style={{ position: 'relative', transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
							{isCurrent && (
								<div style={{
									position: 'absolute', inset: '-16px -14px', borderRadius: 22,
									background: highlightColor,
									border: `1px solid ${highlightColor.replace('0.14', '0.28').replace('0.15', '0.30')}`,
									boxShadow: `0 0 22px 8px ${highlightColor.replace('0.14', '0.1').replace('0.15', '0.1')}`,
									pointerEvents: 'none', zIndex: 0,
								}} />
							)}
							<div style={{ position: 'relative', zIndex: 1 }}>
								{getSlot(w, i, isCurrent)}
							</div>
						</div>
						<span style={{ ...dateLabel, ...dateFont, opacity: 0.35 + scale * 0.65 }}>
							{i === 6 ? 'Now' : `W-${6 - i}`}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT A — Campfire
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotA({ state, index, flashing }: { state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.18;
	if (state === 'empty') return (
		<div style={{ width: 40, height: 56, borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
	);
	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: 40, height: 56 }}>
			<div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 26, height: 8, background: 'rgba(60,60,60,0.8)', borderRadius: '50%' }} />
			{[{ x: '50%', d: '0s' }, { x: '38%', d: '0.9s' }, { x: '63%', d: '1.8s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 6, left: s.x, transform: 'translateX(-50%)', width: 5, height: 10, borderRadius: '50%', background: 'rgba(150,150,150,0.35)', animation: `smokeRiseA 2.5s ease-out ${s.d} infinite` }} />
			))}
		</div>
	);
	const p = state === 'pending';
	const licks = [
		{ left: '26%', w: 7,  h: 20, dur: 1.1,  dOff: 0    },
		{ left: '48%', w: 9,  h: 24, dur: 1.38, dOff: 0.33 },
		{ left: '69%', w: 6,  h: 17, dur: 0.95, dOff: 0.64 },
	];
	return (
		<div style={{ position: 'relative', width: 40, height: 56, animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: p ? 34 : 30, height: p ? 44 : 40, background: `rgba(255,69,0,${p ? 0.38 : 0.26})`, borderRadius: '50% 50% 30% 30% / 80% 80% 40% 40%', filter: 'blur(8px)', animation: `flameCoreA 1.3s ease-in-out ${d}s infinite` }} />
			</div>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: p ? 20 : 17, height: p ? 28 : 25, background: 'linear-gradient(to top, #FF4500, #FF8C00)', borderRadius: '50% 50% 30% 30% / 80% 80% 40% 40%', animation: `flameCoreA 1.0s ease-in-out ${d}s infinite` }} />
			</div>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: 7, height: 13, background: 'linear-gradient(to top, #FFD700, #FFF8DC)', borderRadius: '50% 50% 30% 30% / 80% 80% 40% 40%', animation: `flameCoreA 0.75s ease-in-out ${d}s infinite` }} />
			</div>
			{licks.map((lk, li) => (
				<div key={li} style={{ position: 'absolute', bottom: 11, left: lk.left, width: lk.w, height: lk.h, background: 'linear-gradient(to top, rgba(255,150,0,0.95), rgba(255,230,60,0.5), transparent)', borderRadius: '50% 50% 40% 40% / 70% 70% 50% 50%', transformOrigin: 'bottom center', animation: `flameLickA ${lk.dur}s ease-in-out ${d + lk.dOff}s infinite` }} />
			))}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT B — Arcane Crystal Flame
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotB({ state, index, flashing }: { state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.16;
	if (state === 'empty') return (
		<div style={{ width: 36, height: 54, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', background: 'rgba(180,0,255,0.08)' }}>
			<div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', border: '1px dashed rgba(180,0,255,0.25)' }} />
		</div>
	);
	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: 36, height: 54 }}>
			{[{ w: 10, h: 18, l: '30%', b: 10, r: -8 }, { w: 7, h: 14, l: '55%', b: 12, r: 6 }, { w: 5, h: 10, l: '45%', b: 24, r: -4 }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: s.b, left: s.l, transform: `translateX(-50%) rotate(${s.r}deg)`, width: s.w, height: s.h, background: 'linear-gradient(to top, #1a0030, #2d0050)', clipPath: CRYSTAL_CLIP, opacity: 0.5 + i * 0.1 }} />
			))}
			{[{ x: '50%', d: '0s' }, { x: '42%', d: '1s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: 28, left: s.x, transform: 'translateX(-50%)', width: 5, height: 9, borderRadius: '50%', background: 'rgba(120,80,150,0.3)', animation: `crystalSmokeB 2.2s ease-out ${s.d} infinite` }} />
			))}
		</div>
	);
	const p = state === 'pending';
	const licks = [
		{ left: '28%', w: 9,  h: 20, dur: 1.05, dOff: 0    },
		{ left: '50%', w: 11, h: 26, dur: 1.3,  dOff: 0.3  },
		{ left: '72%', w: 7,  h: 17, dur: 0.92, dOff: 0.58 },
	];
	return (
		<div style={{ position: 'relative', width: 36, height: 58, animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: p ? 44 : 38, height: p ? 56 : 50, background: `rgba(150,0,230,${p ? 0.38 : 0.24})`, clipPath: CRYSTAL_CLIP, filter: 'blur(10px)', animation: `crystalBodyB 2.8s ease-in-out ${d}s infinite` }} />
			</div>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: p ? 32 : 27, height: p ? 48 : 42, background: 'linear-gradient(to top, #3D0070, #7B1FA2, #B248D0, #E1BEE7, #fff)', clipPath: CRYSTAL_CLIP, animation: `crystalBodyB 2.5s ease-in-out ${d}s infinite, crystalGlowB 2.4s ease-in-out ${d}s infinite` }} />
			</div>
			<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
				<div style={{ width: 13, height: 22, background: 'linear-gradient(to top, #CC00FF, #F080FF, #FFF)', clipPath: CRYSTAL_CLIP, animation: `crystalCoreB 1.6s ease-in-out ${d}s infinite, crystalGlowB 1.4s ease-in-out ${d + 0.4}s infinite` }} />
			</div>
			{licks.map((lk, li) => (
				<div key={li} style={{ position: 'absolute', bottom: 16, left: lk.left, width: lk.w, height: lk.h, background: 'linear-gradient(to top, rgba(200,0,255,0.9), rgba(240,160,255,0.55), transparent)', clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)', transformOrigin: 'bottom center', animation: `crystalLickB ${lk.dur}s ease-in-out ${d + lk.dOff}s infinite` }} />
			))}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORBS — C1 / C2 / C3
// ═══════════════════════════════════════════════════════════════════════════════

export function FlameSlotOrb({ cfg, state, index, flashing }: { cfg: OrbCfg; state: FlameState; index: number; flashing?: boolean }) {
	const d = index * 0.28;
	const ORB = 46;

	if (state === 'empty') return (
		<div style={{ width: ORB, height: ORB + 14, display: 'flex', alignItems: 'flex-end' }}>
			<div style={{ width: ORB, height: ORB, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }} />
		</div>
	);

	if (state === 'extinguished') return (
		<div style={{ position: 'relative', width: ORB, height: ORB + 14 }}>
			{[{ x: '50%', d: '0s' }, { x: '40%', d: '1.1s' }, { x: '60%', d: '2.1s' }].map((s, i) => (
				<div key={i} style={{ position: 'absolute', bottom: ORB - 4, left: s.x, transform: 'translateX(-50%)', width: 5, height: 10, borderRadius: '50%', background: 'rgba(130,130,130,0.3)', animation: `orbSmoke 2.2s ease-out ${s.d} infinite` }} />
			))}
			<div style={{ position: 'absolute', bottom: 0, left: 0, width: ORB, height: ORB, borderRadius: '50%', background: cfg.extGradient, border: '1.5px solid rgba(60,60,60,0.4)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,30,0,0.5) 0%, transparent 70%)' }} />
				<div style={{ position: 'absolute', top: 6, left: 8, width: 11, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', transform: 'rotate(-20deg)' }} />
			</div>
		</div>
	);

	const p = state === 'pending';
	const boltAngles = cfg.id === 'c3' ? [8, -28, 46, -52, 70, -80, 20, -14] : [];
	const innerFlamesC1 = [
		{ left: '18%', w: 7,  h: ORB * 0.46, dur: '0.82s', dOff: 0      },
		{ left: '36%', w: 9,  h: ORB * 0.56, dur: '1.0s',  dOff: 0.18  },
		{ left: '55%', w: 8,  h: ORB * 0.50, dur: '0.76s', dOff: 0.36  },
		{ left: '73%', w: 6,  h: ORB * 0.40, dur: '0.90s', dOff: 0.12  },
	];

	return (
		<div style={{ position: 'relative', width: ORB, height: ORB + 14 }}>
			{cfg.id === 'c3' && (
				<div style={{ position: 'absolute', bottom: -4, left: '50%', marginLeft: -(ORB + 8) / 2, width: ORB + 8, height: ORB + 8, borderRadius: '50%', pointerEvents: 'none', animation: `electricCrown 0.45s ease-in-out ${d}s infinite` }} />
			)}
			<div style={{
				position: 'absolute', bottom: 0, left: '50%', marginLeft: -ORB / 2,
				width: ORB, height: ORB, borderRadius: '50%',
				background: p ? cfg.pendingGradient : cfg.gradient,
				border: `1.5px solid ${cfg.borderColor}`,
				overflow: 'hidden',
				animation: `${flashing ? 'claimFlash 0.5s ease-out, ' : ''}orbPulse ${p ? '1.2s' : '1.8s'} ease-in-out ${d}s infinite`,
				boxShadow: `0 0 ${p ? 22 : 14}px ${p ? 7 : 4}px rgba(${cfg.glowColor},${p ? 0.7 : 0.48}), 0 0 ${p ? 44 : 30}px ${p ? 16 : 10}px rgba(${cfg.glowColor},${p ? 0.32 : 0.18})`,
			}}>
				<div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: cfg.swirlGradient, animation: `${cfg.swirlDir} ${cfg.swirlDur} linear ${d}s infinite` }} />
				<div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: cfg.swirlGradient, opacity: 0.45, animation: `${cfg.swirlDir === 'orbSwirl' ? 'orbSwirlRev' : 'orbSwirl'} ${parseFloat(cfg.swirlDur) * 1.7}s linear ${d}s infinite` }} />
				{cfg.id === 'c1' && innerFlamesC1.map((f, fi) => (
					<div key={fi} style={{ position: 'absolute', bottom: 0, left: f.left, width: f.w, height: f.h, background: 'linear-gradient(to top, rgba(255,50,0,0.95), rgba(255,180,0,0.65), rgba(255,250,80,0.25), transparent)', borderRadius: '50% 50% 30% 30% / 80% 80% 40% 40%', transformOrigin: 'bottom center', animation: `innerFlameC1 ${f.dur} ease-in-out ${f.dOff}s infinite` }} />
				))}
				{cfg.id === 'c2' && (
					<div style={{ position: 'absolute', top: -4, left: -14, width: '55%', height: '115%', background: 'linear-gradient(108deg, transparent 0%, rgba(255,255,210,0.75) 35%, rgba(255,248,180,0.9) 50%, rgba(255,255,210,0.75) 65%, transparent 100%)', animation: `goldSweep 2.6s ease-in-out ${d * 0.5}s infinite` }} />
				)}
				{cfg.id === 'c2' && (
					<div style={{ position: 'absolute', bottom: 6, left: 8, width: 12, height: 8, borderRadius: '50%', background: 'rgba(255,240,120,0.35)', animation: `causticsC2 2.8s ease-in-out ${d}s infinite` }} />
				)}
				<div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -44%)', width: cfg.id === 'c1' ? 18 : 14, height: cfg.id === 'c1' ? 20 : 16, borderRadius: '50% 50% 40% 40% / 60% 60% 50% 50%', background: 'radial-gradient(circle at 50% 60%, rgba(255,255,240,0.9) 0%, rgba(255,230,80,0.35) 55%, transparent 100%)' }} />
				<div style={{ position: 'absolute', top: 5, left: 7, width: 14, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.28)', transform: 'rotate(-22deg)' }} />
				{cfg.id === 'c2' && <>
					<div style={{ position: 'absolute', top: 11, right: 7, width: 9, height: 6, borderRadius: '50%', background: 'rgba(255,248,180,0.32)', transform: 'rotate(18deg)' }} />
					<div style={{ position: 'absolute', bottom: 8, left: 10, width: 11, height: 6, borderRadius: '50%', background: 'rgba(255,240,100,0.22)', transform: 'rotate(-8deg)' }} />
				</>}
				{cfg.id === 'c3' && boltAngles.map((angle, bi) => (
					<div key={bi} style={{ position: 'absolute', top: '50%', left: '50%', width: bi % 3 === 0 ? 2.5 : 1.5, height: ORB * (bi % 3 === 0 ? 0.75 : 0.62), marginTop: -(ORB * (bi % 3 === 0 ? 0.375 : 0.31)), marginLeft: bi % 3 === 0 ? -1.25 : -0.75, background: `linear-gradient(to bottom, transparent 0%, ${cfg.boltColor}44 15%, ${cfg.boltColor} 42%, #ffffff 50%, ${cfg.boltColor} 58%, ${cfg.boltColor}44 85%, transparent 100%)`, transform: `rotate(${angle}deg)`, animation: `zapBolt ${0.8 + bi * 0.18}s ease-in-out ${bi * 0.22}s infinite`, borderRadius: 1 }} />
				))}
			</div>
			{p && cfg.sparkColors.map((color, si) => (
				<div key={si} style={{ position: 'absolute', bottom: ORB / 2, left: '50%', marginLeft: -(si === 0 ? 2.5 : 1.5), marginBottom: -(si === 0 ? 2.5 : 1.5), width: si === 0 ? 5 : 3, height: si === 0 ? 5 : 3, borderRadius: '50%', background: color, boxShadow: `0 0 5px 3px ${color}99`, animation: `orbitSpark ${1.4 + si * 0.3}s linear ${-0.5 * si}s infinite` }} />
			))}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT D — Pixel Art
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
		{ w: p ? 30 : 28, b: 0,  c: PX_COLORS.l1,  anim: `pxL1 0.5s steps(3) ${d}s infinite`          },
		{ w: p ? 24 : 22, b: 8,  c: PX_COLORS.l2,  anim: `pxL2 0.5s steps(3) ${d + 0.08}s infinite`  },
		{ w: p ? 18 : 16, b: 16, c: PX_COLORS.l3,  anim: `pxL3 0.5s steps(3) ${d + 0.16}s infinite`  },
		{ w: p ? 12 : 10, b: 24, c: PX_COLORS.l4,  anim: `pxL4 0.5s steps(3) ${d + 0.24}s infinite`  },
		{ w: p ? 7  : 5,  b: 32, c: PX_COLORS.tip, anim: `pxL5 0.55s steps(3) ${d + 0.05}s infinite` },
	];
	return (
		<div style={{ position: 'relative', width: 34, height: 52, imageRendering: 'pixelated', animation: flashing ? 'claimFlash 0.5s ease-out' : undefined }}>
			<div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 34, height: 10, background: PX_COLORS.ember, borderRadius: 0 }} />
			{layers.map((lyr, li) => (
				<div key={li} style={{ position: 'absolute', bottom: lyr.b, left: '50%', transform: 'translateX(-50%)', width: lyr.w, height: 8, background: lyr.c, borderRadius: 0, animation: lyr.anim }} />
			))}
			{p && !flashing && (
				<div style={{ position: 'absolute', inset: -3, border: `2px solid ${PX_COLORS.l4}`, borderRadius: 0, animation: 'pxBlink 0.6s steps(2) infinite', pointerEvents: 'none' }} />
			)}
			<div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)', pointerEvents: 'none' }} />
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LiveStreakRow — used on Dashboard with active skin
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
