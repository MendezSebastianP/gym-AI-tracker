import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { User, Edit3, Save, X, Database, Globe, LogOut, ClipboardList, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DropSetFeatureIcon, EffortFeatureIcon, FailureFeatureIcon } from '../components/icons/TrainingFeatureIcons';
import PublicLegalLinks from '../components/PublicLegalLinks';
import { publicSite, supportMailto } from '../config/publicSite';

export default function Settings() {
	const { t, i18n } = useTranslation();
	const { user, logout, updateUser } = useAuthStore();
	const [syncing, setSyncing] = useState(false);
	const [message, setMessage] = useState('');
	const [saving, setSaving] = useState(false);
	const [editingProfile, setEditingProfile] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [helpModal, setHelpModal] = useState<'training_context' | 'training_features' | null>(null);
	const [profileData, setProfileData] = useState({
		height: user?.height || '',
		age: user?.age || '',
		gender: user?.gender || '',
	});
	const completedSessionsCount = useLiveQuery(
		() => db.sessions.filter((s: any) => !!s.completed_at).count(),
		[],
		0
	);
	const ADVANCED_UNLOCK_SESSIONS = 5;
	const advancedUnlocked = (completedSessionsCount ?? 0) >= ADVANCED_UNLOCK_SESSIONS;
	const remainingAdvancedSessions = Math.max(0, ADVANCED_UNLOCK_SESSIONS - (completedSessionsCount ?? 0));

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
			const res = await api.put('/auth/me', { settings: newSettings });
			updateUser(res.data);
			await db.users.put(res.data).catch(() => {});
		} catch (e) {
			console.error("Failed to save language preference", e);
		}
	};

	const updateTrainingSetting = async (key: string, value: any) => {
		try {
			const newSettings = { ...(user?.settings || {}), [key]: value };
			const res = await api.put('/auth/me', { settings: newSettings });
			updateUser(res.data);
			await db.users.put(res.data).catch(() => {});
		} catch (e) {
			console.error(`Failed to update ${key}`, e);
			setMessage('Failed to save setting');
			setTimeout(() => setMessage(''), 2500);
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

			const res = await api.put('/auth/me', updates);
			updateUser(res.data);
			await db.users.put(res.data).catch(() => {});
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
		window.location.href = '/login';
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
			<div className="card mb-4 p-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
				<Link
					to="/settings/questionnaire"
					className="flex items-center"
					style={{ textDecoration: 'none', flex: 1, minWidth: 0, gap: '12px' }}
				>
					<div style={{
						width: '38px',
						height: '38px',
						flexShrink: 0,
						display: 'inline-flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(204, 255, 0, 0.1)',
						borderRadius: '10px',
						border: '1px solid rgba(204,255,0,0.22)',
						color: 'var(--primary)',
					}}>
						<ClipboardList size={20} />
					</div>
					<div style={{ minWidth: 0, display: 'grid', gap: '2px', lineHeight: 1.25 }}>
						<div className="font-bold text-primary">{t('Training Context')}</div>
						<div className="text-xs text-secondary">{t('Customize your AI training context')}</div>
					</div>
				</Link>
				<button
					onClick={() => setHelpModal('training_context')}
					className="btn btn-ghost"
					style={{
						padding: '6px',
						borderRadius: '999px',
						border: '1px solid var(--border)',
						width: '30px',
						height: '30px',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						flexShrink: 0,
					}}
					title="What is Training Context?"
				>
					<HelpCircle size={15} />
				</button>
			</div>

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

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '24px', marginBottom: '16px' }}>
				<h3 className="text-sm font-bold text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
					Training Features (Advanced)
				</h3>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					<button
						onClick={() => advancedUnlocked && setAdvancedOpen((v) => !v)}
						disabled={!advancedUnlocked}
						className="btn btn-ghost"
						style={{
							padding: '6px 10px',
							borderRadius: '999px',
							border: advancedUnlocked ? '1px solid var(--border)' : '1px solid rgba(148,163,184,0.35)',
							height: '30px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '11px',
							fontWeight: 700,
							color: advancedUnlocked ? 'var(--text-secondary)' : 'var(--text-tertiary)',
							cursor: advancedUnlocked ? 'pointer' : 'not-allowed',
							opacity: advancedUnlocked ? 1 : 0.7,
						}}
						title={advancedUnlocked ? (advancedOpen ? 'Collapse advanced settings' : 'Expand advanced settings') : 'Unlock after 5 completed sessions'}
					>
						{advancedOpen ? 'Hide' : 'Show'}
					</button>
					<button
						onClick={() => setHelpModal('training_features')}
						className="btn btn-ghost"
						style={{
							padding: '6px',
							borderRadius: '999px',
							border: '1px solid var(--border)',
							width: '30px',
							height: '30px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
						title="How training features work"
					>
						<HelpCircle size={15} />
					</button>
				</div>
			</div>
			<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '-8px', marginBottom: '12px' }}>
				{advancedUnlocked
					? 'Optional logging controls for advanced training detail.'
					: `Unlocks after ${ADVANCED_UNLOCK_SESSIONS} completed sessions (${completedSessionsCount ?? 0}/${ADVANCED_UNLOCK_SESSIONS}).`}
			</div>

			{!advancedUnlocked && (
				<div className="card mb-4" style={{ padding: '12px 14px', border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.08)' }}>
					<div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
						Complete <strong style={{ color: 'var(--text-primary)' }}>{remainingAdvancedSessions}</strong> more session{remainingAdvancedSessions === 1 ? '' : 's'} to unlock Training Features.
					</div>
				</div>
			)}

			{advancedUnlocked && advancedOpen && (
				<div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
				{[
					{
						key: 'failure_tracking_enabled',
						title: 'Failure Tracking',
						description: 'Mark sets where you went to failure',
						enabled: !!user?.settings?.failure_tracking_enabled,
						color: '#f87171',
						icon: <FailureFeatureIcon size={16} />,
					},
					{
						key: 'effort_tracking_enabled',
						title: 'Effort Tracking',
						description: 'Rate sessions and track effort score',
						enabled: !!user?.settings?.effort_tracking_enabled,
						color: '#4ade80',
						icon: <EffortFeatureIcon size={16} />,
					},
					{
						key: 'drop_sets_enabled',
						title: 'Drop Sets',
						description: 'Add reduced-weight sets after work',
						enabled: !!user?.settings?.drop_sets_enabled,
						color: '#fbbf24',
						icon: <DropSetFeatureIcon size={16} />,
					},
				].map((item, idx, arr) => (
					<div
						key={item.key}
						style={{
							padding: '14px 16px',
							borderBottom: idx === arr.length - 1 && !user?.settings?.drop_sets_enabled ? 'none' : '1px solid rgba(255,255,255,0.06)',
						}}
					>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
								<span style={{
									width: '24px',
									height: '24px',
									borderRadius: '8px',
									border: `1px solid ${item.color}55`,
									background: `${item.color}1f`,
									color: item.color,
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}>
									{item.icon}
								</span>
								<span>{item.title}</span>
							</div>
							<button
								onClick={() => updateTrainingSetting(item.key, !item.enabled)}
								style={{
									padding: '5px 10px',
									borderRadius: '999px',
									border: item.enabled ? '1px solid rgba(34,197,94,0.7)' : '1px solid var(--border)',
									background: item.enabled ? 'rgba(34,197,94,0.2)' : 'transparent',
									color: item.enabled ? '#86efac' : 'var(--text-secondary)',
									fontSize: '11px',
									fontWeight: 700,
									cursor: 'pointer',
								}}
							>
								{item.enabled ? 'ON' : 'OFF'}
							</button>
						</div>
						<div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{item.description}</div>
					</div>
				))}

				{!!user?.settings?.drop_sets_enabled && (
					<div style={{ padding: '14px 16px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
							<div style={{ fontWeight: 600, fontSize: '13px' }}>Max Drop Sets</div>
							<div style={{ display: 'flex', gap: '6px' }}>
								{[1, 2].map((val) => {
									const active = (Number(user?.settings?.max_drop_sets) || 1) === val;
									return (
										<button
											key={val}
											onClick={() => updateTrainingSetting('max_drop_sets', val)}
											style={{
												minWidth: '42px',
												padding: '6px 10px',
												borderRadius: '8px',
												border: active ? '1px solid rgba(204,255,0,0.9)' : '1px solid var(--border)',
												background: active ? 'rgba(204,255,0,0.14)' : 'transparent',
												color: active ? 'var(--primary)' : 'var(--text-secondary)',
												fontWeight: 700,
												cursor: 'pointer',
											}}
										>
											{val}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				)}
			</div>
			)}


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

			{helpModal && (
				<div
					onClick={() => setHelpModal(null)}
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0,0,0,0.55)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1200,
						padding: '20px',
					}}
				>
					<div
						onClick={(e) => e.stopPropagation()}
						style={{
							width: '100%',
							maxWidth: '420px',
							background: 'var(--bg-secondary)',
							border: '1px solid var(--border)',
							borderRadius: '14px',
							padding: '18px',
						}}
					>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
							<h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
								{helpModal === 'training_context' ? 'Training Context' : 'Training Features'}
							</h3>
							<button
								onClick={() => setHelpModal(null)}
								className="btn btn-ghost"
								style={{ padding: '4px', borderRadius: '999px' }}
							>
								<X size={16} />
							</button>
						</div>
						{helpModal === 'training_context' ? (
							<p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
								Training Context tunes your AI-generated routines to your goals, constraints, and experience level. Update it when your priorities change so recommendations stay relevant.
							</p>
						) : (
							<div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
								<div><strong style={{ color: 'var(--text-primary)' }}>Failure Tracking:</strong> mark sets where you cannot complete another clean rep at that weight (technical failure).</div>
								<div><strong style={{ color: 'var(--text-primary)' }}>Effort Tracking:</strong> rate your session so effort trend reflects how hard training felt.</div>
								<div><strong style={{ color: 'var(--text-primary)' }}>Drop Sets:</strong> add lighter finishing sets without changing your base routine set count.</div>
								<div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.10)' }}>
									These features do <strong style={{ color: 'var(--text-primary)' }}>not</strong> give extra XP and do <strong style={{ color: 'var(--text-primary)' }}>not</strong> change the Strength Progress chart logic.
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="card mb-4 p-4" style={{ display: 'grid', gap: '10px' }}>
				<div style={{ fontWeight: 700 }}>{t('Privacy')} & {t('Terms')}</div>
				<div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
					Public launch pages for storage, AI disclosure, support, and service terms.
				</div>
				<PublicLegalLinks showSupport compact />
				<div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
					Operator: {publicSite.operatorName}
					{supportMailto ? (
						<>
							{' '}· <a href={supportMailto} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{publicSite.supportEmail}</a>
						</>
					) : (
						' · Configure VITE_PUBLIC_SUPPORT_EMAIL before the public deploy.'
					)}
				</div>
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
