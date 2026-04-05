const clean = (value?: string) => {
	const normalized = value?.trim();
	return normalized ? normalized : null;
};

export const publicSite = {
	siteName: 'Kairos lift',
	publicUrl: 'https://kairos.sebmendez.dev',
	publicDomain: 'kairos.sebmendez.dev',
	operatorName: clean(import.meta.env.VITE_PUBLIC_OPERATOR_NAME) ?? 'Kairos lift operator',
	supportEmail: clean(import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL),
	legalEffectiveDate: clean(import.meta.env.VITE_PUBLIC_LEGAL_EFFECTIVE_DATE) ?? '2026-03-29',
};

export const supportMailto = publicSite.supportEmail ? `mailto:${publicSite.supportEmail}` : null;
