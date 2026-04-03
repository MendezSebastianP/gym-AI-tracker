import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PublicLegalLinks from './PublicLegalLinks';
import { publicSite } from '../config/publicSite';
import { useAuthStore } from '../store/authStore';
import '../pages/Legal.css';

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
			<div className="legal-page-bg" aria-hidden="true">
				<div className="legal-page-grid" />
				<div className="legal-page-glow legal-page-glow-left" />
				<div className="legal-page-glow legal-page-glow-right" />
			</div>

			<nav className="legal-page-nav">
				<Link to="/" className="legal-page-logo" aria-label={`${publicSite.siteName} home`}>
					<span>Gym</span>
					<strong>AI</strong>
				</Link>
				<div className="legal-page-nav-actions">
					<LanguageSwitcher compact />
					{isAuthenticated ? (
						<Link to="/home" className="legal-page-nav-cta">{t('Back to app')}</Link>
					) : (
						<>
							<Link to="/" className="legal-page-nav-link">{t('Home')}</Link>
							<Link to="/login" className="legal-page-nav-link">{t('Login')}</Link>
							<Link to="/register" className="legal-page-nav-cta">{t('Register')}</Link>
						</>
					)}
				</div>
			</nav>

			<main className="legal-page-content">
				<section className="legal-page-hero">
					<span className="legal-page-kicker">{eyebrow}</span>
					<h1>{title}</h1>
					<p>{description}</p>
					<div className="legal-page-meta">
						<span>{publicSite.publicDomain}</span>
						<span>{t('Self-hosted service')}</span>
					</div>
				</section>

				<section className="legal-page-card">{children}</section>
			</main>

			<footer className="legal-page-footer">
				<div>{publicSite.siteName}</div>
				<PublicLegalLinks centered showSupport />
			</footer>
		</div>
	);
}
