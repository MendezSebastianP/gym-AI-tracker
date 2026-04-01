import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useAuthStore } from '../store/authStore';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Zap, Target, Brain, Dumbbell } from 'lucide-react';
import StarIcon from '../components/icons/StarIcon';

type ProfileField = 'age' | 'weight' | 'height' | 'gender';

interface StepDef {
	id: string;
	profileField?: ProfileField;
}

const SPLIT_OPTIONS = [
	'Full Body',
	'Upper / Lower',
	'Push / Pull / Legs',
	'Body Part Split',
	"Let AI Decide",
];

export default function TrainingContext() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const isOnboarding = searchParams.get('onboarding') === 'true';
	const { user, updateUser } = useAuthStore();

	const [contextLevel, setContextLevel] = useState<number | null>(null);
	const [stepIndex, setStepIndex] = useState(0);
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const [prefs, setPrefs] = useState<any>({
		primary_goal: '',
		split_preference: '',
		experience_level: '',
		available_equipment: [],
		training_days: null,
		session_duration: '',
		sleep_quality: '',
		active_job: '',
		progression_pace: '',
		has_injuries: '',
		injured_areas: [],
		other_information: '',
	});

	const [profileAnswers, setProfileAnswers] = useState<Record<ProfileField, any>>({
		age: null,
		weight: null,
		height: null,
		gender: null,
	});

	useEffect(() => {
		const loadPrefs = async () => {
			setLoading(true);
			try {
				const res = await api.get('/preferences');
				if (res.data) {
					setPrefs((prev: any) => ({ ...prev, ...res.data }));
					if (res.data.context_level) {
						setContextLevel(res.data.context_level);
						// If key fields are already filled, show summary instead of re-entering questions
						if (res.data.primary_goal && res.data.experience_level) {
							setShowConfirmation(true);
						}
					}
				}
			} catch (e) {
				console.error('Failed to load preferences', e);
			} finally {
				setLoading(false);
			}
		};
		loadPrefs();
	}, []);

	// Build dynamic step list based on chosen level and user profile null fields
	const steps = useMemo<StepDef[]>(() => {
		if (contextLevel === null) return [];

		const list: StepDef[] = [{ id: 'goal' }];

		if (contextLevel >= 2) list.push({ id: 'split' });

		list.push({ id: 'experience' });
		list.push({ id: 'equipment' });
		list.push({ id: 'schedule' });

		if (contextLevel >= 2) list.push({ id: 'injuries' });

		if (contextLevel === 2) {
			// Recovery combined into one screen at L2
			list.push({ id: 'recovery' });
		}

		if (contextLevel === 3) {
			// Recovery split into 3 separate screens at L3
			list.push({ id: 'sleep' });
			list.push({ id: 'active_job' });
			list.push({ id: 'progression' });
			// Profile fields — only if not already set
			if (!user?.age) list.push({ id: 'profile_age', profileField: 'age' });
			if (!user?.weight) list.push({ id: 'profile_weight', profileField: 'weight' });
			if (!user?.height) list.push({ id: 'profile_height', profileField: 'height' });
			if (!user?.gender) list.push({ id: 'profile_gender', profileField: 'gender' });
		}

		if (contextLevel >= 2) list.push({ id: 'other_info' });

		return list;
	}, [contextLevel, user]);

	const updatePref = (key: string, value: any) => {
		setPrefs((prev: any) => ({ ...prev, [key]: value }));
	};

	const updateProfile = (key: ProfileField, value: any) => {
		setProfileAnswers(prev => ({ ...prev, [key]: value }));
	};

	const toggleArray = (key: string, value: string) => {
		const arr = prefs[key] || [];
		setPrefs((prev: any) => ({
			...prev,
			[key]: arr.includes(value) ? arr.filter((x: string) => x !== value) : [...arr, value],
		}));
	};

	const savePrefs = async (finalize: boolean = false) => {
		const payload: any = { ...prefs };
		if (finalize) payload.context_level = contextLevel;
		await api.put('/preferences', payload);
	};

	const goNext = async () => {
		setSubmitting(true);
		try {
			await savePrefs(false);
			if (stepIndex < steps.length - 1) {
				setStepIndex(s => s + 1);
			} else {
				setShowConfirmation(true);
			}
		} catch (e) {
			console.error('Failed to save', e);
		} finally {
			setSubmitting(false);
		}
	};

	const goBack = () => {
		if (showConfirmation) {
			setShowConfirmation(false);
		} else if (stepIndex === 0) {
			setContextLevel(null);
		} else {
			setStepIndex(s => s - 1);
		}
	};

	const fillLater = async () => {
		setSubmitting(true);
		try {
			await savePrefs(false);
			if (isOnboarding) navigate('/routines/new?onboarding=true');
			else navigate(-1);
		} catch (e) {
			console.error('Failed to save', e);
		} finally {
			setSubmitting(false);
		}
	};

	const saveAndComplete = async () => {
		setSubmitting(true);
		try {
			await savePrefs(true);
			// Save any collected profile fields to /auth/me
			const profilePayload = Object.fromEntries(
				Object.entries(profileAnswers).filter(([, v]) => v !== null && v !== undefined && v !== '')
			);
			if (Object.keys(profilePayload).length > 0) {
				const res = await api.put('/auth/me', profilePayload);
				updateUser(res.data);
				await db.users.put(res.data);
			}
			const me = await api.get('/auth/me');
			updateUser(me.data);
			await db.users.put(me.data);

			const proceed = () => {
				if (isOnboarding) navigate('/routines/new?onboarding=true');
				else navigate(-1);
			};
			proceed();
		} catch (e) {
			console.error('Failed to complete', e);
		} finally {
			setSubmitting(false);
		}
	};

	// ─── Shared UI helpers ────────────────────────────────────────────

	const renderSelection = (key: string, options: string[]) => (
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
						fontWeight: 'normal',
					}}
				>
					<span>{t(opt)}</span>
					{prefs[key] === opt && <CheckCircle2 size={18} />}
				</button>
			))}
		</div>
	);

	// ─── Level selector ───────────────────────────────────────────────

	const renderLevelSelector = () => (
		<div className="fade-in">
			<h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Training Context')}</h2>
			<p className="text-sm text-secondary" style={{ marginBottom: '24px' }}>
				{t('Choose how much detail you want to provide. More context = better AI routines.')}
			</p>
			<div className="flex flex-col gap-sm">
				{[
					{
						level: 1,
						icon: <Zap size={20} />,
						name: t('Quick Setup'),
						count: '4',
						desc: t('Goal, experience, equipment and schedule. Ready in 2 minutes.'),
					},
					{
						level: 2,
						icon: <Target size={20} />,
						name: t('Standard'),
						count: '8–9',
						desc: t('Adds training split, injuries and lifestyle. Recommended for most users.'),
						recommended: true,
					},
					{
						level: 3,
						icon: <Brain size={20} />,
						name: t('Full Context'),
						count: t('Up to 15'),
						desc: t('Maximum detail including personal profile. Optimal AI results.'),
					},
				].map(({ level, icon, name, count, desc, recommended }) => (
					<button
						key={level}
						onClick={() => { setContextLevel(level); setStepIndex(0); setShowConfirmation(false); }}
						className="btn w-full"
						style={{
							padding: '20px 16px',
							justifyContent: 'flex-start',
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: '6px',
							backgroundColor: contextLevel === level ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
							border: contextLevel === level ? '1px solid var(--primary)' : '1px solid var(--border)',
							borderRadius: '12px',
							textAlign: 'left',
							position: 'relative',
						}}
					>
						{recommended && (
							<span style={{
								position: 'absolute', top: '10px', right: '12px',
								fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold',
								textTransform: 'uppercase', letterSpacing: '0.5px',
								display: 'flex', alignItems: 'center', gap: '2px'
							}}>
								<StarIcon size={10} style={{ color: 'var(--primary)' }} /> {t('Recommended')}
							</span>
						)}
						<div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: contextLevel === level ? 'var(--primary)' : 'var(--text-primary)', fontWeight: 'bold', fontSize: '16px' }}>
							{icon} {name}
						</div>
						<div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
							{count} {t('questions')}
						</div>
						<div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{desc}</div>
					</button>
				))}
			</div>

			{/* Start button only appears once a level is selected */}
			{contextLevel !== null && (
				<button
					className="btn btn-primary w-full flex justify-center items-center gap-2"
					style={{ padding: '14px', marginTop: '16px' }}
					onClick={() => setStepIndex(0)}
				>
					{t('Start')} <ArrowRight size={18} />
				</button>
			)}
		</div>
	);

	// ─── Step screens ─────────────────────────────────────────────────

	const renderStep = (stepDef: StepDef) => {
		switch (stepDef.id) {
			case 'goal':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your main fitness goal?')}</h2>
						<p className="text-sm text-secondary">{t('This helps us tailor your overall routine structure.')}</p>
						{renderSelection('primary_goal', [
							'Muscle Gain (Hypertrophy)',
							'Strength Progression',
							'Weight Loss / Cutting',
							'General Fitness / Endurance',
							"I don't know",
							'Other',
						])}
					</div>
				);

			case 'split':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('How do you want to structure your routine?')}</h2>
						<p className="text-sm text-secondary">{t('Choose how you prefer to split your training sessions across the week.')}</p>
						{renderSelection('split_preference', SPLIT_OPTIONS)}
					</div>
				);

			case 'experience': {
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
					10: t('Expert. Zero restrictions. Complete catalog access.'),
				};
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your active fitness level?')}</h2>
						<p className="text-secondary text-sm" style={{ marginBottom: '24px' }}>
							{t('Drag the slider from 1-10 to calibrate the AI to your precise strength and skills.')}
						</p>
						<div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
							<input
								type="range" min="1" max="10" value={expVal}
								onChange={(e) => updatePref('experience_level', e.target.value)}
								style={{ width: '100%', marginBottom: '16px', accentColor: 'var(--primary)', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', appearance: 'none' }}
							/>
							<div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '16px' }}>
								<span>1</span><span>10</span>
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

			case 'equipment': {
				const individualEquipment = [
					'Dumbbells', 'Barbells and Plates', 'Power Rack / Squat Stand',
					'Bench (Flat or Adjustable)', 'Pull-up Bar', 'Dip Station / Rings', 'Resistance Bands',
				];
				const allSelected = individualEquipment.every(opt => prefs.available_equipment?.includes(opt));
				const isBodyweightOnly = prefs.available_equipment?.length === 1 && prefs.available_equipment?.[0] === 'Bodyweight Only';

				const btnStyle = (active: boolean): React.CSSProperties => ({
					padding: '16px', justifyContent: 'space-between',
					backgroundColor: active ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
					color: active ? 'var(--primary)' : 'var(--text-secondary)',
					border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
					borderRadius: '8px', textAlign: 'left', fontWeight: 'normal',
				});

				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What equipment do you have access to?')}</h2>
						<p className="text-sm text-secondary">{t('Check all that apply.')}</p>
						<div className="flex flex-col gap-sm" style={{ marginTop: '16px' }}>
							<button onClick={() => setPrefs((p: any) => ({ ...p, available_equipment: allSelected ? [] : [...individualEquipment] }))}
								className="btn w-full" style={btnStyle(allSelected)}>
								<span style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
									<Dumbbell size={16} /> {t('Fully Equipped (Select All)')}
								</span>
								{allSelected && <Check size={18} />}
							</button>
							{individualEquipment.map(opt => {
								const active = prefs.available_equipment?.includes(opt);
								return (
									<button key={opt} onClick={() => {
										const current = (prefs.available_equipment || []).filter((e: string) => e !== 'Bodyweight Only');
										setPrefs((p: any) => ({
											...p,
											available_equipment: current.includes(opt)
												? current.filter((e: string) => e !== opt)
												: [...current, opt],
										}));
									}} className="btn w-full" style={btnStyle(active)}>
										<span style={{ fontSize: '14px' }}>{t(opt)}</span>
										{active && <Check size={18} />}
									</button>
								);
							})}
							<button onClick={() => setPrefs((p: any) => ({ ...p, available_equipment: isBodyweightOnly ? [] : ['Bodyweight Only'] }))}
								className="btn w-full" style={btnStyle(isBodyweightOnly)}>
								<span style={{ fontSize: '14px' }}>{t('Bodyweight Only')}</span>
								{isBodyweightOnly && <Check size={18} />}
							</button>
						</div>
					</div>
				);
			}

			case 'schedule':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Time Commitment')}</h2>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>
								{t('How many days per week can you realistically train?')}
							</label>
							<div className="flex justify-between items-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
								<input type="range" min="1" max="7" value={prefs.training_days || 3}
									onChange={(e) => updatePref('training_days', parseInt(e.target.value))}
									className="w-full" style={{ accentColor: 'var(--primary)', marginRight: '16px' }}
								/>
								<span className="font-bold" style={{ fontSize: '18px', minWidth: '30px', textAlign: 'center' }}>
									{prefs.training_days || 3}
								</span>
							</div>
						</div>
						<div style={{ marginTop: '32px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>
								{t('What is your preferred session duration?')}
							</label>
							{renderSelection('session_duration', ["30 mins", "45 mins", "60 mins", "90+ mins", "I don't know"])}
						</div>
					</div>
				);

			case 'injuries': {
				const injuryOpts = ['Lower Back', 'Shoulders', 'Knees', 'Wrists'];
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Any injuries or limitations?')}</h2>
						<div className="flex gap-md" style={{ marginTop: '16px' }}>
							{['No', 'Yes'].map(v => (
								<button key={v} className="btn" style={{
									flex: 1,
									backgroundColor: prefs.has_injuries === v ? 'rgba(204,255,0,0.1)' : 'transparent',
									color: prefs.has_injuries === v ? 'var(--primary)' : 'var(--text-secondary)',
									border: prefs.has_injuries === v ? '1px solid var(--primary)' : '1px solid var(--border)',
									padding: '12px',
								}} onClick={() => updatePref('has_injuries', v)}>
									{t(v)}
								</button>
							))}
						</div>
						{prefs.has_injuries === 'Yes' && (
							<div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
								<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '12px' }}>{t('Which areas?')}</label>
								<div className="grid grid-cols-2 gap-sm">
									{injuryOpts.map(opt => (
										<button key={opt} onClick={() => toggleArray('injured_areas', opt)}
											style={{
												padding: '8px', fontSize: '14px', borderRadius: '4px', border: 'none', cursor: 'pointer',
												backgroundColor: prefs.injured_areas?.includes(opt) ? 'var(--primary)' : 'var(--bg-tertiary)',
												color: prefs.injured_areas?.includes(opt) ? '#000' : 'var(--text-secondary)',
												fontWeight: prefs.injured_areas?.includes(opt) ? 'bold' : 'normal',
											}}>
											{t(opt)}
										</button>
									))}
								</div>
								<input type="text" placeholder={t('Other (specify)...')} className="input w-full"
									style={{ marginTop: '12px', fontSize: '14px', padding: '8px' }}
									value={prefs.injured_areas_other || ''}
									onChange={(e) => updatePref('injured_areas_other', e.target.value)}
								/>
							</div>
						)}
					</div>
				);
			}

			case 'recovery':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Recovery and Lifestyle')}</h2>
						<div style={{ marginTop: '16px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>
								{t('How would you rate your sleep and recovery?')}
							</label>
							{renderSelection('sleep_quality', ['Poor', 'Average', 'Excellent', "I don't know"])}
						</div>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>
								{t('Do you have a highly active job outside the gym?')}
							</label>
							{renderSelection('active_job', ['Yes', 'No', "I don't know"])}
						</div>
						<div style={{ marginTop: '24px' }}>
							<label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '8px' }}>
								{t('How aggressively do you want to progress?')}
							</label>
							{renderSelection('progression_pace', ['Slow & Steady', 'Moderate', 'Aggressive', "I don't know"])}
						</div>
					</div>
				);

			case 'sleep':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Sleep and Recovery')}</h2>
						<p className="text-sm text-secondary">{t('Recovery quality directly affects training adaptation.')}</p>
						<div style={{ marginTop: '16px' }}>
							{renderSelection('sleep_quality', ['Poor', 'Average', 'Excellent', "I don't know"])}
						</div>
					</div>
				);

			case 'active_job':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Activity Outside the Gym')}</h2>
						<p className="text-sm text-secondary">{t('A physically demanding job adds to your weekly fatigue load.')}</p>
						<div style={{ marginTop: '16px' }}>
							{renderSelection('active_job', ['Yes', 'No', "I don't know"])}
						</div>
					</div>
				);

			case 'progression':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Progression Pace')}</h2>
						<p className="text-sm text-secondary">{t('How aggressively do you want to increase load and volume over time?')}</p>
						<div style={{ marginTop: '16px' }}>
							{renderSelection('progression_pace', ['Slow & Steady', 'Moderate', 'Aggressive', "I don't know"])}
						</div>
					</div>
				);

			case 'profile_age':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('How old are you?')}</h2>
						<p className="text-sm text-secondary">{t('Age affects recovery time and optimal training volume.')}</p>
						<input
							type="number" className="input w-full"
							style={{ marginTop: '16px', fontSize: '20px', padding: '16px', textAlign: 'center' }}
							placeholder="e.g. 28" min={13} max={100}
							value={profileAnswers.age ?? ''}
							onChange={(e) => updateProfile('age', parseInt(e.target.value) || null)}
						/>
					</div>
				);

			case 'profile_weight':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your body weight? (kg)')}</h2>
						<p className="text-sm text-secondary">{t('Used to calibrate bodyweight exercise difficulty and load suggestions.')}</p>
						<input
							type="number" className="input w-full"
							style={{ marginTop: '16px', fontSize: '20px', padding: '16px', textAlign: 'center' }}
							placeholder="e.g. 80" min={30} max={300}
							value={profileAnswers.weight ?? ''}
							onChange={(e) => updateProfile('weight', parseInt(e.target.value) || null)}
						/>
					</div>
				);

			case 'profile_height':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('What is your height? (cm)')}</h2>
						<p className="text-sm text-secondary">{t('Helps contextualize proportions and mobility considerations.')}</p>
						<input
							type="number" className="input w-full"
							style={{ marginTop: '16px', fontSize: '20px', padding: '16px', textAlign: 'center' }}
							placeholder="e.g. 175" min={100} max={250}
							value={profileAnswers.height ?? ''}
							onChange={(e) => updateProfile('height', parseInt(e.target.value) || null)}
						/>
					</div>
				);

			case 'profile_gender':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('How do you identify?')}</h2>
						<p className="text-sm text-secondary">{t('Helps calibrate strength standards and recovery considerations.')}</p>
						<div className="flex flex-col gap-sm" style={{ marginTop: '16px' }}>
							{[
								['male', t('Male')],
								['female', t('Female')],
								['other', t('Other / Prefer not to say')],
							].map(([val, label]) => (
								<button key={val} onClick={() => updateProfile('gender', val)} className="btn w-full"
									style={{
										padding: '16px', justifyContent: 'space-between',
										backgroundColor: profileAnswers.gender === val ? 'rgba(204,255,0,0.1)' : 'var(--bg-tertiary)',
										color: profileAnswers.gender === val ? 'var(--primary)' : 'var(--text-secondary)',
										border: profileAnswers.gender === val ? '1px solid var(--primary)' : '1px solid var(--border)',
										borderRadius: '8px', textAlign: 'left', fontWeight: 'normal',
									}}>
									<span>{label}</span>
									{profileAnswers.gender === val && <CheckCircle2 size={18} />}
								</button>
							))}
						</div>
					</div>
				);

			case 'other_info':
				return (
					<div className="fade-in">
						<h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{t('Any other details?')}</h2>
						<p className="text-sm text-secondary" style={{ marginBottom: '16px' }}>
							{t('Tell the AI anything else that should inform your routine — focus areas, supersets, schedule constraints, etc.')}
						</p>
						<textarea
							className="input w-full"
							style={{ minHeight: '150px', padding: '12px' }}
							placeholder={t("e.g., I want to really focus on growing my calves, or I prefer using supersets to save time...")}
							value={prefs.other_information || ''}
							onChange={(e) => updatePref('other_information', e.target.value)}
						/>
					</div>
				);

			default:
				return null;
		}
	};

	const renderConfirmation = () => (
		<div className="flex flex-col items-center fade-in" style={{ padding: '48px 0', textAlign: 'center' }}>
			<CheckCircle2 size={64} style={{ color: 'var(--primary)', marginBottom: '24px' }} />
			<h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>{t('All Done!')}</h2>
			<p className="text-secondary" style={{ marginBottom: '32px' }}>
				{t('Your training context has been saved. The AI will use this to generate personalized routines.')}
			</p>
			<button className="btn btn-primary w-full" onClick={saveAndComplete} disabled={submitting}>
				{submitting ? t('Saving...') : isOnboarding ? t('Start your first routine') : t('Return to Settings')}
			</button>
			<button
				className="btn btn-secondary w-full"
				style={{ marginTop: '12px' }}
				onClick={() => { setShowConfirmation(false); setStepIndex(0); }}
			>
				{t('Edit Answers')}
			</button>
		</div>
	);

	if (loading) return (
		<div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>{t('Loading...')}</div>
	);

	const isLevelSelector = contextLevel === null;
	const currentStep = steps[stepIndex];
	const isLastStep = stepIndex === steps.length - 1;

	return (
		<div className="container" style={{ paddingBottom: '80px', maxWidth: '600px' }}>
			<div className="card mb-4" style={{ padding: '0', overflow: 'hidden' }}>
				{/* Header */}
				<div className="flex justify-between items-center" style={{
					padding: '16px',
					borderBottom: showConfirmation ? 'none' : '1px solid var(--border)',
					backgroundColor: 'var(--bg-secondary)',
				}}>
					{/* Left: back button */}
					{!showConfirmation ? (
						<button className="btn btn-ghost" style={{ padding: '4px' }}
							onClick={isLevelSelector ? () => navigate(-1) : goBack}>
							<ArrowLeft size={20} />
						</button>
					) : (
						<div style={{ width: 28 }} />
					)}

					{/* Center: step counter or title */}
					{!isLevelSelector && !showConfirmation && steps.length > 0 ? (
						<div className="text-secondary tracking-wider" style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
							{t('Step')} {stepIndex + 1} / {steps.length}
						</div>
					) : (
						<div className="text-secondary" style={{ fontSize: '13px', fontWeight: 'bold' }}>
							{t('Training Context')}
						</div>
					)}

					{/* Right: skip */}
					{!isLevelSelector && !showConfirmation ? (
						<button
							className="btn btn-ghost"
							style={{ color: 'var(--primary)', padding: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
							onClick={fillLater}
						>
							{t('Skip')}
						</button>
					) : (
						<div style={{ width: 44 }} />
					)}
				</div>

				<div style={{ padding: '24px 16px' }}>
					{isLevelSelector && renderLevelSelector()}
					{!isLevelSelector && !showConfirmation && currentStep && renderStep(currentStep)}
					{showConfirmation && renderConfirmation()}
				</div>
			</div>

			{/* Next / Complete button — shown only during question steps */}
			{!isLevelSelector && !showConfirmation && (
				<button
					className="btn btn-primary w-full flex justify-center items-center gap-2"
					style={{ padding: '14px', marginTop: '8px' }}
					onClick={goNext}
					disabled={submitting}
				>
					{submitting ? t('Saving...') : isLastStep ? t('Complete') : t('Next')}
					{!isLastStep && <ArrowRight size={18} />}
				</button>
			)}
		</div>
	);
}
