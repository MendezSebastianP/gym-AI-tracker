import { useAuthStore } from '../../store/authStore';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function AdminSettings() {
	const { user } = useAuthStore();

	return (
		<div>
			<h1 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Admin Settings</h1>
			<p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
				Manage your superuser preferences.
			</p>

			<div className="admin-card" style={{ maxWidth: '600px' }}>
				<h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
					Account Details
				</h3>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
					<span style={{ color: 'var(--text-secondary)' }}>Email:</span>
					<span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user?.email}</span>

					<span style={{ color: 'var(--text-secondary)' }}>Role:</span>
					<span className="admin-badge" style={{ alignSelf: 'start' }}>Superuser</span>
				</div>

				<h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
					Preferences
				</h3>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span style={{ color: 'var(--text-secondary)' }}>Language</span>
					<LanguageSwitcher />
				</div>
			</div>
		</div>
	);
}
