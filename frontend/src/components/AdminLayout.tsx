import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut, Users, Activity, Settings, BarChart2 } from 'lucide-react';
import '../AdminLayout.css';

export default function AdminLayout() {
	const { logout, user } = useAuthStore();
	const navigate = useNavigate();
	const location = useLocation();

	const handleLogout = () => {
		logout();
		navigate('/login');
	};

	const navItems = [
		{ path: '/admin', label: 'Dashboard', icon: <BarChart2 size={20} /> },
		{ path: '/admin/users', label: 'Users', icon: <Users size={20} /> },
		{ path: '/admin/exercises', label: 'Exercise Catalog', icon: <Activity size={20} /> },
		{ path: '/admin/settings', label: 'Settings', icon: <Settings size={20} /> }
	];

	return (
		<div className="admin-layout">
			<aside className="admin-sidebar">
				<div className="admin-sidebar-header">
					<h2>Gym AI Admin</h2>
					<span className="admin-badge">Superuser</span>
				</div>

				<nav className="admin-nav">
					{navItems.map((item) => (
						<Link
							key={item.path}
							to={item.path}
							className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
						>
							{item.icon}
							<span>{item.label}</span>
						</Link>
					))}
				</nav>

				<div className="admin-sidebar-footer">
					<div className="admin-user-info">
						<span>{user?.email}</span>
					</div>
					<button onClick={handleLogout} className="admin-logout-btn">
						<LogOut size={18} />
						<span>Logout</span>
					</button>
				</div>
			</aside>

			<main className="admin-main">
				<Outlet />
			</main>
		</div>
	);
}
