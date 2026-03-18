import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface AdminUser {
	id: number;
	email: string;
	is_active: boolean;
	is_demo: boolean;
	level: number;
	session_count: number;
}

export default function AdminUsers() {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchUsers = async () => {
		setLoading(true);
		try {
			const res = await api.get('/admin/users');
			setUsers(res.data);
		} catch (err: any) {
			console.error('Failed to fetch users:', err);
			setError('Could not load user list.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUsers();
	}, []);

	if (loading) {
		return <div className="loading-spinner" style={{ margin: '40px auto' }}></div>;
	}

	if (error) {
		return <div style={{ color: 'var(--error)' }}>{error}</div>;
	}

	return (
		<div>
			<h1 style={{ color: 'var(--primary)', marginBottom: '8px' }}>User Management</h1>
			<p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
				Total Registered Users: {users.length}
			</p>

			<div className="admin-card">
				<div style={{ overflowX: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
						<thead>
							<tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>ID</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Email</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Status</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Total Workouts</th>
								<th style={{ padding: '12px 16px', fontWeight: 500 }}>Gamification Level</th>
								<th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
									<td style={{ padding: '16px', color: 'var(--text-tertiary)' }}>#{u.id}</td>
									<td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>
										{u.email}
										{u.is_demo && <span className="admin-badge" style={{ marginLeft: '8px' }}>Demo</span>}
									</td>
									<td style={{ padding: '16px' }}>
										{u.is_active ? (
											<span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
												<ShieldCheck size={16} /> Active
											</span>
										) : (
											<span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
												<ShieldAlert size={16} /> Disabled
											</span>
										)}
									</td>
									<td style={{ padding: '16px', color: 'var(--text-primary)' }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
											<Activity size={14} color="var(--primary)" />
											{u.session_count}
										</div>
									</td>
									<td style={{ padding: '16px', color: 'var(--text-secondary)' }}>Lvl {u.level}</td>
									<td style={{ padding: '16px', textAlign: 'right' }}>
										<button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
											{u.is_active ? 'Disable' : 'Enable'}
										</button>
									</td>
								</tr>
							))}
							{users.length === 0 && (
								<tr>
									<td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
										No users found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
