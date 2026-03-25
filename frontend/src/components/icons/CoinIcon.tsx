import React from 'react';

export default function CoinIcon({ size = 16, style = {}, className = "" }: { size?: number, style?: React.CSSProperties, className?: string }) {
	return (
		<svg
			width={size} height={size}
			viewBox="0 0 24 24" fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			style={{ display: 'inline-block', verticalAlign: 'middle', ...style, filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
		>
			<circle cx="12" cy="12" r="11" fill="url(#coinGradOuter)" />
			<circle cx="12" cy="12" r="8" fill="url(#coinGradInner)" />
			{/* Currency Symbol Center Cutout Look */}
			<path d="M12 7V17M9 10H15M9 14H15" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" />

			<defs>
				<linearGradient id="coinGradOuter" x1="1" y1="1" x2="23" y2="23" gradientUnits="userSpaceOnUse">
					<stop stopColor="currentColor" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0.4" />
				</linearGradient>
				<linearGradient id="coinGradInner" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
					<stop stopColor="currentColor" stopOpacity="0.8" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
				</linearGradient>
			</defs>
		</svg>
	);
}
