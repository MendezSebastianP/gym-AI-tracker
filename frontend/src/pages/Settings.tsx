import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import { User, Edit3, Save, X, Database, Globe, LogOut, ClipboardList, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Settings() {
	const { t, i18n } = useTranslation();
	const { user, logout, updateUser } = useAuthStore();
	const [syncing, setSyncing] = useState(false);
	const [message, setMessage] = useState('');
	const [saving, setSaving] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const [profileData, setProfileData] = useState({
		height: user?.height || '',
		age: user?.age || '',
		gender: user?.gender || '',
	});

	useEffect(() => {
		if (user) {
			setProfileData({
				height: user.height || '',
				age: user.age || '',
				gender: user.gender || '',
			});
		}
	}, [user]);

	const changeLanguage = async (lng: string) => {
		i18n.changeLanguage(lng);
		localStorage.setItem('i18nextLng', lng);
		try {
			const newSettings = { ...user?.settings, language: lng };
			await api.put('/auth/me', { settings: newSettings });
			updateUser({ settings: newSettings });
		} catch (e) {
			console.error("Failed to save language preference", e);
		}
	};

	const syncExercises = async () => {
		setSyncing(true);
		setMessage('Syncing...');
		try {
			await db.exercises.clear();
			const res = await api.get('/exercises');
			await db.exercises.bulkPut(res.data);
			setMessage(`Successfully synced ${res.data.length} exercises.`);
			setTimeout(() => setMessage(''), 3000);
		} catch (e: any) {
			console.error(e);
			setMessage('Sync failed: ' + (e.message || 'Unknown error'));
		} finally {
			setSyncing(false);
		}
	};

	const saveProfile = async () => {
		setSaving(true);
		try {
			const updates: any = {};
			if (profileData.height) updates.height = Number(profileData.height);
			if (profileData.age) updates.age = Number(profileData.age);
			updates.gender = profileData.gender || null;

			await api.put('/auth/me', updates);
			updateUser(updates);
			setEditingProfile(false);
			setMessage(t('Profile updated!'));
			setTimeout(() => setMessage(''), 3000);
		} catch (e: any) {
			console.error(e);
			setMessage('Failed to save profile');
		} finally {
			setSaving(false);
		}
	};

	const handleLogout = async () => {
		await logout();
		window.location.href = '/';
	};

	const genderLabel = (g: string) => {
		if (g === 'male') return t('Male');
		if (g === 'female') return t('Female');
		if (g === 'other') return t('Other');
		if (g === 'prefer_not_to_say') return t('Prefer not to answer');
		return '-';
	};

	return (
		<div className="container" style={{ paddingBottom: '100px', maxWidth: '600px' }}>
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold" style={{ fontSize: '24px' }}>{t('Settings')}</h1>
			</div>

			{/* User Profile Section */}
			<div className="card mb-4" style={{ overflow: 'hidden', padding: 0 }}>
				<div
					style={{
						padding: '16px',
						background: 'linear-gradient(to right, rgba(255,255,255,0.03), transparent)',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						borderBottom: '1px solid rgba(255,255,255,0.05)'
					}}
				>
					<div className="flex items-center gap-md">
						<div
							style={{
								width: '40px', height: '40px', borderRadius: '50%',
								backgroundColor: 'rgba(204, 255, 0, 0.2)', color: 'var(--primary)',
								display: 'flex', alignItems: 'center', justifyContent: 'center'
							}}
						>
							<User size={20} />
						</div>
						<div>
							<h2 className="font-bold">{t('Profile')}</h2>
							<div className="text-xs text-secondary">{user?.email}</div>
						</div>
					</div>
					{!editingProfile ? (
						<button
							onClick={() => setEditingProfile(true)}
							className="btn btn-ghost"
							style={{ borderRadius: '50%', padding: '8px' }}
						>
							<Edit3 size={18} />
						</button>
					) : (
						<div className="flex gap-2">
							<button onClick={() => setEditingProfile(false)} className="btn btn-ghost" style={{ borderRadius: '50%', padding: '8px' }}>
								<X size={18} />
							</button>
							<button onClick={saveProfile} disabled={saving} className="btn btn-ghost" style={{ borderRadius: '50%', padding: '8px', color: 'var(--primary)' }}>
								<Save size={18} />
							</button>
						</div>
					)}
				</div>

				<div className="p-4" style={{ padding: '16px' }}>
					{!editingProfile ? (
						<div className="grid grid-cols-3 gap-4">
							<div className="flex flex-col gap-2">
								<div>
									<span className="text-xs text-secondary">{t('Weight')}</span>
									<div className="text-xs" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>({t('Tracked in sessions')})</div>
								</div>
								<span className="font-bold">{user?.weight ? `${user.weight} kg` : '-'}</span>
							</div>
							<div className="flex flex-col gap-2">
								<span className="text-xs text-secondary">{t('Height')}</span>
								<span className="font-bold">{user?.height ? `${user.height} cm` : '-'}</span>
							</div>
							<div className="flex flex-col gap-2">
								<span className="text-xs text-secondary">{t('Age')}</span>
								<span className="font-bold">{user?.age ? user.age : '-'}</span>
							</div>
							<div className="flex flex-col gap-2">
								<span className="text-xs text-secondary">{t('Gender')}</span>
								<span className="font-bold">{user?.gender ? genderLabel(user.gender) : '-'}</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-4 fade-in">
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
								<HelpCircle size={14} />
								{t('Weight is tracked in sessions via the Body Weight button')}
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-2">
									<label className="text-xs text-secondary">{t('Height')}</label>
									<input
										type="number"
										value={profileData.height}
										onChange={e => setProfileData({ ...profileData, height: e.target.value })}
										className="input text-center"
										style={{ padding: '8px' }}
										placeholder="cm"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<label className="text-xs text-secondary">{t('Age')}</label>
									<input
										type="number"
										value={profileData.age}
										onChange={e => setProfileData({ ...profileData, age: e.target.value })}
										className="input text-center"
										style={{ padding: '8px' }}
										placeholder="yrs"
									/>
								</div>
								<div className="flex flex-col gap-2" style={{ gridColumn: '1 / -1' }}>
									<label className="text-xs text-secondary">{t('Gender')}</label>
									<select
										value={profileData.gender}
										onChange={e => setProfileData({ ...profileData, gender: e.target.value })}
										className="input"
										style={{ padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid #444' }}
									>
										<option value="">{t('Select...')}</option>
										<option value="male">{t('Male')}</option>
										<option value="female">{t('Female')}</option>
										<option value="other">{t('Other')}</option>
										<option value="prefer_not_to_say">{t('Prefer not to answer')}</option>
									</select>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Section Title */}
			<h3 className="text-sm font-bold text-secondary mb-4" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{t('Preferences')}</h3>

			{/* Questionnaire */}
			<Link to="/settings/questionnaire" className="card mb-4 p-4 flex items-center justify-between" style={{ textDecoration: 'none' }}>
				<div className="flex items-center gap-3">
					<div style={{ padding: '8px', background: 'rgba(204, 255, 0, 0.1)', borderRadius: '8px', color: 'var(--primary)' }}>
						<ClipboardList size={20} />
					</div>
					<div>
						<div className="font-bold text-primary">{t('Training Context')}</div>
						<div className="text-xs text-secondary">{t('Customize your AI training context')}</div>
					</div>
				</div>
			</Link>

			{/* Language */}
			<div className="card mb-4 p-4 flex flex-col gap-4">
				<div className="flex items-center gap-2 font-bold">
					<Globe size={18} className="text-secondary" />
					{t('Language')}
				</div>
				<div className="flex" style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
					{['en', 'es', 'fr'].map(lng => (
						<button
							key={lng}
							onClick={() => changeLanguage(lng)}
							disabled={lng !== 'en'}
							className="text-sm"
							style={{
								flex: 1,
								padding: '8px',
								textAlign: 'center',
								borderRadius: '6px',
								background: i18n.language === lng ? 'var(--bg-secondary)' : 'transparent',
								color: i18n.language === lng ? 'var(--primary)' : 'var(--text-secondary)',
								border: 'none',
								cursor: lng === 'en' ? 'pointer' : 'not-allowed',
								boxShadow: i18n.language === lng ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
								opacity: lng === 'en' ? 1 : 0.5,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '2px'
							}}
							title={lng !== 'en' ? 'Coming soon' : undefined}
						>
							<span>{lng === 'en' ? 'English' : lng === 'es' ? 'Español' : 'Français'}</span>
							{lng !== 'en' && <span style={{ fontSize: '10px', opacity: 0.7 }}>(Soon)</span>}
						</button>
					))}
				</div>
			</div>

	
			{/* System Section Hidden Temporarily 
			<h3 className="text-sm font-bold text-secondary mb-4 mt-8" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{t('System')}</h3>

			<div className="card mb-4 p-4">
				<div className="flex items-center gap-2 font-bold mb-2">
					<Database size={18} className="text-secondary" />
					{t('Database')}
				</div>
				<p className="text-xs text-secondary mb-4 opacity-70">
					{t("If you don't see any exercises, try syncing the database manually.")}
				</p>
				{message && <div style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '12px' }}>{message}</div>}
				<button
					onClick={syncExercises}
					disabled={syncing}
					className="btn btn-secondary w-full"
				>
					{syncing ? 'Syncing...' : t('Resync Exercises')}
				</button>
			</div>
			*/}

			{/* Logout */}
			<button
				onClick={handleLogout}
				className="btn w-full flex items-center justify-center gap-2 mt-8"
				style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}
			>
				<LogOut size={18} />
				{t('Logout')}
			</button>

			<div className="text-center mt-8 text-xs text-tertiary opacity-50">
				Gym AI Tracker v0.1.0
			</div>
		</div>
	);
}
