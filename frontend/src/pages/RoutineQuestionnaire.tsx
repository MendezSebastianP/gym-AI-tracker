import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';

export default function RoutineQuestionnaire() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const isOnboarding = searchParams.get('onboarding') === 'true';

	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const [prefs, setPrefs] = useState<any>({
		primary_goal: '',
		split_preference: '',
		strength_logic: '',
		cardio_preference: '',
		experience_level: '',
		available_equipment: [],
		training_days: null,
		session_duration: '',
		sleep_quality: '',
		active_job: '',
		progression_pace: '',
		has_injuries: '',
		injured_areas: [],
		other_information: ''
	});

	useEffect(() => {
		const loadPrefs = async () => {
			setLoading(true);
			try {
				const res = await api.get('/preferences');
				if (res.data) {
					setPrefs((prev: any) => ({ ...prev, ...res.data }));
				}
			} catch (e) {
				console.error("Failed to load preferences", e);
			} finally {
				setLoading(false);
			}
		};
		loadPrefs();
	}, []);

	const saveAndContinue = async (close = false) => {
		setSubmitting(true);
		try {
			await api.put('/preferences', prefs);
			if (close) {
				if (isOnboarding) {
					navigate('/routines/new?onboarding=true');
				} else {
					navigate(-1);
				}
			} else {
				// Only conditionally go to Screen 2 based on Primary Goal
				if (step === 1) {
					if (['Muscle Gain (Hypertrophy)', 'Strength Progression', 'Weight Loss / Cutting'].includes(prefs.primary_goal)) {
						setStep(2);
					} else {
						setStep(3); // Skip screen 2
					}
				} else {
					setStep(step + 1);
				}
			}
		} catch (e) {
			console.error("Failed to save preferences", e);
		} finally {
			setSubmitting(false);
		}
	};

	const fillLater = () => {
		saveAndContinue(true);
	};

	const goBack = () => {
		if (step === 3 && !['Muscle Gain (Hypertrophy)', 'Strength Progression', 'Weight Loss / Cutting'].includes(prefs.primary_goal)) {
			setStep(1);
		} else {
			setStep(step - 1);
		}
	};

	const updatePref = (key: string, value: any) => {
		setPrefs({ ...prefs, [key]: value });
	};

	const toggleArray = (key: string, value: string) => {
		const arr = prefs[key] || [];
		if (arr.includes(value)) {
			setPrefs({ ...prefs, [key]: arr.filter((x: string) => x !== value) });
		} else {
			setPrefs({ ...prefs, [key]: [...arr, value] });
		}
	};

	if (loading) return <div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>{t('Loading...')}</div>;

	const renderSelection = (key: string, options: string[]) => {
		return (
			<div className="flex flex-col gap-sm" style={{ marginTop: '16px' }}>
				{options.map(opt => (
					<button
						key={opt}
						onClick={() => updatePref(key, opt)}
						className="btn w-full"
						style={{
							padding: '16px',
							justifyContent: 'space-between',
							backgroundColor: prefs[key] === opt ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
							color: prefs[key] === opt ? 'var(--primary)' : 'var(--text-secondary)',
							border: prefs[key] === opt ? '1px solid var(--primary)' : '1px solid var(--border)',
							borderRadius: '8px',
							textAlign: 'left',
							fontWeight: 'normal'
						}}
					>
						<span>{t(opt)}</span>
						{prefs[key] === opt && <CheckCircle2 size={18} />}
					</button>
				))}
				{options.includes('Other') && prefs[key] === 'Other' && (
					<input
						type="text"
						placeholder={t('Please specify...')}
						className="input"
						style={{ marginTop: '8px' }}
						value={prefs[`${key}_other`] || ''}
						onChange={(e) => updatePref(`${key}_other`, e.target.value)}
					/>
				)}
			</div>
		);
	};

	const renderScreen = () => {
		switch (step) {
			case 1:
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your main fitness goal?')}</h2>
						<p className="text-sm text-secondary">{t('This helps us tailor your overall routine structure.')}</p>
						{renderSelection('primary_goal', [
							'Muscle Gain (Hypertrophy)',
							'Strength Progression',
							'Weight Loss / Cutting',
							'General Fitness / Endurance',
							'I don\'t know',
							'Other'
						])}
					</div>
				);
			case 2:
				if (prefs.primary_goal === 'Muscle Gain (Hypertrophy)') {
					return (
						<div className="fade-in">
							<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What kind of training split do you prefer to follow?')}</h2>
							{renderSelection('split_preference', [
								'Full Body',
								'Upper/Lower',
								'Push/Pull/Legs',
								'Body Part split',
								'I don\'t know'
							])}
						</div>
					);
				}
				if (prefs.primary_goal === 'Strength Progression') {
					return (
						<div className="fade-in">
							<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What type of strength progression logic do you prefer?')}</h2>
							{renderSelection('strength_logic', [
								'Linear Progression',
								'Percentage Based',
								'RPE Based',
								'I don\'t know'
							])}
						</div>
					);
				}
				if (prefs.primary_goal === 'Weight Loss / Cutting') {
					return (
						<div className="fade-in">
							<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('How do you prefer to lose weight?')}</h2>
							{renderSelection('cardio_preference', [
								'High-intensity cardio + lifting',
								'Steady-state cardio + lifting',
								'Purely diet-focused weightlifting'
							])}
						</div>
					);
				}
				return null;
			case 3: {
				const expVal = parseInt(prefs.experience_level) || 5;
				const expDescriptions: Record<number, string> = {
					1: t('Absolute Beginner. Needs strict guidance and very simple machines.'),
					2: t('Novice. Comfortable with simple machines and basic dumbbells.'),
					3: t('Advanced Beginner. Capable of basic free weights and pushups.'),
					4: t('Early Intermediate. Strong enough for most basic compound movements.'),
					5: t('Intermediate. Can handle core barbell lifts safely.'),
					6: t('High Intermediate. Comfortable with strict, unassisted Pull-ups and Dips.'),
					7: t('Early Advanced. Very strong. High strength requirements and balance.'),
					8: t('Advanced. Mastery of standard equipment and free weights.'),
					9: t('Elite. High skill calisthenics or powerlifting.'),
					10: t('Expert. Zero restrictions. Complete catalog access.')
				};

				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your active fitness level?')}</h2>
						<p className="text-secondary text-sm" style={{ marginBottom: '24px' }}>
							{t('Drag the slider from 1-10 to calibrate the AI to your precise strength and skills.')}
						</p>

						<div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
							<input
								type="range"
								min="1"
								max="10"
								value={expVal}
								onChange={(e) => updatePref('experience_level', e.target.value)}
								style={{ width: '100%', marginBottom: '16px', accentColor: 'var(--primary)', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', appearance: 'none' }}
							/>

							<div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px' }}>
								<span>1</span>
								<span>10</span>
							</div>

							<div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
								<h3 style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '8px' }}>Level {expVal}</h3>
								<p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>
									"{expDescriptions[expVal]}"
								</p>
							</div>
						</div>
					</div>
				);
			}
			case 4: {
				const individualEquipment = [
					'Dumbbells',
					'Barbells and Plates',
					'Power Rack / Squat Stand',
					'Bench (Flat or Adjustable)',
					'Pull-up Bar',
					'Dip Station / Rings',
					'Resistance Bands',
				];
				const allSelected = individualEquipment.every(opt => prefs.available_equipment?.includes(opt));
				const isBodyweightOnly = prefs.available_equipment?.length === 1 && prefs.available_equipment?.[0] === 'Bodyweight Only';

				const handleFullGym = () => {
					if (allSelected) {
						// Deselect all
						setPrefs({ ...prefs, available_equipment: [] });
					} else {
						// Select all individual equipment
						setPrefs({ ...prefs, available_equipment: [...individualEquipment] });
					}
				};

				const handleBodyweightOnly = () => {
					if (isBodyweightOnly) {
						setPrefs({ ...prefs, available_equipment: [] });
					} else {
						setPrefs({ ...prefs, available_equipment: ['Bodyweight Only'] });
					}
				};

				const handleToggleEquipment = (opt: string) => {
					const current = prefs.available_equipment || [];
					// Remove 'Bodyweight Only' if selecting any hardware
					const filtered = current.filter((e: string) => e !== 'Bodyweight Only');
					if (filtered.includes(opt)) {
						setPrefs({ ...prefs, available_equipment: filtered.filter((e: string) => e !== opt) });
					} else {
						setPrefs({ ...prefs, available_equipment: [...filtered, opt] });
					}
				};

				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What equipment do you have access to?')}</h2>
						<p className="text-sm text-secondary">{t('Check all that apply.')}</p>
						<div className="flex flex-col gap-sm" style={{ marginTop: '16px' }}>
							{/* Fully Equipped — Select All */}
							<button
								onClick={handleFullGym}
								className="btn w-full"
								style={{
									padding: '16px',
									justifyContent: 'space-between',
									backgroundColor: allSelected ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
									color: allSelected ? 'var(--primary)' : 'var(--text-secondary)',
									border: allSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
									borderRadius: '8px',
									textAlign: 'left',
									fontWeight: allSelected ? '600' : 'normal'
								}}
							>
								<span style={{ fontSize: '14px' }}>🏋️ {t('Fully Equipped (Select All)')}</span>
								{allSelected && <Check size={18} />}
							</button>

							{/* Individual Equipment Options */}
							{individualEquipment.map(opt => (
								<button
									key={opt}
									onClick={() => handleToggleEquipment(opt)}
									className="btn w-full"
									style={{
										padding: '16px',
										justifyContent: 'space-between',
										backgroundColor: prefs.available_equipment?.includes(opt) ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
										color: prefs.available_equipment?.includes(opt) ? 'var(--primary)' : 'var(--text-secondary)',
										border: prefs.available_equipment?.includes(opt) ? '1px solid var(--primary)' : '1px solid var(--border)',
										borderRadius: '8px',
										textAlign: 'left',
										fontWeight: 'normal'
									}}
								>
									<span style={{ fontSize: '14px' }}>{t(opt)}</span>
									{prefs.available_equipment?.includes(opt) && <Check size={18} />}
								</button>
							))}

							{/* Bodyweight Only */}
							<button
								onClick={handleBodyweightOnly}
								className="btn w-full"
								style={{
									padding: '16px',
									justifyContent: 'space-between',
									backgroundColor: isBodyweightOnly ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
									color: isBodyweightOnly ? 'var(--primary)' : 'var(--text-secondary)',
									border: isBodyweightOnly ? '1px solid var(--primary)' : '1px solid var(--border)',
									borderRadius: '8px',
									textAlign: 'left',
									fontWeight: 'normal'
								}}
							>
								<span style={{ fontSize: '14px' }}>{t('Bodyweight Only')}</span>
								{isBodyweightOnly && <Check size={18} />}
							</button>
						</div>
					</div>
				);
			}
			case 5:
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Time Commitment')}</h2>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>{t('How many days per week can you realistically train?')}</label>
							<div className="flex justify-between items-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
								<input
									type="range"
									min="1"
									max="7"
									value={prefs.training_days || 3}
									onChange={(e) => updatePref('training_days', parseInt(e.target.value))}
									className="w-full"
									style={{ accentColor: 'var(--primary)', marginRight: '16px' }}
								/>
								<span className="font-bold" style={{ fontSize: '18px', minWidth: '30px', textAlign: 'center' }}>{prefs.training_days || 3}</span>
							</div>
						</div>
						<div style={{ marginTop: '32px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>{t('What is your preferred session duration?')}</label>
							{renderSelection('session_duration', [
								'30 mins',
								'45 mins',
								'60 mins',
								'90+ mins',
								'I don\'t know'
							])}
						</div>
					</div>
				);
			case 6:
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Recovery and Lifestyle')}</h2>
						<div style={{ marginTop: '16px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>{t('How would you rate your typical sleep and recovery?')}</label>
							{renderSelection('sleep_quality', ['Poor', 'Average', 'Excellent', 'I don\'t know'])}
						</div>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>{t('Do you have a highly active job outside the gym?')}</label>
							{renderSelection('active_job', ['Yes', 'No', 'I don\'t know'])}
						</div>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>{t('How aggressively do you want to progress?')}</label>
							{renderSelection('progression_pace', ['Slow & Steady', 'Moderate', 'Aggressive', 'I don\'t know'])}
						</div>
					</div>
				);
			case 7: {
				const injuryOpts = ['Lower Back', 'Shoulders', 'Knees', 'Wrists'];
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Do you have any injuries or physical limitations?')}</h2>
						<div className="flex gap-md" style={{ marginTop: '16px' }}>
							<button className="btn" style={{
								flex: 1, backgroundColor: prefs.has_injuries === 'No' ? 'rgba(204,255,0,0.1)' : 'transparent',
								color: prefs.has_injuries === 'No' ? 'var(--primary)' : 'var(--text-secondary)',
								border: prefs.has_injuries === 'No' ? '1px solid var(--primary)' : '1px solid var(--border)',
								padding: '12px'
							}} onClick={() => updatePref('has_injuries', 'No')}>
								{t('No')}
							</button>
							<button className="btn" style={{
								flex: 1, backgroundColor: prefs.has_injuries === 'Yes' ? 'rgba(204,255,0,0.1)' : 'transparent',
								color: prefs.has_injuries === 'Yes' ? 'var(--primary)' : 'var(--text-secondary)',
								border: prefs.has_injuries === 'Yes' ? '1px solid var(--primary)' : '1px solid var(--border)',
								padding: '12px'
							}} onClick={() => updatePref('has_injuries', 'Yes')}>
								{t('Yes')}
							</button>
						</div>

						{prefs.has_injuries === 'Yes' && (
							<div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
								<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '12px' }}>{t('Which areas?')}</label>
								<div className="grid grid-cols-2 gap-sm">
									{injuryOpts.map(opt => (
										<button
											key={opt}
											onClick={() => toggleArray('injured_areas', opt)}
											style={{
												padding: '8px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer',
												backgroundColor: prefs.injured_areas?.includes(opt) ? 'var(--primary)' : 'var(--bg-tertiary)',
												color: prefs.injured_areas?.includes(opt) ? '#000' : 'var(--text-secondary)',
												fontWeight: prefs.injured_areas?.includes(opt) ? 'bold' : 'normal',
												transition: 'all 0.2s'
											}}
										>
											{t(opt)}
										</button>
									))}
								</div>
								<input
									type="text"
									placeholder={t('Other (specify)...')}
									className="input w-full"
									style={{ marginTop: '12px', fontSize: '14px', padding: '8px' }}
									value={prefs.injured_areas_other || ''}
									onChange={(e) => updatePref('injured_areas_other', e.target.value)}
								/>
							</div>
						)}
					</div>
				);
			}
			case 8:
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Any other details?')}</h2>
						<p className="text-sm text-secondary" style={{ marginBottom: '16px' }}>{t('Tell us any other information that the AI model should take into account when generating your routine.')}</p>
						<textarea
							className="input w-full"
							style={{ minHeight: '150px', padding: '12px' }}
							placeholder={t('e.g., I want to really focus on growing my calves, or I prefer using supersets to save time...')}
							value={prefs.other_information || ''}
							onChange={(e) => updatePref('other_information', e.target.value)}
						></textarea>
					</div>
				);
			case 9:
				return (
					<div className="flex flex-col items-center fade-in" style={{ padding: '48px 0', textAlign: 'center' }}>
						<CheckCircle2 size={64} style={{ color: 'var(--primary)', marginBottom: '24px' }} />
						<h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>{t('All Done!')}</h2>
						<p className="text-secondary" style={{ marginBottom: '32px' }}>{t('Your preferences have been saved. This data will be used to generate personalized routines for you in the future.')}</p>
						<button className="btn btn-primary w-full" onClick={() => saveAndContinue(true)}>
							{isOnboarding ? t('Start your first routine') : t('Return to Settings')}
						</button>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="container" style={{ paddingBottom: '80px', maxWidth: '600px' }}>
			<div className="card mb-4" style={{ padding: '0', overflow: 'hidden' }}>
				<div className="flex justify-between items-center" style={{ padding: '16px', borderBottom: step < 9 ? '1px solid var(--border)' : 'none', backgroundColor: 'var(--bg-secondary)' }}>
					{step > 1 && step < 9 ? (
						<button className="btn btn-ghost" style={{ padding: '4px' }} onClick={goBack}>
							<ArrowLeft size={20} />
						</button>
					) : <div style={{ width: 28 }}></div>}

					{step < 9 && (
						<div className="text-secondary tracking-wider" style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
							{t('Step')} {step} / 8
						</div>
					)}

					{step < 9 ? (
						<button className="btn btn-ghost" style={{ color: 'var(--primary)', padding: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }} onClick={fillLater}>
							{t('Skip')}
						</button>
					) : <div style={{ width: 44 }}></div>}
				</div>

				<div style={{ padding: '24px 16px' }}>
					{renderScreen()}
				</div>
			</div>

			{step < 9 && (
				<button
					className="btn btn-primary w-full flex justify-center items-center gap-2"
					style={{ padding: '14px', marginTop: '8px' }}
					onClick={() => saveAndContinue(false)}
					disabled={submitting}
				>
					{submitting ? t('Saving...') : step === 8 ? t('Complete') : t('Next')}
					{step < 8 && <ArrowRight size={18} />}
				</button>
			)}
		</div>
	);
}
