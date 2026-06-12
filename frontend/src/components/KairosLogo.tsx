/**
 * KairosLogo — brand mark. Lime tile + K letterform, flat (no glow).
 *
 * Props:
 *   size        — 'sm' (26px icon), 'md' (34px icon), 'lg' (48px icon). Default: 'md'
 *   showWordmark — render "KAIROS lift" text next to the icon. Default: true
 *   showTagline  — render mono tagline below wordmark. Default: false
 */

interface KairosLogoProps {
	size?: 'sm' | 'md' | 'lg';
	showWordmark?: boolean;
	showTagline?: boolean;
	className?: string;
}

const SIZE_MAP = { sm: 26, md: 34, lg: 48 };
const TEXT_SIZE_MAP = { sm: 14, md: 17, lg: 22 };
const TAGLINE_SIZE_MAP = { sm: 8, md: 9, lg: 10 };

export default function KairosLogo({
	size = 'md',
	showWordmark = true,
	showTagline = false,
	className,
}: KairosLogoProps) {
	const px = SIZE_MAP[size];

	return (
		<div
			className={className}
			style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(px * 0.3) }}
		>
			<svg viewBox="0 0 32 32" width={px} height={px} aria-hidden="true" style={{ flexShrink: 0, display: 'block', borderRadius: px * 0.28 }}>
				<rect width="32" height="32" rx="9" fill="var(--lime)" />
				<path
					d="M11 6.5V25.5M11 16.4L19.5 6.5M13.6 14.6L21 25.5"
					stroke="var(--on-lime)"
					strokeWidth="3.1"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>

			{showWordmark && (
				<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
					<div
						style={{
							fontSize: TEXT_SIZE_MAP[size],
							fontWeight: 800,
							letterSpacing: '-0.01em',
							lineHeight: 1,
							color: 'var(--text)',
							whiteSpace: 'nowrap',
						}}
					>
						KAIROS
						<span style={{ fontWeight: 500, color: 'var(--text-3)', marginLeft: 5, letterSpacing: 0 }}>lift</span>
					</div>
					{showTagline && (
						<div
							className="mono"
							style={{
								fontSize: TAGLINE_SIZE_MAP[size],
								color: 'var(--text-4)',
								marginTop: 4,
								lineHeight: 1,
							}}
						>
							Train · Log · Repeat
						</div>
					)}
				</div>
			)}
		</div>
	);
}
