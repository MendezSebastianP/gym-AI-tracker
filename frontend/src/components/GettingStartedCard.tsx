import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Gift } from 'lucide-react';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useAuthStore } from '../store/authStore';
import CoinIcon from './icons/CoinIcon';
import {
	areRequiredOnboardingStepsDone,
	DISPLAY_ONBOARDING_STEPS,
	getClaimableOnboardingCoins,
	getClaimableOnboardingSteps,
	getClaimedOnboardingCoins,
	normalizeOnboardingProgress,
	ONBOARDING_STEP_COINS,
	REQUIRED_ONBOARDING_STEPS,
	type OnboardingStep,
	type OnboardingStepKey,
} from '../utils/onboarding';
import './GettingStartedCard.css';

interface GettingStartedCardProps {
	progressRaw?: Record<string, any> | null;
	onClaimed?: (result?: {
		currency: number;
		onboarding_progress: Record<string, any>;
		coins_awarded: number;
		claimed_steps: string[];
	}) => Promise<void> | void;
}

const QUESTIONNAIRE_SUBSTEPS = new Set<OnboardingStepKey>(['questionnaire_l2', 'questionnaire_l3']);
const QUESTIONNAIRE_HELPERS: Partial<Record<OnboardingStepKey, string>> = {
	questionnaire_l2: 'Optional follow-up after the basic questionnaire',
	questionnaire_l3: 'Optional deeper training context',
};

