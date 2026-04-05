/**
 * KairosLogo — reusable brand component.
 * Uses K3 (Sport/Italic) letterform + Logo B glow effect.
 *
 * Props:
 *   size        — 'sm' (28px icon), 'md' (40px icon), 'lg' (56px icon). Default: 'md'
 *   showWordmark — render "KAIROS lift" text next to the icon. Default: true
 *   showTagline  — render "Seize the moment" below wordmark. Default: false
 */

const LIME = '#CCFF00';

interface KairosLogoProps {
	size?: 'sm' | 'md' | 'lg';
	showWordmark?: boolean;
	showTagline?: boolean;
	className?: string;
}

const SIZE_MAP = {
	sm: 28,
	md: 40,
	lg: 56,
};

const TEXT_SIZE_MAP = {
	sm: 14,
	md: 20,
	lg: 28,
};

const TAGLINE_SIZE_MAP = {
	sm: 8,
	md: 10,
	lg: 12,
};

export default function KairosLogo({
	size = 'md',
	showWordmark = true,
	showTagline = false,
	className,
}: KairosLogoProps) {
	const px = SIZE_MAP[size];
	const filterId = `kairos-glow-${size}`;
	const fontSize = TEXT_SIZE_MAP[size];
	const taglineFontSize = TAGLINE_SIZE_MAP[size];
	const radius = Math.round(px * 0.22);

	return (
		<div
			className={className}
			style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(px * 0.35) }}
		>
			<svg
				width={px}
				height={px}
				viewBox="0 0 80 80"
				fill="none"
				aria-hidden="true"
				style={{ flexShrink: 0 }}
			>
				<defs>
					<filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
						<feGaussianBlur stdDeviation="4" result="blur" />
						<feMerge>
							<feMergeNode in="blur" />
							<feMergeNode in="blur" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>
				<rect width="80" height="80" rx={radius * (80 / px)} fill="#050505" />
				<g filter={`url(#${filterId})`}>
					<path
						d="M11,66 L23,66 L26,47 L64,68 L63,60 L34,40 L69,20 L72,12 L28,33 L31,14 L19,14 Z"
						fill={LIME}
					/>
				</g>
			</svg>

			{showWordmark && (
				<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
					<div
						style={{
							fontSize,
							fontWeight: 900,
							letterSpacing: '-0.02em',
							lineHeight: 1,
							color: '#fff',
							textShadow: `0 0 18px ${LIME}55`,
							whiteSpace: 'nowrap',
						}}
					>
						KAIROS
						<span
							style={{
								color: LIME,
								textShadow: `0 0 10px ${LIME}`,
							}}
						>
							{' '}lift
						</span>
					</div>
					{showTagline && (
						<div
							style={{
								fontSize: taglineFontSize,
								color: '#555',
								letterSpacing: '0.18em',
								textTransform: 'uppercase',
								marginTop: 3,
								lineHeight: 1,
							}}
						>
							Seize the moment
						</div>
					)}
				</div>
			)}
		</div>
	);
}
