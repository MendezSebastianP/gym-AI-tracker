import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Dumbbell, Calendar, User, Settings as SettingsIcon } from 'lucide-react';
import React from 'react';

const Layout = () => {
	const { t } = useTranslation();
	const location = useLocation();

	React.useEffect(() => {
		window.scrollTo(0, 0);
	}, [location.pathname]);

	const isActive = (path: string) => location.pathname === path;

	return (
		<div className="layout-container" style={{ paddingBottom: '80px' }}>
			<main>
				<Outlet />
			</main>

			{/* Bottom Navigation */}
			<nav style={{
				position: 'fixed',
				bottom: 0,
				left: 0,
				right: 0,
				backgroundColor: 'var(--bg-secondary)',
				borderTop: '1px solid #333',
				padding: '10px 0',
				display: 'flex',
				justifyContent: 'space-around',
				alignItems: 'center',
				zIndex: 100,
				backdropFilter: 'blur(10px)',
				backgroundColor: 'rgba(30, 30, 30, 0.9)'
			}}>
				<NavItem to="/" icon={<Home size={24} />} label={t("Dashboard")} active={isActive('/')} />
				<NavItem to="/sessions" icon={<Calendar size={24} />} label={t("Sessions")} active={isActive('/sessions')} />
				<NavItem to="/routines" icon={<Dumbbell size={24} />} label={t("Routines")} active={isActive('/routines')} />
				<NavItem to="/settings" icon={<SettingsIcon size={24} />} label={t("Settings")} active={isActive('/settings')} />
			</nav>
		</div>
	);
};

const NavItem = ({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) => (
	<Link to={to} style={{
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		color: active ? 'var(--primary)' : 'var(--text-tertiary)',
		transition: 'color 0.2s',
		textDecoration: 'none'
	}}>
		{icon}
		<span style={{ fontSize: '10px', marginTop: '4px' }}>{label}</span>
	</Link>
);

export default Layout;
