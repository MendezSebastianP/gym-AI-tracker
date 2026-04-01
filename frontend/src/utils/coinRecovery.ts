import { isGettingStartedFullyClaimed, normalizeOnboardingProgress } from './onboarding';

export interface CoinRecoveryTarget {
	to: '/home' | '/quests';
	label: string;
	helper: string;
}

export function getCoinRecoveryTarget(onboardingRaw?: Record<string, any> | null): CoinRecoveryTarget {
	const gettingStartedDone = isGettingStartedFullyClaimed(normalizeOnboardingProgress(onboardingRaw));

	if (!gettingStartedDone) {
		return {
			to: '/home',
			label: 'Go to Build your base',
			helper: 'Finish Build your base to unlock easy starter coins.',
		};
	}

	return {
		to: '/quests',
		label: 'Go to Quests',
		helper: 'Quests are the next place to earn coins for AI features.',
	};
}
