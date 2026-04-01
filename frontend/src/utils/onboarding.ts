export const ONBOARDING_STEP_COINS = {
	profile: 10,
	questionnaire_l1: 20,
	questionnaire_l2: 20,
	questionnaire_l3: 20,
	first_routine: 0,
	first_session: 0,
	tutorial_complete: 50,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEP_COINS;

export interface OnboardingStep {
	key: OnboardingStepKey;
	label: string;
	required: boolean;
}

export interface OnboardingProgress {
	profile: boolean;
	questionnaire_l1: boolean;
	questionnaire_l2: boolean;
	questionnaire_l3: boolean;
	first_routine: boolean;
	first_session: boolean;
	tutorial_complete: boolean;
	coins_awarded: OnboardingStepKey[];
}

export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
	profile: false,
	questionnaire_l1: false,
	questionnaire_l2: false,
	questionnaire_l3: false,
	first_routine: false,
	first_session: false,
	tutorial_complete: false,
	coins_awarded: [],
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
	{ key: 'profile', label: 'Set up your profile', required: true },
	{ key: 'questionnaire_l1', label: 'Basic questionnaire', required: true },
	{ key: 'questionnaire_l2', label: 'Intermediate questionnaire', required: false },
	{ key: 'questionnaire_l3', label: 'Advanced questionnaire', required: false },
	{ key: 'first_routine', label: 'Create your first routine', required: true },
	{ key: 'first_session', label: 'Complete your first workout', required: true },
	{ key: 'tutorial_complete', label: 'Complete tutorial', required: false },
];

export const DISPLAY_ONBOARDING_STEPS = ONBOARDING_STEPS.filter((step) => step.key !== 'tutorial_complete');
export const REQUIRED_ONBOARDING_STEPS = ONBOARDING_STEPS.filter((step) => step.required).map((step) => step.key);

export function normalizeOnboardingProgress(raw?: Record<string, any> | null): OnboardingProgress {
	const progress: OnboardingProgress = {
		...DEFAULT_ONBOARDING_PROGRESS,
		coins_awarded: [],
	};

	if (!raw || typeof raw !== 'object') {
		return progress;
	}

	for (const key of Object.keys(ONBOARDING_STEP_COINS) as OnboardingStepKey[]) {
		if (key === 'tutorial_complete' || key in raw) {
			progress[key] = Boolean(raw[key]);
		}
	}

	if (Array.isArray(raw.coins_awarded)) {
		const seen = new Set<OnboardingStepKey>();
		progress.coins_awarded = raw.coins_awarded.filter((step: unknown): step is OnboardingStepKey => {
			if (typeof step !== 'string' || !(step in ONBOARDING_STEP_COINS)) {
				return false;
			}
			const typedStep = step as OnboardingStepKey;
			if (seen.has(typedStep)) {
				return false;
			}
			seen.add(typedStep);
			return true;
		});
	}

	return progress;
}

export function getClaimableOnboardingSteps(progress: OnboardingProgress): OnboardingStepKey[] {
	const claimed = new Set(progress.coins_awarded);
	return (Object.keys(ONBOARDING_STEP_COINS) as OnboardingStepKey[]).filter((step) => {
		return ONBOARDING_STEP_COINS[step] > 0 && progress[step] && !claimed.has(step);
	});
}

export function getClaimableOnboardingCoins(progress: OnboardingProgress): number {
	return getClaimableOnboardingSteps(progress).reduce((sum, step) => sum + ONBOARDING_STEP_COINS[step], 0);
}

export function getClaimedOnboardingCoins(progress: OnboardingProgress): number {
	return progress.coins_awarded.reduce((sum, step) => sum + (ONBOARDING_STEP_COINS[step] || 0), 0);
}

export function getCompletedOnboardingStepKeys(progress: OnboardingProgress): OnboardingStepKey[] {
	return ONBOARDING_STEPS.filter((step) => progress[step.key]).map((step) => step.key);
}

export function areRequiredOnboardingStepsDone(progress: OnboardingProgress): boolean {
	return REQUIRED_ONBOARDING_STEPS.every((step) => progress[step]);
}

export function isGettingStartedFullyClaimed(progress: OnboardingProgress): boolean {
	return areRequiredOnboardingStepsDone(progress) && progress.coins_awarded.includes('tutorial_complete');
}
