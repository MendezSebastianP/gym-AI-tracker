import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PublicLegalLinks from './PublicLegalLinks';
import KairosLogo from './KairosLogo';
import { publicSite } from '../config/publicSite';
import { useAuthStore } from '../store/authStore';
import '../pages/Legal.css';
import './PublicAuthShell.css';

interface PublicPageShellProps {
	eyebrow: string;
	title: string;
	description: string;
	children: ReactNode;
}

export default function PublicPageShell({ eyebrow, title, description, children }: PublicPageShellProps) {
	const { t } = useTranslation();
	const { isAuthenticated } = useAuthStore();

	return (
		<div className="legal-page-shell">
			<div className="legal-col">
				<div className="topbar">
					<Link to="/" aria-label={`${publicSite.siteName} home`}>
						<KairosLogo size="sm" />
					</Link>
					<span className="spacer" />
					<LanguageSwitcher />
					{isAuthenticated ? (
						<Link to="/home" className="legal-nav-link">{t('Back to app')}</Link>
					) : (
						<Link to="/login" className="legal-nav-link">{t('Login')}</Link>
					)}
				</div>

				<section className="legal-hero">
					<span className="legal-eyebrow"><span className="ey-line" />{eyebrow}</span>
					<h1 className="legal-title">{title}</h1>
					<p className="legal-desc">{description}</p>
					<div className="legal-meta mono">
						<span>{publicSite.publicDomain}</span>
						<span>·</span>
						<span>{t('Self-hosted service')}</span>
					</div>
				</section>

				<section className="legal-card">{children}</section>

				<div className="legalfoot">
					<span className="lf-brand mono">Kairos lift · {t('Offline-first training log')}</span>
					<div className="lf-links">
						<PublicLegalLinks centered compact showSupport />
					</div>
				</div>
			</div>
		</div>
	);
}
