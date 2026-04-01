import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportMailto } from '../config/publicSite';

interface PublicLegalLinksProps {
	showSupport?: boolean;
	centered?: boolean;
	compact?: boolean;
	style?: CSSProperties;
}

export default function PublicLegalLinks({
	showSupport = false,
	centered = false,
	compact = false,
	style,
}: PublicLegalLinksProps) {
	const { t } = useTranslation();
	const linkStyle: CSSProperties = {
		color: 'var(--text-secondary)',
		textDecoration: 'none',
		fontSize: compact ? '12px' : '13px',
		fontWeight: 600,
	};

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: centered ? 'center' : 'flex-start',
				flexWrap: 'wrap',
				gap: compact ? '8px' : '10px',
				color: 'var(--text-tertiary)',
				...style,
			}}
		>
			<Link to="/privacy" style={linkStyle}>{t('Privacy')}</Link>
			<span aria-hidden="true">·</span>
			<Link to="/terms" style={linkStyle}>{t('Terms')}</Link>
			{showSupport && supportMailto && (
				<>
					<span aria-hidden="true">·</span>
					<a href={supportMailto} style={linkStyle}>{t('Support')}</a>
				</>
			)}
		</div>
	);
}
