import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import { Clock, Timer, Zap, User, Edit3, Save, X, Database, Globe, LogOut } from 'lucide-react';

export default function Settings() {
	const { t, i18n } = useTranslation();
	const { user, logout, updateUser } = useAuthStore();
	const [syncing, setSyncing] = useState(false);
	const [message, setMessage] = useState('');
	const [timerMode, setTimerMode] = useState<'stopwatch' | 'timer'>('stopwatch');
	const [saving, setSaving] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const [profileData, setProfileData] = useState({
		weight: user?.weight || '',
		height: user?.height || '',
		age: user?.age || '',
		priorities: (user?.priorities as any)?.selected || []
	});

	useEffect(() => {
		if (user?.settings?.timer_mode) {
			setTimerMode(user.settings.timer_mode);
		}
	}, [user]);

	useEffect(() => {
		if (user) {
			setProfileData({
				weight: user.weight || '',
				height: user.height || '',
				age: user.age || '',
				priorities: (user.priorities as any)?.selected || []
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

	const saveTimerMode = async (mode: 'stopwatch' | 'timer') => {
		setSaving(true);
		setTimerMode(mode);
		try {
			const newSettings = { ...user?.settings, timer_mode: mode };
			await api.put('/auth/me', { settings: newSettings });
			updateUser({ settings: newSettings });
		} catch (e: any) {
			console.error(e);
		} finally {
			setSaving(false);
		}
	};

	const saveProfile = async () => {
		setSaving(true);
		try {
			const updates: any = {};
			if (profileData.weight) updates.weight = Number(profileData.weight);
			if (profileData.height) updates.height = Number(profileData.height);
			if (profileData.age) updates.age = Number(profileData.age);
			if (profileData.priorities.length > 0) updates.priorities = { selected: profileData.priorities };

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

	const togglePriority = (p: string) => {
		setProfileData(prev => ({
			...prev,
			priorities: prev.priorities.includes(p)
				? prev.priorities.filter((x: string) => x !== p)
				: [...prev.priorities, p]
		}));
	};

	const handleLogout = () => {
		logout();
		window.location.href = '/login';
	};

	const priorityOptions = ['strength', 'hypertrophy', 'endurance', 'flexibility'];

	return (
		<div className="container fade-in" style={{ paddingBottom: '100px', maxWidth: '600px' }}>
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
								<span className="text-xs text-secondary">{t('Weight')}</span>
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
							<div className="flex flex-col gap-2" style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
								<span className="text-xs text-secondary">{t('Priorities')}</span>
								<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
									{(user?.priorities as any)?.selected?.length > 0 ? (
										(user?.priorities as any).selected.map((p: string) => (
											<span key={p} className="chip inactive">
												{t(p)}
											</span>
										))
									) : (
										<span className="text-sm text-tertiary">-</span>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-4 fade-in">
							<div className="grid grid-cols-3 gap-4">
								<div className="flex flex-col gap-2">
									<label className="text-xs text-secondary">{t('Weight')}</label>
									<input
										type="number"
										value={profileData.weight}
										onChange={e => setProfileData({ ...profileData, weight: e.target.value })}
										className="input text-center"
										style={{ padding: '8px' }}
										placeholder="kg"
									/>
								</div>
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
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-xs text-secondary">{t('Priorities')}</label>
								<div className="flex" style={{ flexWrap: 'wrap', gap: '8px' }}>
									{priorityOptions.map(p => (
										<button
											key={p}
											onClick={() => togglePriority(p)}
											className={`chip ${profileData.priorities.includes(p) ? 'active' : 'inactive'}`}
										>
											{t(p)}
										</button>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Section Title */}
			<h3 className="text-sm font-bold text-secondary mb-4" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{t('Preferences')}</h3>

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
							className="text-sm"
							style={{
								flex: 1,
								padding: '8px',
								textAlign: 'center',
								borderRadius: '6px',
								background: i18n.language === lng ? 'var(--bg-secondary)' : 'transparent',
								color: i18n.language === lng ? 'var(--primary)' : 'var(--text-secondary)',
								border: 'none',
								cursor: 'pointer',
								boxShadow: i18n.language === lng ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
							}}
						>
							{lng === 'en' ? 'English' : lng === 'es' ? 'Español' : 'Français'}
						</button>
					))}
				</div>
			</div>

			{/* Timer Mode */}
			<div className="card mb-4 p-4 flex flex-col gap-4">
				<div className="flex items-center gap-2 font-bold">
					<Timer size={18} className="text-secondary" />
					{t('Workout Timer Mode')}
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div
						onClick={() => saveTimerMode('stopwatch')}
						style={{
							cursor: 'pointer',
							padding: '12px',
							borderRadius: '8px',
							border: timerMode === 'stopwatch' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
							backgroundColor: timerMode === 'stopwatch' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							color: timerMode === 'stopwatch' ? 'var(--primary)' : 'var(--text-secondary)'
						}}
					>
						<Clock size={18} />
						<div className="flex flex-col">
							<span className="text-sm font-bold">{t('Stopwatch')}</span>
							<span className="text-xs opacity-70">{t('Count up')}</span>
						</div>
					</div>

					<div
						onClick={() => saveTimerMode('timer')}
						style={{
							cursor: 'pointer',
							padding: '12px',
							borderRadius: '8px',
							border: timerMode === 'timer' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
							backgroundColor: timerMode === 'timer' ? 'rgba(204, 255, 0, 0.1)' : 'transparent',
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							color: timerMode === 'timer' ? 'var(--primary)' : 'var(--text-secondary)'
						}}
					>
						<Zap size={18} />
						<div className="flex flex-col">
							<span className="text-sm font-bold">{t('Timer')}</span>
							<span className="text-xs opacity-70">{t('Countdown')}</span>
						</div>
					</div>
				</div>
			</div>

			<h3 className="text-sm font-bold text-secondary mb-4 mt-8" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>{t('System')}</h3>

			{/* Database Sync */}
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
