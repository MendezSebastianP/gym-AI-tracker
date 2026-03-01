import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import ExercisePicker from '../components/ExercisePicker';
import { Plus, Trash, Wand2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

export default function CreateRoutine() {
	const [mode, setMode] = useState<'select' | 'manual' | 'ai'>('select');
	const [name, setName] = useState('');
	const [days, setDays] = useState<any[]>([{ day_name: 'Day 1', exercises: [] }]);
	const [showPicker, setShowPicker] = useState<{ dayIndex: number } | null>(null);
	const [nameInitialized, setNameInitialized] = useState(false);

	const existingRoutines = useLiveQuery(() => db.routines.count());

	useEffect(() => {
		if (!nameInitialized && existingRoutines !== undefined) {
			if (existingRoutines === 0) {
				setName('Main Routine');
			}
			setNameInitialized(true);
		}
	}, [existingRoutines, nameInitialized]);

	// AI State
	const [aiPrompt, setAiPrompt] = useState({ days: 3, goal: 'hypertrophy', equipment: 'full_gym' });
	const [loading, setLoading] = useState(false);

	const navigate = useNavigate();
	const { t } = useTranslation();

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				delay: 100, // wait 100ms before drag starts, allows normal clicks
				tolerance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = (event: any, dayIndex: number) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const newDays = [...days];
			const exercises = newDays[dayIndex].exercises;
			const oldIndex = exercises.findIndex((ex: any) => ex._id === active.id);
			const newIndex = exercises.findIndex((ex: any) => ex._id === over.id);

			const [movedItem] = exercises.splice(oldIndex, 1);
			exercises.splice(newIndex, 0, movedItem);

			setDays(newDays);
		}
	};

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
			_id: Math.random().toString(36).substring(7),
			exercise_id: exercise.id,
			name: exercise.name, // cache name for display
			sets: 3,
			reps: '10',
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
					{/* AI Wizard Temporarily Hidden
					<button className="card" onClick={() => setMode('ai')} style={{ textAlign: 'left', cursor: 'pointer' }}>
						<h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Wand2 size={20} /> {t('AI Wizard')}
						</h3>
						<p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
							{t('Answer a few questions and let AI build a plan for you.')}
						</p>
					</button>
					*/}

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
		<div className="container fade-in" style={{ paddingBottom: '96px' }}>
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

								{day.exercises.length > 0 && (
									<div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)', padding: '0 8px', marginBottom: '4px' }}>
										<span style={{ width: '24px' }}>Move</span>
										<span style={{ flex: 1, paddingLeft: '8px' }}>Exercise</span>
										<span style={{ width: '40px', textAlign: 'center' }}>Sets</span>
										<span style={{ width: '12px', textAlign: 'center' }}></span>
										<span style={{ width: '40px', textAlign: 'center' }}>Reps</span>
										<span style={{ width: '32px', textAlign: 'center' }}></span>
									</div>
								)}

								<DndContext
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={(e) => handleDragEnd(e, dIndex)}
								>
									<SortableContext items={day.exercises.map((e: any) => e._id)} strategy={verticalListSortingStrategy}>
										{day.exercises.map((ex: any, eIndex: number) => (
											<SortableCreateExerciseRow
												key={ex._id}
												ex={ex}
												eIndex={eIndex}
												dIndex={dIndex}
												days={days}
												setDays={setDays}
											/>
										))}
									</SortableContext>
								</DndContext>

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

function SortableCreateExerciseRow({ ex, eIndex, dIndex, days, setDays }: any) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id: ex._id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '8px',
		backgroundColor: 'rgba(0,0,0,0.2)',
		borderRadius: '6px',
		gap: '8px',
		marginBottom: '4px',
		border: '1px solid transparent'
	};

	return (
		<div ref={setNodeRef} style={style}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', cursor: 'grab' }} {...attributes} {...listeners}>
				<GripVertical size={16} color="var(--text-tertiary)" />
			</div>

			<span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{ex.name}
			</span>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
				<input
					className="input p-1 text-center"
					style={{ width: '40px', fontSize: '13px' }}
					type="number"
					value={ex.sets}
					onChange={e => {
						const newDays = [...days];
						newDays[dIndex].exercises[eIndex].sets = parseInt(e.target.value) || 1;
						setDays(newDays);
					}}
				/>
				<span style={{ color: 'var(--text-tertiary)' }}>x</span>
				<input
					className="input p-1 text-center"
					style={{ width: '40px', fontSize: '13px' }}
					type="text"
					value={ex.reps || '10'}
					onChange={e => {
						const newDays = [...days];
						newDays[dIndex].exercises[eIndex].reps = e.target.value;
						setDays(newDays);
					}}
				/>
				<button
					className="btn btn-ghost p-1"
					onClick={() => {
						const newDays = [...days];
						newDays[dIndex].exercises.splice(eIndex, 1);
						setDays(newDays);
					}}
					style={{ color: 'var(--error)', flexShrink: 0, width: '32px', display: 'flex', justifyContent: 'center' }}
				>
					<Trash size={16} />
				</button>
			</div>
		</div>
	);
}
