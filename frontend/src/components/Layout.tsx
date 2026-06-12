import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GamificationToast from './GamificationToast';
import { AnimatedAppOutlet } from '../motion/RouteTransition';

/* Kairos nav icons — 22px grid, 1.8–2 stroke, currentColor */
const NavIcons = {
	home: (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
			<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	),
	insights: (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
			<path d="M4 20V10M9.5 20V4M15 20v-7M20.5 20V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	),
	sessions: (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
			<rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
			<path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	),
	routines: (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
			<path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	),
	settings: (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
			<circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
			<path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	),
} as const;

const NAV_ITEMS = [
	{ to: '/home', labelKey: 'Home', icon: NavIcons.home },
	{ to: '/dashboard', labelKey: 'Stats', icon: NavIcons.insights },
	{ to: '/sessions', labelKey: 'Sessions', icon: NavIcons.sessions },
	{ to: '/routines', labelKey: 'Routines', icon: NavIcons.routines },
	{ to: '/settings', labelKey: 'Settings', icon: NavIcons.settings },
] as const;

const Layout = () => {
	const { t } = useTranslation();
	const location = useLocation();

	React.useEffect(() => {
		window.scrollTo(0, 0);
	}, [location.pathname]);

	return (
		<div style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))' }}>
			<GamificationToast />
			<main>
				<AnimatedAppOutlet />
			</main>

			<nav className="nav">
				{NAV_ITEMS.map((item) => {
					const active = location.pathname === item.to;
					return (
						<Link key={item.to} to={item.to} className={`nav-item ${active ? 'on' : ''}`}>
							<span className="ni">{item.icon}</span>
							{t(item.labelKey)}
						</Link>
					);
				})}
			</nav>
		</div>
	);
};

export default Layout;
