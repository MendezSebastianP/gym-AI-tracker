const clean = (value?: string) => {
	const normalized = value?.trim();
	return normalized ? normalized : null;
};

export const publicSite = {
	siteName: 'Gym AI Tracker',
	publicUrl: 'https://gym-ai-tracker.duckdns.org',
	publicDomain: 'gym-ai-tracker.duckdns.org',
	operatorName: clean(import.meta.env.VITE_PUBLIC_OPERATOR_NAME) ?? 'Gym AI Tracker operator',
	supportEmail: clean(import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL),
	legalEffectiveDate: clean(import.meta.env.VITE_PUBLIC_LEGAL_EFFECTIVE_DATE) ?? '2026-03-29',
};

export const supportMailto = publicSite.supportEmail ? `mailto:${publicSite.supportEmail}` : null;
