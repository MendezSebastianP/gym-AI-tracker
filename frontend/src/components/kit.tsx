/**
 * kit — shared Kairos design primitives.
 * Hand-drawn pencil dividers + the handful of signature icons the design
 * system uses beyond lucide (bolt, spark, coach bubble, coin, dumbbell).
 * All icons: 24-grid, currentColor, ~1.8 stroke.
 */
import type { SVGProps, ReactNode } from 'react';

type P = SVGProps<SVGSVGElement>;

/** Wobbly hand-drawn horizontal divider (used in .sec-label). */
export function Pencil({ className = 'pencil' }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 200 8" preserveAspectRatio="none" fill="none" aria-hidden="true">
			<path
				d="M1 5.4C26 3.1 52 6.2 78 4.3c24-1.7 49 2.6 73 1.1 16-1 31-2.1 47-1.6"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** Hand-drawn lime underline (sits under exercise names in focus views). */
export function Underline() {
	return (
		<svg className="ul" viewBox="0 0 120 6" preserveAspectRatio="none" fill="none" aria-hidden="true">
			<path d="M2 4.2C22 2.4 44 5 64 3.4 82 2 101 4.4 118 3.1" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

/** Section label row: mono text + pencil divider. */
export function SecLabel({ children }: { children: ReactNode }) {
	return (
		<div className="sec-label">
			<span className="mono">{children}</span>
			<Pencil />
		</div>
	);
}

export const K = {
	bolt: (p: P) => (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
		</svg>
	),
	spark: (p: P) => (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z" fill="currentColor" />
		</svg>
	),
	sparkBig: (p: P) => (
		<svg width="34" height="34" viewBox="0 0 40 40" fill="none" {...p}>
			<path d="M28 6l1.2 3.4L32 11l-2.8 1L28 16l-1.2-3.4L24 11l3-1.6L28 6z" fill="currentColor" />
			<path d="M14 16l.8 2.4L17 19l-2 .8L14 22l-.8-2.4L11 19l2.2-.8L14 16z" fill="currentColor" opacity=".6" />
		</svg>
	),
	dumbbell: (p: P) => (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M6.5 9v6M4 10.5v3M17.5 9v6M20 10.5v3M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	),
	coach: (p: P) => (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M4 5h16v11H7l-3 3V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
			<path d="M8 9.5h8M8 12.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	),
	flame: (p: P) => (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M12 3c1 3-2 4-2 7a2 2 0 104 0c0-1 2 1 2 4a6 6 0 11-9-5c1.5-1.5 3-3 2-6z" fill="currentColor" />
		</svg>
	),
	updown: (p: P) => (
		<svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M8 9l4-4 4 4M8 15l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	),
	check: (p: P) => (
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" {...p}>
			<path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	),
	checkRing: (p: P) => (
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" {...p}>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" opacity=".4" />
			<path d="M8 12.3l2.6 2.6L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	),
};

/** Streak-coin disc (amber, "K" stamp). Sized by the parent via .coin css. */
export function Coin({ size }: { size?: number }) {
	const style = size ? { width: size, height: size } : undefined;
	return (
		<span className="coin" style={style} aria-hidden="true">
			<span style={size ? { fontSize: Math.max(8, Math.round(size * 0.55)) } : undefined}>K</span>
		</span>
	);
}
