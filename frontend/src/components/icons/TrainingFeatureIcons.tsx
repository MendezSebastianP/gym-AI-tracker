import type { CSSProperties } from 'react';

type IconProps = {
	size?: number;
	style?: CSSProperties;
};

export function FailureFeatureIcon({ size = 18, style }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={style} aria-hidden="true">
			<circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" opacity="0.35" />
			<circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.8" />
			<path d="M13 4.8L9.8 11.8h2.8L11 19.2l3.2-7.1h-2.7L13 4.8Z" fill="currentColor" />
		</svg>
	);
}

export function DropSetFeatureIcon({ size = 18, style }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={style} aria-hidden="true">
			<rect x="3" y="5" width="14" height="2.4" rx="1.2" fill="currentColor" opacity="0.9" />
			<rect x="3" y="10" width="11" height="2.4" rx="1.2" fill="currentColor" opacity="0.75" />
			<rect x="3" y="15" width="8" height="2.4" rx="1.2" fill="currentColor" opacity="0.6" />
			<path d="M19.2 7.2v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			<path d="M16.8 13.2L19.2 15.8l2.4-2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function EffortFeatureIcon({ size = 18, style }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size} fill="none" style={style} aria-hidden="true">
			<path d="M4 15.5a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			<path d="M12 15.5l4.2-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			<circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
		</svg>
	);
}
