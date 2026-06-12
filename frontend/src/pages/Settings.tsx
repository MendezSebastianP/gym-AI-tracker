import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';
import { api } from '../api/client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { User, Edit3, Save, X, Globe, LogOut, ClipboardList, HelpCircle, ChevronRight } from 'lucide-react';
import { DropSetFeatureIcon, EffortFeatureIcon, FailureFeatureIcon } from '../components/icons/TrainingFeatureIcons';
import PublicLegalLinks from '../components/PublicLegalLinks';
import { SecLabel } from '../components/kit';

export default function Settings() {
	const { t, i18n } = useTranslation();
	const { user, logout, updateUser } = useAuthStore();
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

	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate('/login', { replace: true });
	};

	const genderLabel = (g: string) => {
		if (g === 'male') return t('Male');
		if (g === 'female') return t('Female');
		if (g === 'other') return t('Other');
		if (g === 'prefer_not_to_say') return t('Prefer not to answer');
		return '-';
	};

	const profileStat = (label: string, value: string, sub?: string) => (
		<div>
			<div className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</div>
			{sub && <div style={{ fontSize: 10, color: 'var(--text-4)' }}>{sub}</div>}
			<div className="num" style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{value}</div>
		</div>
	);

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<div className="page-title">{t('Settings')}</div>
			</header>

			{message && <div className="topmark" style={{ color: 'var(--lime)' }}>{message}</div>}

			{/* ── Profile ── */}
			<div className="card flush" style={{ marginTop: 10 }}>
				<div style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
					<div className="ex-thumb" style={{ borderRadius: '50%' }}>
						<User size={19} />
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em' }}>{t('Profile')}</div>
						<div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
							{user?.email}
						</div>
					</div>
					{!editingProfile ? (
						<button className="icon-btn sm" onClick={() => setEditingProfile(true)} aria-label={t('Edit')}>
							<Edit3 size={16} />
						</button>
					) : (
						<div style={{ display: 'flex', gap: 6 }}>
							<button className="icon-btn sm" onClick={() => setEditingProfile(false)} aria-label={t('Cancel')}>
								<X size={16} />
							</button>
							<button
								className="icon-btn sm"
								onClick={saveProfile}
								disabled={saving}
								style={{ color: 'var(--lime)', borderColor: 'color-mix(in oklab, var(--lime) 35%, transparent)' }}
								aria-label={t('Save')}
							>
								<Save size={16} />
							</button>
						</div>
					)}
				</div>

				<div style={{ padding: 16 }}>
					{!editingProfile ? (
						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
							{profileStat(t('Weight'), user?.weight ? `${user.weight} kg` : '–')}
							{profileStat(t('Height'), user?.height ? `${user.height} cm` : '–')}
							{profileStat(t('Age'), user?.age ? String(user.age) : '–')}
							{profileStat(t('Gender'), user?.gender ? genderLabel(user.gender) : '–')}
						</div>
					) : (
						<>
							<div className="coach" style={{ padding: '10px 12px' }}>
								<span className="badge"><HelpCircle size={14} /></span>
								<p style={{ margin: 0 }}>{t('Weight is tracked in sessions via the Body Weight button')}</p>
							</div>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
								<div className="field">
									<label>{t('Height')}</label>
									<input
										type="number"
										value={profileData.height}
										onChange={e => setProfileData({ ...profileData, height: e.target.value })}
										placeholder="cm"
									/>
								</div>
								<div className="field">
									<label>{t('Age')}</label>
									<input
										type="number"
										value={profileData.age}
										onChange={e => setProfileData({ ...profileData, age: e.target.value })}
										placeholder="yrs"
									/>
								</div>
							</div>
							<div className="field">
								<label>{t('Gender')}</label>
								<select
									value={profileData.gender}
									onChange={e => setProfileData({ ...profileData, gender: e.target.value })}
								>
									<option value="">{t('Select...')}</option>
									<option value="male">{t('Male')}</option>
									<option value="female">{t('Female')}</option>
									<option value="other">{t('Other')}</option>
									<option value="prefer_not_to_say">{t('Prefer not to answer')}</option>
								</select>
							</div>
						</>
					)}
				</div>
			</div>

			{/* ── Preferences ── */}
			<SecLabel>{t('Preferences')}</SecLabel>

			<div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
				<Link to="/settings/questionnaire" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
					<div className="ex-thumb" style={{ width: 38, height: 38, color: 'var(--lime)', background: 'var(--green-deep)' }}>
						<ClipboardList size={18} />
					</div>
					<div style={{ minWidth: 0 }}>
						<div style={{ fontWeight: 700, fontSize: 14.5 }}>{t('Training Context')}</div>
						<div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('Customize your AI training context')}</div>
					</div>
					<ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-4)', flexShrink: 0 }} />
				</Link>
				<button className="icon-btn sm" onClick={() => setHelpModal('training_context')} aria-label={t('Help')} style={{ width: 30, height: 30 }}>
					<HelpCircle size={14} />
				</button>
			</div>

			{/* Language */}
			<div className="card">
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5 }}>
					<Globe size={16} style={{ color: 'var(--text-3)' }} />
					{t('Language')}
				</div>
				<div className="seg" style={{ display: 'flex', width: '100%', marginTop: 12 }}>
					{['en', 'es', 'fr'].map(lng => (
						<button
							key={lng}
							className={i18n.language === lng ? 'on' : ''}
							onClick={() => changeLanguage(lng)}
							disabled={lng !== 'en'}
							style={{
								flex: 1, justifyContent: 'center', flexDirection: 'column', gap: 0,
								opacity: lng === 'en' ? 1 : 0.45,
								cursor: lng === 'en' ? 'pointer' : 'not-allowed',
							}}
							title={lng !== 'en' ? 'Coming soon' : undefined}
						>
							<span>{lng === 'en' ? 'English' : lng === 'es' ? 'Español' : 'Français'}</span>
							{lng !== 'en' && <span className="mono" style={{ fontSize: 7.5, color: 'var(--text-4)' }}>{t('Soon')}</span>}
						</button>
					))}
				</div>
			</div>

			{/* ── Training features (advanced) ── */}
			<div className="sec-label">
				<span className="mono">{t('Training Features')}</span>
				<span style={{ flex: 1 }} />
				<button
					className="expand-btn"
					onClick={() => advancedUnlocked && setAdvancedOpen((v) => !v)}
					disabled={!advancedUnlocked}
					style={{ opacity: advancedUnlocked ? 1 : 0.5, padding: 0 }}
				>
					{advancedOpen ? t('Hide') : t('Show')}
				</button>
				<button className="icon-btn sm" onClick={() => setHelpModal('training_features')} aria-label={t('Help')} style={{ width: 26, height: 26, borderRadius: 8 }}>
					<HelpCircle size={13} />
				</button>
			</div>

			{!advancedUnlocked && (
				<div className="topmark" style={{ textAlign: 'left', padding: '2px 2px 8px' }}>
					{t('Unlocks after {{total}} completed sessions', { total: ADVANCED_UNLOCK_SESSIONS })} · {completedSessionsCount ?? 0}/{ADVANCED_UNLOCK_SESSIONS}
					{remainingAdvancedSessions > 0 ? ` · ${remainingAdvancedSessions} ${t('to go')}` : ''}
				</div>
			)}

			{advancedUnlocked && advancedOpen && (
				<div className="card flush">
					{[
						{
							key: 'failure_tracking_enabled',
							title: t('Failure Tracking'),
							description: t('Mark sets where you went to failure'),
							enabled: !!user?.settings?.failure_tracking_enabled,
							icon: <FailureFeatureIcon size={15} />,
						},
						{
							key: 'effort_tracking_enabled',
							title: t('Effort Tracking'),
							description: t('Rate sessions and track effort score'),
							enabled: !!user?.settings?.effort_tracking_enabled,
							icon: <EffortFeatureIcon size={15} />,
						},
						{
							key: 'drop_sets_enabled',
							title: t('Drop Sets'),
							description: t('Add reduced-weight sets after work'),
							enabled: !!user?.settings?.drop_sets_enabled,
							icon: <DropSetFeatureIcon size={15} />,
						},
					].map((item, idx, arr) => (
						<div
							key={item.key}
							style={{
								padding: '13px 15px',
								borderBottom: idx === arr.length - 1 && !user?.settings?.drop_sets_enabled ? 'none' : '1px solid var(--line)',
							}}
						>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 14 }}>
									<span
										className="coach badge"
										style={{
											width: 26, height: 26, borderRadius: 8, padding: 0,
											background: item.enabled ? 'var(--green-deep)' : 'var(--raised)',
											color: item.enabled ? 'var(--lime)' : 'var(--text-3)',
											display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
											border: '1px solid var(--line)',
										}}
									>
										{item.icon}
									</span>
									<span>{item.title}</span>
								</div>
								<button
									className={`done-pill ${item.enabled ? 'on' : ''}`}
									onClick={() => updateTrainingSetting(item.key, !item.enabled)}
									style={{ height: 30, fontSize: 11.5 }}
								>
									{item.enabled ? 'ON' : 'OFF'}
								</button>
							</div>
							<div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5, paddingLeft: 35 }}>{item.description}</div>
						</div>
					))}

					{!!user?.settings?.drop_sets_enabled && (
						<div style={{ padding: '13px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
							<div style={{ fontWeight: 700, fontSize: 13.5 }}>{t('Max Drop Sets')}</div>
							<div className="seg">
								{[1, 2].map((val) => (
									<button
										key={val}
										className={(Number(user?.settings?.max_drop_sets) || 1) === val ? 'on' : ''}
										onClick={() => updateTrainingSetting('max_drop_sets', val)}
										style={{ minWidth: 42, justifyContent: 'center' }}
									>
										{val}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* ── Legal ── */}
			<div className="card" style={{ marginTop: 16 }}>
				<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('Privacy')} & {t('Terms')}</div>
				<PublicLegalLinks showSupport compact />
			</div>

			{/* Logout */}
			<button
				onClick={handleLogout}
				className="btn-quiet"
				style={{
					width: '100%', marginTop: 24,
					color: 'var(--danger)',
					borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)',
					background: 'transparent',
				}}
			>
				<LogOut size={17} />
				{t('Logout')}
			</button>

			<div className="topmark" style={{ marginTop: 22 }}>Kairos lift · v1.0.0</div>

			{/* Help sheet */}
			{helpModal && createPortal(
				<div className="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) setHelpModal(null); }}>
					<div className="sheet">
						<div className="sheet-grab" />
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<h3 style={{ flex: 1 }}>
								{helpModal === 'training_context' ? t('Training Context') : t('Training Features')}
							</h3>
							<button onClick={() => setHelpModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }} aria-label={t('Close')}>
								<X size={18} />
							</button>
						</div>
						{helpModal === 'training_context' ? (
							<p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
								{t('Training Context tunes your AI-generated routines to your goals, constraints, and experience level. Update it when your priorities change so recommendations stay relevant.')}
							</p>
						) : (
							<div style={{ display: 'grid', gap: 10, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.55, marginTop: 10 }}>
								<div><strong style={{ color: 'var(--text)' }}>{t('Failure Tracking')}:</strong> {t('mark sets where you cannot complete another clean rep at that weight (technical failure).')}</div>
								<div><strong style={{ color: 'var(--text)' }}>{t('Effort Tracking')}:</strong> {t('rate your session so effort trend reflects how hard training felt.')}</div>
								<div><strong style={{ color: 'var(--text)' }}>{t('Drop Sets')}:</strong> {t('add lighter finishing sets without changing your base routine set count.')}</div>
								<div className="coach" style={{ marginTop: 4 }}>
									<p style={{ margin: 0 }}>
										{t('These features do not give extra XP and do not change the Strength Progress chart logic.')}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>,
				document.body
			)}
		</div>
	);
}
