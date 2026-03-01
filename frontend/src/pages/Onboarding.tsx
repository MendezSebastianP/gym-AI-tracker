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

	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState({
		weight: user?.weight || '',
		height: user?.height || '',
		age: user?.age || '',
		priorities: user?.priorities || { strength: false, hypertrophy: false, endurance: false, flexibility: false }
	});
	const [loading, setLoading] = useState(false);

	const handleChange = (e: any) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	const handlePriorityChange = (priority: string) => {
		setFormData(prev => ({
			...prev,
			priorities: {
				...prev.priorities,
				[priority]: !prev.priorities[priority]
			}
		}));
	};

	const handleSubmit = async () => {
		setLoading(true);
		try {
			const payload = {
				weight: formData.weight ? parseInt(formData.weight as string) : undefined,
				height: formData.height ? parseInt(formData.height as string) : undefined,
				age: formData.age ? parseInt(formData.age as string) : undefined,
				priorities: formData.priorities
			};

			const res = await api.put('/auth/me', payload);

			// Update local store/db
			await db.users.put(res.data);
			// Force refresh of auth store might be tricky without a method, but checkAuth() works.
			// Or manually update the user object in store if possible, or just navigate.
			// The store should update if we call checkAuth.
			const { checkAuth } = useAuthStore.getState();
			await checkAuth();

			navigate('/routines/new?onboarding=true');
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

			{step === 1 && (
				<div className="fade-in">
					<h2 className="text-xl font-semibold mb-4">{t('About You')}</h2>

					<div className="input-group">
						<label className="label">{t('Weight (kg)')}</label>
						<input
							name="weight"
							type="number"
							className="input"
							value={formData.weight}
							onChange={handleChange}
							placeholder="e.g. 75"
						/>
					</div>

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

					<button className="btn btn-primary w-full mt-6" onClick={() => setStep(2)}>
						{t('Next')}
					</button>
					<button
						className="btn btn-ghost w-full mt-2"
						onClick={() => navigate('/')}
						style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}
					>
						{t('Skip for now')}
					</button>
				</div>
			)}

			{step === 2 && (
				<div className="fade-in">
					<h2 className="text-xl font-semibold mb-4">{t('Your Goals')}</h2>
					<p className="text-secondary text-sm mb-4">{t('Select your training priorities.')}</p>

					<div className="grid grid-cols-1 gap-3">
						{['strength', 'hypertrophy', 'endurance', 'flexibility'].map(p => (
							<div
								key={p}
								className={`card p-4 cursor-pointer border ${formData.priorities[p] ? 'border-primary bg-primary-dark' : 'border-gray-700'}`}
								onClick={() => handlePriorityChange(p)}
								style={{
									backgroundColor: formData.priorities[p] ? 'rgba(76, 201, 240, 0.1)' : 'var(--bg-secondary)',
									borderColor: formData.priorities[p] ? 'var(--primary)' : 'transparent'
								}}
							>
								<div className="font-semibold capitalize">{t(p)}</div>
							</div>
						))}
					</div>

					<div className="flex gap-4 mt-8">
						<button className="btn btn-ghost flex-1" onClick={() => setStep(1)}>{t('Go Back')}</button>
						<button
							className="btn btn-primary flex-1"
							onClick={handleSubmit}
							disabled={loading}
						>
							{loading ? t('Saving...') : t('Finish')}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
