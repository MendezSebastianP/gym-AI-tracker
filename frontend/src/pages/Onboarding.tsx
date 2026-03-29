import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/schema';

export default function Onboarding() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { user } = useAuthStore();

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
			const { checkAuth } = useAuthStore.getState();
			await checkAuth();

			navigate('/settings/questionnaire?onboarding=true');
		} catch (e) {
			console.error("Onboarding failed", e);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="container fade-in" style={{ justifyContent: 'center' }}>
			<h1 className="text-2xl font-bold mb-2">{t('Welcome to Gym AI')}</h1>
			<p className="text-secondary mb-8">{t("Let's customize your experience.")}</p>

			<div className="fade-in">
				<h2 className="text-xl font-semibold mb-4">{t('About You')}</h2>

				<div className="input-group">
					<label className="label">{t('Height (cm)')}</label>
					<input
						name="height"
						type="number"
						className="input"
						value={formData.height}
						onChange={handleChange}
						placeholder="e.g. 180"
					/>
				</div>

				<div className="input-group">
					<label className="label">{t('Age')}</label>
					<input
						name="age"
						type="number"
						className="input"
						value={formData.age}
						onChange={handleChange}
						placeholder="e.g. 25"
					/>
				</div>

				<div className="input-group flex flex-col mb-4">
					<label className="label">{t('Gender')}</label>
					<select
						name="gender"
						className="input"
						value={formData.gender || ''}
						onChange={handleChange}
						style={{ appearance: 'none' }}
					>
						<option value="">{t('Select Gender')}</option>
						<option value="male">{t('Male')}</option>
						<option value="female">{t('Female')}</option>
						<option value="other">{t('Other')}</option>
						<option value="prefer_not_to_say">{t('Prefer not to answer')}</option>
					</select>
				</div>

				<button
					className="btn btn-primary w-full mt-6"
					onClick={handleSubmit}
					disabled={loading}
				>
					{loading ? t('Saving...') : t('Continue')}
				</button>
				<button
					className="btn btn-ghost w-full mt-2"
					onClick={() => navigate('/')}
					style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}
				>
					{t('Skip for now')}
				</button>
			</div>
		</div>
	);
}
