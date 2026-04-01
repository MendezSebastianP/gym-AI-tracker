import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, LineChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import PublicLegalLinks from './PublicLegalLinks';
import './PublicAuthShell.css';

interface PublicAuthShellProps {
	eyebrow: string;
	title: string;
	subtitle: string;
	altPrompt: ReactNode;
	children: ReactNode;
	cardClassName?: string;
}

export default function PublicAuthShell({
	eyebrow,
	title,
	subtitle,
	altPrompt,
	children,
	cardClassName = '',
}: PublicAuthShellProps) {
	const { t } = useTranslation();

	return (
		<div className="public-auth-page">
			<div className="public-auth-bg" aria-hidden="true">
				<div className="public-auth-grid" />
				<div className="public-auth-glow is-left" />
				<div className="public-auth-glow is-right" />
			</div>

			<nav className="public-auth-nav">
				<Link to="/" className="public-auth-logo" aria-label="Gym AI Tracker home">
					<span>Gym</span>
					<strong>AI</strong>
				</Link>
				<div className="public-auth-nav-actions">
					<LanguageSwitcher compact />
					<Link to="/" className="public-auth-nav-link motion-btn motion-btn--cta motion-btn--soft motion-btn--public">{t('Home')}</Link>
				</div>
			</nav>

			<main className="public-auth-layout">
				<section className="public-auth-story">
					<div className="public-auth-story-badge">{eyebrow}</div>
					<h1>{title}</h1>
					<p>{subtitle}</p>
					<div className="public-auth-points">
						<div className="public-auth-point">
							<ShieldCheck size={16} />
							<span>{t('Your data stays in your own training journal')}</span>
						</div>
						<div className="public-auth-point">
							<LineChart size={16} />
							<span>{t('Log sessions, review charts, and keep progress readable')}</span>
						</div>
						<div className="public-auth-point">
							<Sparkles size={16} />
							<span>{t('Use AI only where it actually helps')}</span>
						</div>
					</div>
					<Link to="/" className="public-auth-home-cta motion-btn motion-btn--cta motion-btn--soft motion-btn--public">
						<ArrowLeft size={16} />
						{t('Back to home')}
					</Link>
				</section>

				<section className="public-auth-card-wrap">
					<div className={`public-auth-card ${cardClassName}`.trim()}>
						<div className="public-auth-card-top">
							<Link to="/" className="public-auth-inline-home motion-btn motion-btn--cta motion-btn--soft motion-btn--public">
								<ArrowLeft size={15} />
								{t('Home')}
							</Link>
						</div>
						{children}
						<div className="public-auth-alt-row">{altPrompt}</div>
						<div className="public-auth-card-actions">
							<Link to="/" className="public-auth-secondary-cta motion-btn motion-btn--cta motion-btn--soft motion-btn--public">
								{t('Go to homepage')}
							</Link>
							<Link to="/" className="public-auth-primary-ghost motion-btn motion-btn--cta motion-btn--soft motion-btn--public">
								{t('Explore home')}
								<ArrowRight size={16} className="motion-btn__icon" />
							</Link>
						</div>
						<PublicLegalLinks centered compact style={{ marginTop: '18px' }} />
					</div>
				</section>
			</main>
		</div>
	);
}
