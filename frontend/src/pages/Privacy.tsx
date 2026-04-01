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

export default function Privacy() {
	return (
		<PublicPageShell
			eyebrow="Privacy"
			title="Privacy Policy"
			description="How Gym AI Tracker stores account data, workout history, browser data, and AI requests on the live DuckDNS deployment."
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
					<span className="legal-summary-label">Public site</span>
					<strong>{publicSite.publicUrl}</strong>
				</div>
				<div>
					<span className="legal-summary-label">Support</span>
					<strong>{publicSite.supportEmail ?? 'Configure VITE_PUBLIC_SUPPORT_EMAIL before public launch'}</strong>
				</div>
			</div>

			{!supportMailto && (
				<div className="legal-note legal-note-warning">
					A public support email is not configured in this build yet. Set <code>VITE_PUBLIC_SUPPORT_EMAIL</code> on the mini PC before launch.
				</div>
			)}

			<Section title="Who operates this service">
				<p>
					Gym AI Tracker is operated directly by {publicSite.operatorName} and served from a self-hosted setup at {publicSite.publicDomain}.
					 The app is not currently run through a third-party SaaS hosting platform.
				</p>
			</Section>

			<Section title="What data the app stores">
				<ul className="legal-list">
					<li>Account data such as your email address, password hash, and account status.</li>
					<li>Profile and training context data such as height, age, gender, goals, equipment, and other routine preferences.</li>
					<li>Workout data such as routines, session history, sets, reps, weight, cardio metrics, notes, effort ratings, and progression history.</li>
					<li>Gamification data such as XP, level, coins, quests, streak rewards, onboarding state, and unlocks.</li>
					<li>Operational records tied to AI usage and routine/report generation so the service can track saved outputs and feature usage.</li>
				</ul>
			</Section>

			<Section title="Browser storage and offline data">
				<p>
					The app uses browser storage so the PWA can stay logged in, remember settings, and continue working offline.
				</p>
				<ul className="legal-list">
					<li><strong>localStorage</strong> is used for auth/session continuity, language choice, routine drafts, and a small amount of app state.</li>
					<li><strong>IndexedDB</strong> is used to cache exercises, users, routines, sessions, and sets for offline-first behavior and sync recovery.</li>
				</ul>
			</Section>

			<Section title="Cookies">
				<p>
					This deployment does not currently use non-essential analytics cookies, marketing cookies, ad trackers, or third-party cookie banners.
					 If that changes later, this policy and the consent flow must be updated before the feature goes live.
				</p>
			</Section>

			<Section title="AI features and OpenAI">
				<p>
					When you use AI features such as routine generation or progression reports, relevant training context and prompt content may be sent to OpenAI to produce the result.
					 AI suggestions are assistive only. You remain responsible for training choices, safety, and exercise selection.
				</p>
			</Section>

			<Section title="How to request access, correction, export, or deletion">
				<p>
					To request account data access, export, correction, or deletion, contact the operator using the public support address for this deployment.
					 {supportMailto ? 'The configured address is shown above and linked in the footer.' : 'Set the support email before public launch so users have a working contact path.'}
				</p>
			</Section>

			<Section title="Security and retention">
				<p>
					Reasonable steps are taken to protect the service, but no self-hosted internet service can promise perfect security or uninterrupted availability.
					 Data may be retained as long as the account remains active, until the operator needs to rotate backups, or until a valid deletion request is completed.
				</p>
			</Section>
		</PublicPageShell>
	);
}
