import type { NavigationType } from 'react-router-dom';

export type RouteMotionKind = 'public' | 'app-peer' | 'app-stack' | 'static';

export const PUBLIC_ROUTE_PATHS = new Set(['/', '/login', '/register', '/privacy', '/terms']);
export const APP_PEER_ROUTE_ORDER = ['/home', '/dashboard', '/sessions', '/routines', '/settings'] as const;

const APP_STACK_PREFIXES = ['/sessions/', '/routines/', '/settings/questionnaire', '/onboarding', '/quests', '/shop'];
const APP_STACK_EXACT = new Set(['/routines/new', '/settings/questionnaire', '/onboarding', '/quests', '/shop']);

export const motionTokens = {
	duration: {
		fast: 0.18,
		medium: 0.28,
		publicEnter: 0.36,
		publicExit: 0.22,
	},
	ease: {
		out: [0.22, 1, 0.36, 1] as const,
		in: [0.4, 0, 1, 1] as const,
		standard: [0.32, 0.72, 0, 1] as const,
	},
	spring: {
		tap: { type: 'spring', stiffness: 540, damping: 30, mass: 0.8 },
		nav: { type: 'spring', stiffness: 440, damping: 32, mass: 0.9 },
	},
	distance: {
		publicY: 24,
		peerX: 22,
		stackX: 34,
	},
	blur: {
		public: 12,
		app: 8,
	},
};

export function isPublicPathname(pathname: string): boolean {
	return PUBLIC_ROUTE_PATHS.has(pathname);
}

function isAppPeerPathname(pathname: string): boolean {
	return APP_PEER_ROUTE_ORDER.includes(pathname as (typeof APP_PEER_ROUTE_ORDER)[number]);
}

function isAppStackPathname(pathname: string): boolean {
	if (APP_STACK_EXACT.has(pathname)) return true;
	return APP_STACK_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function classifyPathname(pathname: string): RouteMotionKind {
	if (isPublicPathname(pathname)) return 'public';
	if (isAppPeerPathname(pathname)) return 'app-peer';
	if (isAppStackPathname(pathname)) return 'app-stack';
	return 'static';
}

export function getRootShellKey(pathname: string): string {
	if (isPublicPathname(pathname)) return `public:${pathname}`;
	if (pathname.startsWith('/admin')) return 'admin-shell';
	if (pathname === '/onboarding') return 'app-standalone:/onboarding';
	return 'app-shell';
}

function getPeerIndex(pathname: string): number {
	return APP_PEER_ROUTE_ORDER.indexOf(pathname as (typeof APP_PEER_ROUTE_ORDER)[number]);
}

export function getRouteDirection(previousPath: string, nextPath: string, navigationType: NavigationType): -1 | 0 | 1 {
	if (previousPath === nextPath) return 0;

	const previousKind = classifyPathname(previousPath);
	const nextKind = classifyPathname(nextPath);

	if (previousKind === 'app-peer' && nextKind === 'app-peer') {
		const previousIndex = getPeerIndex(previousPath);
		const nextIndex = getPeerIndex(nextPath);
		if (previousIndex === -1 || nextIndex === -1) return 0;
		return nextIndex > previousIndex ? 1 : -1;
	}

	if (nextKind === 'app-stack') {
		return navigationType === 'POP' ? -1 : 1;
	}

	if (previousKind === 'public' && nextKind === 'public') {
		return navigationType === 'POP' ? -1 : 1;
	}

	if (previousKind === 'public' && nextKind !== 'public') {
		return 1;
	}

	if (previousKind !== 'public' && nextKind === 'public') {
		return -1;
	}

	return navigationType === 'POP' ? -1 : 1;
}
