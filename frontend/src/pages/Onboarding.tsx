import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';
import KairosLogo from '../components/KairosLogo';

export default function Onboarding() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { user, updateUser } = useAuthStore();

	const [formData, setFormData] = useState({
		height: user?.height || '',
		age: user?.age || '',
		gender: user?.gender || '',
	});
	const [loading, setLoading] = useState(false);

	const handleChange = (e: any) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async () => {
		setLoading(true);
		try {
			const payload: any = {};
			if (formData.height) payload.height = parseInt(formData.height as string);
			if (formData.age) payload.age = parseInt(formData.age as string);
			if (formData.gender) payload.gender = formData.gender;
			payload.onboarding_progress = { profile: true };

			const res = await api.put('/auth/me', payload);

			await db.users.put(res.data);
			updateUser(res.data);

			navigate('/settings/questionnaire?onboarding=true');
		} catch (e) {
			console.error("Onboarding failed", e);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container" style={{ justifyContent: 'center', maxWidth: 440 }}>
			<div style={{ marginBottom: 22 }}>
				<KairosLogo size="md" showTagline />
			</div>

			<div className="page-title" style={{ fontSize: 32, flex: 'none' }}>{t('Welcome')}</div>
			<p style={{ margin: '12px 0 4px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-2)', maxWidth: '34ch' }}>
				{t("Let's customize your experience.")}
			</p>

			<div className="field">
				<label>{t('Height (cm)')}</label>
				<input
					name="height"
					type="number"
					value={formData.height}
					onChange={handleChange}
					placeholder="e.g. 180"
				/>
			</div>

			<div className="field">
				<label>{t('Age')}</label>
				<input
					name="age"
					type="number"
					value={formData.age}
					onChange={handleChange}
					placeholder="e.g. 25"
				/>
			</div>

			<div className="field">
				<label>{t('Gender')}</label>
				<select
					name="gender"
					value={formData.gender || ''}
					onChange={handleChange}
				>
					<option value="">{t('Select Gender')}</option>
					<option value="male">{t('Male')}</option>
					<option value="female">{t('Female')}</option>
					<option value="other">{t('Other')}</option>
					<option value="prefer_not_to_say">{t('Prefer not to answer')}</option>
				</select>
			</div>

			<button
				className="btn-primary"
				style={{ width: '100%', marginTop: 26 }}
				onClick={handleSubmit}
				disabled={loading}
			>
				{loading ? t('Saving...') : t('Continue')}
			</button>
			<button
				className="link-quiet"
				style={{ display: 'block', margin: '14px auto 0' }}
				onClick={() => navigate('/')}
			>
				{t('Skip for now')}
			</button>
		</div>
	);
}
