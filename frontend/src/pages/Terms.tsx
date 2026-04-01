import type { ReactNode } from 'react';
import PublicPageShell from '../components/PublicPageShell';
import { publicSite, supportMailto } from '../config/publicSite';

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="legal-section">
			<h2>{title}</h2>
			<div className="legal-copy">{children}</div>
		</section>
	);
}

export default function Terms() {
	return (
		<PublicPageShell
			eyebrow="Terms"
			title="Terms of Use"
			description="Basic rules for using the public Gym AI Tracker deployment hosted at gym-ai-tracker.duckdns.org."
		>
			<div className="legal-summary-grid">
				<div>
					<span className="legal-summary-label">Effective date</span>
					<strong>{publicSite.legalEffectiveDate}</strong>
				</div>
				<div>
					<span className="legal-summary-label">Operator</span>
					<strong>{publicSite.operatorName}</strong>
				</div>
				<div>
					<span className="legal-summary-label">Service</span>
					<strong>{publicSite.publicDomain}</strong>
				</div>
				<div>
					<span className="legal-summary-label">Support</span>
					<strong>{publicSite.supportEmail ?? 'Configure VITE_PUBLIC_SUPPORT_EMAIL before public launch'}</strong>
				</div>
			</div>

			<Section title="Use of the service">
				<p>
					Gym AI Tracker is a workout logging and routine-planning service. You may use it to create an account, log training, review progress, and use optional AI-powered features.
				</p>
			</Section>

			<Section title="Account responsibility">
				<p>
					You are responsible for the accuracy of the information you enter, for keeping your login credentials private, and for activity that happens through your account.
				</p>
			</Section>

			<Section title="No medical or professional guarantee">
				<p>
					This service does not provide medical advice, injury diagnosis, rehabilitation guidance, or a guarantee of fitness results. Training decisions remain your responsibility.
				</p>
			</Section>

			<Section title="AI feature limits">
				<p>
					AI-generated routines, suggestions, and progression reports may be incomplete, imperfect, or unsuitable for your situation. Treat AI output as assistance, not as professional coaching or medical instruction.
				</p>
			</Section>

			<Section title="Acceptable use">
				<ul className="legal-list">
					<li>Do not abuse rate limits, automation, rewards, onboarding, or gamification systems.</li>
					<li>Do not try to access admin routes, other users’ data, or parts of the service you are not authorized to use.</li>
					<li>Do not interfere with the service, reverse-engineer it for abuse, or submit malicious content through forms or AI prompts.</li>
				</ul>
			</Section>

			<Section title="Availability and warranties">
				<p>
					The service is provided on an “as is” and “as available” basis. Because it is self-hosted, uptime, latency, and feature availability may change during maintenance, deployments, outages, or provider issues.
				</p>
			</Section>

			<Section title="Suspension or removal">
				<p>
					The operator may suspend, restrict, or remove access for abuse, security issues, admin misuse attempts, or any behavior that puts the service or other users at risk.
				</p>
			</Section>

			<Section title="Contact">
				<p>
					Questions about these terms can be sent to {supportMailto ? publicSite.supportEmail : 'the support email configured for this deployment'}.
				</p>
			</Section>
		</PublicPageShell>
	);
}
