import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Calendar, Settings as SettingsIcon, BarChart2 } from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import GamificationToast from './GamificationToast';
import { AnimatedAppOutlet } from '../motion/RouteTransition';
import { motionTokens } from '../motion/routes';

const NAV_ITEMS = [
	{ to: '/home', labelKey: 'Home', icon: Home },
	{ to: '/dashboard', labelKey: 'Stats', icon: BarChart2 },
	{ to: '/sessions', labelKey: 'Sessions', icon: Calendar },
	{ to: '/routines', labelKey: 'Routines', icon: Dumbbell },
	{ to: '/settings', labelKey: 'Settings', icon: SettingsIcon },
] as const;

const Layout = () => {
	const { t } = useTranslation();
	const location = useLocation();

	React.useEffect(() => {
		window.scrollTo(0, 0);
	}, [location.pathname]);

	return (
		<div className="layout-container" style={{ paddingBottom: '92px' }}>
			<GamificationToast />
			<main>
				<AnimatedAppOutlet />
			</main>

			<nav className="app-nav">
				<LayoutGroup>
					<div className="app-nav-inner">
						{NAV_ITEMS.map((item) => {
							const active = location.pathname === item.to;
							const Icon = item.icon;
							return (
								<Link key={item.to} to={item.to} className="app-nav-item">
									<div className="app-nav-item-frame">
										{active ? (
											<motion.span
												layoutId="app-nav-pill"
												className="app-nav-pill"
												transition={motionTokens.spring.nav}
											/>
										) : null}
										<motion.span
											animate={{ y: active ? -2 : 0, scale: active ? 1.04 : 1 }}
											transition={{ duration: 0.24, ease: motionTokens.ease.out }}
										>
											<Icon size={22} color={active ? 'var(--primary)' : 'var(--text-tertiary)'} />
										</motion.span>
										<motion.span
											className="app-nav-item-label"
											animate={{ y: active ? 0 : 1, opacity: active ? 1 : 0.82, color: active ? 'var(--primary)' : 'var(--text-tertiary)' }}
											transition={{ duration: 0.22, ease: motionTokens.ease.out }}
										>
											{t(item.labelKey)}
										</motion.span>
									</div>
								</Link>
							);
						})}
					</div>
				</LayoutGroup>
			</nav>
		</div>
	);
};

export default Layout;
