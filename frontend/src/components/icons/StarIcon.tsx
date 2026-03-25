import React from 'react';

export default function StarIcon({ size = 16, style = {}, className = "" }: { size?: number, style?: React.CSSProperties, className?: string }) {
	return (
		<svg
			width={size} height={size}
			viewBox="0 0 24 24" fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))', ...style }}
		>
			<path
				d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
				fill="url(#starGrad)"
			/>
			{/* Glossy inner stroke for a premium shiny look */}
			<path
				d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
				stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinejoin="round" fill="none"
			/>

			<defs>
				<linearGradient id="starGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
					<stop stopColor="currentColor" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0.65" />
				</linearGradient>
			</defs>
		</svg>
	);
}
