import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { db } from '../db/schema';
import ExercisePicker from '../components/ExercisePicker';
import { Plus, Trash, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CreateRoutine() {
	const [mode, setMode] = useState<'select' | 'manual' | 'ai'>('select');
	const [name, setName] = useState('');
	const [days, setDays] = useState<any[]>([{ day_name: 'Day 1', exercises: [] }]);
	const [showPicker, setShowPicker] = useState<{ dayIndex: number } | null>(null);

	// AI State
	const [aiPrompt, setAiPrompt] = useState({ days: 3, goal: 'hypertrophy', equipment: 'full_gym' });
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();
	const { t } = useTranslation();

	const handleSave = async () => {
		if (!name) return alert('Name is required');

		const routineData = { name, days };

		try {
			if (navigator.onLine) {
				const res = await api.post('/routines', routineData);
				// Sync back to local DB? usually happen via sync logic, but we can optimistically add
				await db.routines.put({ ...res.data, syncStatus: 'synced' });
			} else {
				// Offline save
				const id = await db.routines.add({ ...routineData, user_id: 0, syncStatus: 'created' } as any);
				// Add to sync queue
				await db.syncQueue.add({
					event_type: 'create_routine',
					payload: routineData,
					client_timestamp: new Date().toISOString(),
					processed: false
				});
			}
			navigate('/routines');
		} catch (e) {
			alert('Error creating routine');
		}
	};

	const generateAI = async () => {
		setLoading(true);
		// Placeholder AI call
		setTimeout(() => {
			setName("AI Generated Split");
			setDays([
				{ day_name: "Push", exercises: [] },
				{ day_name: "Pull", exercises: [] },
				{ day_name: "Legs", exercises: [] }
			]);
			setMode('manual');
			setLoading(false);
		}, 1500);
	};

	const addExercise = (dayIndex: number, exercise: any) => {
		const newDays = [...days];
		newDays[dayIndex].exercises.push({
			exercise_id: exercise.id,
			name: exercise.name, // cache name for display
			sets: 3,
			reps: '8-12',
			rest: 60
		});
		setDays(newDays);
		setShowPicker(null);
	};

	// Check for onboarding param
	const query = new URLSearchParams(window.location.search);
	const isOnboarding = query.get('onboarding') === 'true';

	const handleSkip = () => {
		navigate('/');
	};

	if (mode === 'select') {
		return (
			<div className="container fade-in">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h1>{t('Create Routine')}</h1>
					{isOnboarding && (
						<button className="btn btn-ghost" onClick={handleSkip}>
							{t('Skip')}
						</button>
					)}
				</div>
				<div style={{ display: 'grid', gap: '16px', marginTop: '32px' }}>
					<button className="card" onClick={() => setMode('ai')} style={{ textAlign: 'left', cursor: 'pointer' }}>
						<h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Wand2 size={20} /> {t('AI Wizard')}
						</h3>
						<p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
							{t('Answer a few questions and let AI build a plan for you.')}
						</p>
					</button>

					<button className="card" onClick={() => setMode('manual')} style={{ textAlign: 'left', cursor: 'pointer' }}>
						<h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Plus size={20} /> {t('Manual Builder')}
						</h3>
						<p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
							{t('Build your routine from scratch, exercise by exercise.')}
						</p>
					</button>
				</div>
			</div>
		);
	}

	if (loading) return <div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>Generating...</div>;

	return (
		<div className="container fade-in">
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<h1>{mode === 'ai' ? t('AI Setup') : t('New Routine')}</h1>
				<button className="btn btn-ghost" onClick={() => setMode('select')}>{t('Cancel')}</button>
			</div>

			{mode === 'ai' ? (
				<div className="card">
					<div className="input-group">
						<label className="label">Days per week</label>
						<input type="number" className="input" value={aiPrompt.days} onChange={e => setAiPrompt({ ...aiPrompt, days: parseInt(e.target.value) })} />
					</div>
					<button className="btn btn-primary" style={{ width: '100%' }} onClick={generateAI}>Generate</button>
				</div>
			) : (
				<>
					<div className="input-group">
						<label className="label">Routine Name</label>
						<input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PPL Split" />
					</div>

					<div style={{ flex: 1, overflowY: 'auto' }}>
						{days.map((day, dIndex) => (
							<div key={dIndex} className="card">
								<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
									<input
										className="input"
										value={day.day_name}
										onChange={(e) => {
											const newDays = [...days];
											newDays[dIndex].day_name = e.target.value;
											setDays(newDays);
										}}
										style={{ fontWeight: 'bold', background: 'transparent', padding: '4px', border: 'none' }}
									/>
									<button className="btn btn-ghost" onClick={() => {
										const newDays = [...days];
										newDays.splice(dIndex, 1);
										setDays(newDays);
									}}><Trash size={16} /></button>
								</div>

								{day.exercises.map((ex: any, eIndex: number) => (
									<div key={eIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
										<span>{ex.name}</span>
										<span style={{ color: 'var(--text-tertiary)' }}>{ex.sets} x {ex.reps}</span>
									</div>
								))}

								<button
									className="btn btn-secondary"
									style={{ width: '100%', marginTop: '8px', fontSize: '14px', padding: '8px' }}
									onClick={() => setShowPicker({ dayIndex: dIndex })}
								>
									<Plus size={16} style={{ marginRight: '4px' }} /> Add Exercise
								</button>
							</div>
						))}

						<button className="btn btn-ghost" onClick={() => setDays([...days, { day_name: `Day ${days.length + 1}`, exercises: [] }])}>
							+ Add Day
						</button>
					</div>

					<button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleSave}>
						Save Routine
					</button>
				</>
			)}

			{showPicker && (
				<ExercisePicker
					onSelect={(ex) => addExercise(showPicker.dayIndex, ex)}
					onClose={() => setShowPicker(null)}
				/>
			)}
		</div>
	);
}
