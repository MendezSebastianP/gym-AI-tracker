import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Coins, Home, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
	getClaimableOnboardingCoins,
	getCompletedOnboardingStepKeys,
	normalizeOnboardingProgress,
	ONBOARDING_STEPS,
	type OnboardingStepKey,
} from '../utils/onboarding';
import './OnboardingToast.css';

interface OnboardingToastItem {
	id: string;
	title: string;
	message: string;
	coinsReady: number;
	isFinal: boolean;
}

const STEP_LABELS = Object.fromEntries(ONBOARDING_STEPS.map((step) => [step.key, step.label])) as Record<OnboardingStepKey, string>;

function buildToastItems(keys: OnboardingStepKey[], claimableCoins: number): OnboardingToastItem[] {
	if (keys.includes('tutorial_complete')) {
		return [{
			id: `tutorial_complete_${Date.now()}`,
			title: 'Getting Started complete',
			message: claimableCoins > 0
				? `All mandatory steps are done. Go to Home to claim +${claimableCoins} coins.`
				: 'All mandatory steps are done. Home shows the final claim state.',
			coinsReady: claimableCoins,
			isFinal: true,
		}];
	}

	if (keys.length > 1 && keys.every((key) => key.startsWith('questionnaire_'))) {
		return [{
			id: `questionnaire_${Date.now()}`,
			title: 'Training context updated',
			message: claimableCoins > 0
				? `Your questionnaire progress is saved. Go to Home to claim +${claimableCoins} coins.`
				: 'Your questionnaire progress is saved. Home shows the next step.',
			coinsReady: claimableCoins,
			isFinal: false,
		}];
	}

	return keys.map((key, index) => ({
		id: `${key}_${Date.now()}_${index}`,
		title: STEP_LABELS[key],
		message: claimableCoins > 0
			? `Completed. Go to Home to claim +${claimableCoins} coins.`
			: 'Completed. Go to Home to keep moving through Getting Started.',
		coinsReady: claimableCoins,
		isFinal: false,
	}));
}

export default function OnboardingToast() {
	const navigate = useNavigate();
	const location = useLocation();
	const { user } = useAuthStore();
	const [queue, setQueue] = useState<OnboardingToastItem[]>([]);
	const [activeToast, setActiveToast] = useState<OnboardingToastItem | null>(null);
	const [closing, setClosing] = useState(false);

	const onboardingProgress = useMemo(() => normalizeOnboardingProgress(user?.onboarding_progress), [user?.onboarding_progress]);

	useEffect(() => {
		if (!user?.id) {
			setQueue([]);
			setActiveToast(null);
			setClosing(false);
			return;
		}

		const storageKey = `onboarding_seen_steps_${user.id}`;
		const completedKeys = getCompletedOnboardingStepKeys(onboardingProgress);
		const raw = localStorage.getItem(storageKey);

		if (!raw) {
			localStorage.setItem(storageKey, JSON.stringify(completedKeys));
			return;
		}

		let seen = new Set<OnboardingStepKey>();
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				seen = new Set(parsed.filter((value): value is OnboardingStepKey => typeof value === 'string' && value in STEP_LABELS));
			}
		} catch {
			seen = new Set<OnboardingStepKey>();
		}

		const newKeys = completedKeys.filter((key) => !seen.has(key));
		if (newKeys.length === 0) {
			return;
		}

		const claimableCoins = getClaimableOnboardingCoins(onboardingProgress);
		setQueue((current) => [...current, ...buildToastItems(newKeys, claimableCoins)]);

		newKeys.forEach((key) => seen.add(key));
		localStorage.setItem(storageKey, JSON.stringify(Array.from(seen)));
	}, [onboardingProgress, user?.id]);

	useEffect(() => {
		if (activeToast || queue.length === 0) {
			return;
		}
		setActiveToast(queue[0]);
		setQueue((current) => current.slice(1));
		setClosing(false);
	}, [activeToast, queue]);

	useEffect(() => {
		if (!activeToast || closing) {
			return;
		}
		const timer = window.setTimeout(() => {
			setClosing(true);
		}, 5200);
		return () => window.clearTimeout(timer);
	}, [activeToast, closing]);

	useEffect(() => {
		if (!closing) {
			return;
		}
		const timer = window.setTimeout(() => {
			setActiveToast(null);
			setClosing(false);
		}, 280);
		return () => window.clearTimeout(timer);
	}, [closing]);

	if (!activeToast) {
		return null;
	}

	const isOnHome = location.pathname === '/home';

	const closeToast = () => {
		setClosing(true);
	};

	const openHome = () => {
		navigate('/home');
		closeToast();
	};

	return (
		<div className={`onboarding-toast-shell ${closing ? 'is-closing' : ''}`}>
			<div className={`onboarding-toast-card ${activeToast.isFinal ? 'is-final' : ''}`}>
				<div className="onboarding-toast-orb" aria-hidden="true" />
				<button className="onboarding-toast-close" onClick={closeToast} aria-label="Close Getting Started notification">
					<X size={16} />
				</button>
				<div className="onboarding-toast-header">
					<div className="onboarding-toast-icon">
						{activeToast.isFinal ? <Sparkles size={18} /> : <CheckCircle2 size={18} />}
					</div>
					<div>
						<div className="onboarding-toast-kicker">Getting Started</div>
						<div className="onboarding-toast-title">{activeToast.title}</div>
					</div>
				</div>
				<p className="onboarding-toast-message">{activeToast.message}</p>
				<div className="onboarding-toast-actions">
					<div className="onboarding-toast-chip">
						<Coins size={14} />
						<span>{activeToast.coinsReady > 0 ? `+${activeToast.coinsReady} to claim` : 'Progress saved'}</span>
					</div>
					<button className="onboarding-toast-home" onClick={openHome}>
						<Home size={14} />
						<span>{isOnHome ? 'See claim area' : 'Go to Home'}</span>
						<ArrowRight size={14} />
					</button>
				</div>
			</div>
		</div>
	);
}