export default function GettingStartedCard({ progressRaw, onClaimed }: GettingStartedCardProps) {
	const { user, updateUser } = useAuthStore();
	const [expanded, setExpanded] = useState(false);
	const [claimingStep, setClaimingStep] = useState<OnboardingStepKey | null>(null);
	const [claimedFlashCoins, setClaimedFlashCoins] = useState<number | null>(null);
	const [recentlyClaimedSteps, setRecentlyClaimedSteps] = useState<string[]>([]);
	const [claimError, setClaimError] = useState<string | null>(null);

	const onboardingProgress = useMemo(() => normalizeOnboardingProgress(progressRaw), [progressRaw]);
	const checklistCompleted = DISPLAY_ONBOARDING_STEPS.filter((step) => onboardingProgress[step.key]).length;
	const checklistTotal = DISPLAY_ONBOARDING_STEPS.length;
	const claimableStepKeys = getClaimableOnboardingSteps(onboardingProgress);
	const claimableCoins = getClaimableOnboardingCoins(onboardingProgress);
	const claimableSteps = new Set(claimableStepKeys);
	const claimedCoins = getClaimedOnboardingCoins(onboardingProgress);
	const totalCoins = DISPLAY_ONBOARDING_STEPS.reduce((sum, step) => sum + (ONBOARDING_STEP_COINS[step.key] || 0), 0);
	const tutorialRequiredDone = areRequiredOnboardingStepsDone(onboardingProgress);
	const tutorialRewardClaimed = onboardingProgress.coins_awarded.includes('tutorial_complete');
	const mandatorySteps = DISPLAY_ONBOARDING_STEPS.filter((step) => REQUIRED_ONBOARDING_STEPS.includes(step.key));
	const activeChecklistStep = DISPLAY_ONBOARDING_STEPS.find((step) => !onboardingProgress[step.key])?.key;
	const nextMandatoryStep = mandatorySteps.find((step) => !onboardingProgress[step.key]) ?? null;
	const remainingMandatoryPoints = mandatorySteps.filter((step) => !onboardingProgress[step.key]).length;
	const mandatoryCompleted = REQUIRED_ONBOARDING_STEPS.filter((step) => onboardingProgress[step]).length;
	const mandatoryTotal = REQUIRED_ONBOARDING_STEPS.length;
	const showCard = !tutorialRewardClaimed || !tutorialRequiredDone || claimableCoins > 0 || claimedFlashCoins !== null;
	const tutorialJustClaimed = recentlyClaimedSteps.includes('tutorial_complete');
	const collapsedSummary = claimedFlashCoins !== null
		? `+${claimedFlashCoins} coins claimed`
		: remainingMandatoryPoints > 0
		? `${remainingMandatoryPoints} mandatory point${remainingMandatoryPoints === 1 ? '' : 's'} left${claimableCoins > 0 ? ` · +${claimableCoins} ready to claim` : ''}`
		: `Mandatory path complete${claimableCoins > 0 ? ` · +${claimableCoins} ready to claim` : ''}`;

	useEffect(() => {
		if (claimedFlashCoins === null) {
			return;
		}
		const timer = window.setTimeout(() => setClaimedFlashCoins(null), 1800);
		return () => window.clearTimeout(timer);
	}, [claimedFlashCoins]);

	useEffect(() => {
		if (recentlyClaimedSteps.length === 0) {
			return;
		}
		const timer = window.setTimeout(() => setRecentlyClaimedSteps([]), 1500);
		return () => window.clearTimeout(timer);
	}, [recentlyClaimedSteps]);

	if (!showCard) {
		return null;
	}

	const claimRewards = async (step: OnboardingStepKey) => {
		const canClaimThisStep = step === 'tutorial_complete'
			? tutorialRequiredDone && !tutorialRewardClaimed
			: claimableSteps.has(step);
		if (claimingStep || !canClaimThisStep) {
			return;
		}

		setClaimingStep(step);
		setClaimError(null);
		try {
			const res = await api.post('/gamification/onboarding/claim', { step });
			const nextUser = {
				...(user || {}),
				currency: res.data.currency,
				onboarding_progress: res.data.onboarding_progress,
			};
			updateUser({
				currency: res.data.currency,
				onboarding_progress: res.data.onboarding_progress,
			});
			await db.users.put(nextUser as any).catch(() => {});
			if ((res.data.coins_awarded || 0) > 0) {
				setClaimedFlashCoins(res.data.coins_awarded);
			}
			setRecentlyClaimedSteps(Array.isArray(res.data.claimed_steps) ? res.data.claimed_steps : []);
			await Promise.resolve(onClaimed?.(res.data));
		} catch (error) {
			console.error('Failed to claim Getting Started rewards', error);
			setClaimError('Could not claim the Getting Started reward right now.');
		} finally {
			setClaimingStep(null);
		}
	};

	const renderReward = (stepKey: OnboardingStepKey, options: {
		coins: number;
		claimed: boolean;
		readyToClaim: boolean;
		isCollecting: boolean;
		final?: boolean;
	}) => {
		const { coins, claimed, readyToClaim, isCollecting, final = false } = options;
		const isClaiming = claimingStep === stepKey;
		const classes = `getting-started-step-reward ${final ? 'getting-started-final-reward' : ''} ${claimed ? 'is-claimed' : readyToClaim ? 'is-ready' : ''} ${isCollecting ? 'is-collecting' : ''} ${isClaiming ? 'is-claiming' : ''}`.trim();
		const content = (
			<>
				{(isCollecting || isClaiming) && (
					<div className="getting-started-coin-burst" aria-hidden="true">
						<span />
						<span />
						<span />
						<span />
						<span />
					</div>
				)}
				<span className="getting-started-step-reward-ring" aria-hidden="true" />
				<CoinIcon size={12} className="getting-started-step-reward-coin" />
				<span className="getting-started-step-reward-value">
					{isClaiming ? 'Collecting' : claimed ? 'Claimed' : `+${coins}`}
				</span>
			</>
		);

		if (readyToClaim) {
			return (
				<button
					type="button"
					className={`${classes} motion-btn motion-btn--claim is-ready ${isClaiming ? 'is-bursting' : ''}`.trim()}
					onClick={() => claimRewards(stepKey)}
					disabled={claimingStep !== null}
					aria-label={`Claim ${coins} coins for ${stepKey}`}
				>
					{content}
				</button>
			);
		}

		return <div className={classes}>{content}</div>;
	};

	const renderStep = (step: OnboardingStep, collapsedPreview = false) => {
		const done = onboardingProgress[step.key];
		const isActive = activeChecklistStep === step.key;
		const isLocked = step.key === 'first_session' && !onboardingProgress.first_routine;
		const coins = ONBOARDING_STEP_COINS[step.key];
		const claimed = onboardingProgress.coins_awarded.includes(step.key);
		const readyToClaim = done && coins > 0 && claimableSteps.has(step.key);
		const isCollecting = recentlyClaimedSteps.includes(step.key);
		const isSubstep = QUESTIONNAIRE_SUBSTEPS.has(step.key);
		const helperText = QUESTIONNAIRE_HELPERS[step.key];

		return (
			<div
				key={step.key}
				className={`getting-started-step ${done ? 'is-done' : ''} ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''} ${isCollecting ? 'is-collecting' : ''} ${isSubstep ? 'is-substep' : ''} ${collapsedPreview ? 'is-collapsed-preview' : ''}`.trim()}
			>
				<div className="getting-started-step-main">
					<span className={`getting-started-step-indicator ${done ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
						{done ? <Check size={12} /> : isLocked ? '•' : isActive ? '•' : ''}
					</span>
					<div className="getting-started-step-copy">
						<span className="getting-started-step-label">{step.label}</span>
						{helperText ? <span className="getting-started-step-helper">{helperText}</span> : null}
					</div>
				</div>
				{coins > 0 ? renderReward(step.key, { coins, claimed, readyToClaim, isCollecting }) : (
					<div className="getting-started-step-core">Core</div>
				)}
			</div>
		);
	};

	return (
		<div className="getting-started-card card">
			<div className="getting-started-header">
				<div>
					<div className="getting-started-kicker">Getting Started</div>
					<div className="getting-started-title">Build your base</div>
					<div className={`getting-started-summary ${claimableCoins > 0 ? 'is-ready' : ''}`}>
						{collapsedSummary}
					</div>
				</div>
				<div className="getting-started-header-actions">
					<div className="getting-started-count">{checklistCompleted}/{checklistTotal}</div>
					<button
						type="button"
						className={`getting-started-toggle ${expanded ? 'is-open' : ''}`}
						onClick={() => setExpanded((current) => !current)}
						aria-expanded={expanded}
					>
						<span>{expanded ? 'Collapse' : 'Expand'}</span>
						<ChevronDown size={16} />
					</button>
				</div>
			</div>

			<div className="getting-started-progress-track">
				<div className="getting-started-progress-fill" style={{ width: `${Math.round((checklistCompleted / checklistTotal) * 100)}%` }} />
			</div>

			{!expanded ? (
				<div className="getting-started-collapsed-preview">
					{nextMandatoryStep ? renderStep(nextMandatoryStep, true) : null}
					{!nextMandatoryStep && (tutorialRequiredDone || tutorialRewardClaimed || tutorialJustClaimed) ? (
						<div className={`getting-started-step getting-started-final-step ${tutorialRequiredDone && !tutorialRewardClaimed ? 'is-ready' : ''} ${tutorialRewardClaimed || tutorialJustClaimed ? 'is-claimed' : ''} ${tutorialJustClaimed || claimingStep === 'tutorial_complete' ? 'is-collecting' : ''} is-collapsed-preview`.trim()}>
							<div className="getting-started-step-main getting-started-final-main">
								<span className={`getting-started-step-indicator getting-started-final-indicator ${tutorialRewardClaimed || tutorialJustClaimed ? 'is-done' : tutorialRequiredDone ? 'is-active' : ''}`}>
									{tutorialRewardClaimed || tutorialJustClaimed ? <Check size={12} /> : <Gift size={12} />}
								</span>
								<div className="getting-started-final-copy">
									<span className="getting-started-final-title">Final bonus</span>
									<span className="getting-started-final-text">
										{tutorialJustClaimed && claimedFlashCoins !== null
											? `+${claimedFlashCoins} coins added.`
											: tutorialRewardClaimed
											? 'Reward claimed.'
											: 'Claim when the mandatory path is done.'}
									</span>
								</div>
							</div>
							{renderReward('tutorial_complete', {
								coins: ONBOARDING_STEP_COINS.tutorial_complete,
								claimed: tutorialRewardClaimed || tutorialJustClaimed,
								readyToClaim: tutorialRequiredDone && !tutorialRewardClaimed,
								isCollecting: tutorialJustClaimed,
								final: true,
							})}
						</div>
					) : null}
					{!nextMandatoryStep && tutorialRequiredDone && !tutorialRewardClaimed ? (
						<div className="getting-started-collapsed-note">Tap the glowing coin reward to claim it.</div>
					) : null}
				</div>
			) : null}

			{expanded && (
				<>
					<div className="getting-started-steps">
						{DISPLAY_ONBOARDING_STEPS.map((step) => renderStep(step))}

						<div
							className={`getting-started-step getting-started-final-step ${tutorialRequiredDone && !tutorialRewardClaimed ? 'is-ready' : ''} ${tutorialRewardClaimed || tutorialJustClaimed ? 'is-claimed' : ''} ${tutorialJustClaimed || claimingStep === 'tutorial_complete' ? 'is-collecting' : ''}`.trim()}
						>
							<div className="getting-started-step-main getting-started-final-main">
								<span className={`getting-started-step-indicator getting-started-final-indicator ${tutorialRewardClaimed || tutorialJustClaimed ? 'is-done' : tutorialRequiredDone ? 'is-active' : ''}`}>
									{tutorialRewardClaimed || tutorialJustClaimed ? <Check size={12} /> : <Gift size={12} />}
								</span>
								<div className="getting-started-final-copy">
									<span className="getting-started-final-title">Final bonus</span>
									<span className="getting-started-final-text">
										{tutorialJustClaimed && claimedFlashCoins !== null
											? `+${claimedFlashCoins} coins added.`
											: tutorialRewardClaimed
											? 'Reward claimed.'
											: tutorialRequiredDone
											? 'All mandatory points are done. Claim it from the coin reward.'
											: `${mandatoryCompleted}/${mandatoryTotal} mandatory points completed.`}
									</span>
								</div>
							</div>
							<div className="getting-started-final-side">
								{renderReward('tutorial_complete', {
									coins: ONBOARDING_STEP_COINS.tutorial_complete,
									claimed: tutorialRewardClaimed || tutorialJustClaimed,
									readyToClaim: tutorialRequiredDone && !tutorialRewardClaimed,
									isCollecting: tutorialJustClaimed,
									final: true,
								})}
							</div>
						</div>
					</div>

					<div className="getting-started-footer">
						<div>Claimed {claimedCoins}/{totalCoins} coins</div>
						{claimableCoins > 0 && <div className="getting-started-footer-ready">+{claimableCoins} ready now</div>}
					</div>
					{claimError && <div className="getting-started-error">{claimError}</div>}
				</>
			)}
		</div>
	);
}
