import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Play, ArrowLeft, Edit, Save, X, Lock, Unlock, Plus, Trash2, HelpCircle, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useState } from 'react';
import ExercisePicker from '../components/ExercisePicker';

export default function RoutineDetails() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();

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

	const [editMode, setEditMode] = useState(false);
	const [editedDays, setEditedDays] = useState<any[] | null>(null);
	const [saving, setSaving] = useState(false);
	const [showPicker, setShowPicker] = useState<{ dayIndex: number } | null>(null);
	const [showLockHelp, setShowLockHelp] = useState(false);
	const [editedDescription, setEditedDescription] = useState<string>('');

	const routine = useLiveQuery(async () => {
		if (!id) return null;
		return await db.routines.get(parseInt(id));
	}, [id]);

	// Fetch all exercises to map IDs to translated names
	const exercisesMap = useLiveQuery(async () => {
		const all = await db.exercises.toArray();
		const map = new Map();
		const currentLang = i18n.language.split('-')[0];
		all.forEach(ex => {
			map.set(ex.id, (ex as any).name_translations?.[currentLang] || ex.name);
		});
		return map;
	}, [i18n.language]);

	const getExerciseName = (ex: any) => {
		if (exercisesMap && ex.exercise_id && exercisesMap.has(ex.exercise_id)) {
			return exercisesMap.get(ex.exercise_id);
		}
		return ex.name;
	};

	const days = editMode && editedDays ? editedDays : routine?.days || [];

	const startEdit = () => {
		const newDays = JSON.parse(JSON.stringify(routine?.days || []));
		// Ensure unique IDs for DndKit
		newDays.forEach((day: any) => {
			day.exercises.forEach((ex: any) => {
				if (!ex._id) ex._id = Math.random().toString(36).substring(7);
			});
		});
		setEditedDays(newDays);
		setEditedDescription(routine?.description || '');
		setEditMode(true);
	};

	const cancelEdit = () => {
		setEditedDays(null);
		setEditMode(false);
	};

	const saveEdit = async () => {
		if (!routine || !editedDays) return;
		setSaving(true);
		try {
			// clean up _id
			const cleanDays = JSON.parse(JSON.stringify(editedDays));
			cleanDays.forEach((day: any) => {
				day.exercises.forEach((ex: any) => {
					delete ex._id;
				});
			});

			const updatePayload: any = { days: cleanDays, description: editedDescription || null };
			if (navigator.onLine) {
				await api.put(`/routines/${routine.id}`, updatePayload);
			}
			await db.routines.update(routine.id, { ...updatePayload, syncStatus: 'updated' });
			setEditMode(false);
			setEditedDays(null);
		} catch (e) {
			console.error("Failed to save routine", e);
			alert("Error saving routine changes");
		} finally {
			setSaving(false);
		}
	};

	const updateExerciseField = (dayIndex: number, exIndex: number, field: string, value: any) => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		newDays[dayIndex].exercises[exIndex][field] = value;
		setEditedDays(newDays);
	};

	const toggleExerciseLock = (dayIndex: number, exIndex: number) => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		newDays[dayIndex].exercises[exIndex].locked = !newDays[dayIndex].exercises[exIndex].locked;
		setEditedDays(newDays);
	};

	const removeExercise = (dayIndex: number, exIndex: number) => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		newDays[dayIndex].exercises.splice(exIndex, 1);
		setEditedDays(newDays);
	};

	const handleDragEnd = (event: any, dayIndex: number) => {
		const { active, over } = event;
		if (over && active.id !== over.id && editedDays) {
			const newDays = JSON.parse(JSON.stringify(editedDays));
			const exercises = newDays[dayIndex].exercises;
			const oldIndex = exercises.findIndex((ex: any) => ex._id === active.id);
			const newIndex = exercises.findIndex((ex: any) => ex._id === over.id);

			const [movedItem] = exercises.splice(oldIndex, 1);
			exercises.splice(newIndex, 0, movedItem);

			setEditedDays(newDays);
		}
	};

	const addExerciseToDay = (dayIndex: number, exercise: any) => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		newDays[dayIndex].exercises.push({
			_id: Math.random().toString(36).substring(7),
			exercise_id: exercise.id,
			name: exercise.name, // Store canonical name
			sets: 3,
			reps: '10',
			rest: 60,
			weight_kg: 0,
			locked: false
		});
		setEditedDays(newDays);
		setShowPicker(null);
	};

	const startSession = async (dayIndex: number) => {
		if (!routine) return;

		try {
			const sessionId = await db.sessions.add({
				user_id: 1, // replace with real user ID if needed
				routine_id: routine.id,
				day_index: dayIndex,
				started_at: new Date().toISOString(),
				syncStatus: 'created'
			});
			navigate(`/sessions/${sessionId}`);
		} catch (e) {
			console.error("Failed to start session", e);
			alert("Error starting session");
		}
	};

	if (!routine) return <div className="container">{t('Loading...')}</div>;

	return (
		<div className="container fade-in" style={{ paddingBottom: '80px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
				<div style={{ display: 'flex', alignItems: 'center' }}>
					<button className="btn btn-ghost" onClick={() => navigate('/routines')} style={{ paddingLeft: 0 }}>
						<ArrowLeft size={24} />
					</button>
					<h1 style={{ marginBottom: 0 }}>{routine.name}</h1>
				</div>
				{!editMode ? (
					<button className="btn btn-secondary" onClick={startEdit} style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Edit size={16} /> {t('Edit')}
					</button>
				) : (
					<div style={{ display: 'flex', gap: '8px' }}>
						<button className="btn btn-ghost" onClick={cancelEdit} style={{ padding: '8px', fontSize: '14px' }}>
							<X size={16} />
						</button>
						<button className="btn btn-primary" onClick={saveEdit} disabled={saving} style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
							<Save size={16} /> {saving ? 'Saving...' : t('Save')}
						</button>
					</div>
				)}
			</div>

			{editMode ? (
				<div style={{ marginBottom: '16px' }}>
					<textarea
						className="input"
						value={editedDescription}
						onChange={(e) => setEditedDescription(e.target.value)}
						placeholder={t('Add a description...')}
						style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontSize: '14px' }}
					/>
				</div>
			) : (
				<div style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
					{routine.description || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('No description')}</span>}
				</div>
			)}

			<h3 style={{ marginBottom: '16px', color: 'var(--primary)', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
				{t('Program Days')}
			</h3>

			<div style={{ display: 'grid', gap: '16px' }}>
				{days.map((day: any, dIndex: number) => (
					<div key={dIndex} className="card" style={{ marginBottom: 0 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
							<h3 style={{ margin: 0 }}>{day.day_name}</h3>
							{!editMode && (
								<button
									className="btn btn-primary"
									style={{ padding: '8px 16px', fontSize: '14px' }}
									onClick={() => startSession(dIndex)}
								>
									<Play size={16} fill="black" style={{ marginRight: '6px' }} /> {t('Start Workout')}
								</button>
							)}
						</div>

						<div style={{ display: 'grid', gap: '8px' }}>
							{editMode ? (
								<>
									{/* Header */}
									<div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)', padding: '0 8px', gap: '8px' }}>
										<span style={{ width: '24px' }}>{t('Move')}</span>
										<span style={{ flex: 1 }}>{t('Exercise')}</span>
										<span style={{ width: '55px', textAlign: 'center' }}>{t('Sets')}</span>
										<span style={{ width: '65px', textAlign: 'center' }}>{t('Reps')}</span>
										<span style={{ width: '65px', textAlign: 'center' }}>KG</span>
										<span style={{ width: '60px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
											{t('Lock')}
											<HelpCircle
												size={12}
												style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}
												onClick={() => setShowLockHelp(!showLockHelp)}
											/>
										</span>
										<span style={{ width: '60px', textAlign: 'center' }}>{t('Actions')}</span>
									</div>

									{/* Lock help tooltip */}
									{showLockHelp && (
										<div style={{
											background: 'var(--bg-tertiary)',
											padding: '8px 12px',
											borderRadius: '6px',
											fontSize: '12px',
											color: 'var(--text-secondary)',
											border: '1px solid rgba(99, 102, 241, 0.3)',
											marginBottom: '4px'
										}}>
											{t('When locked, sets/reps will always be pre-filled exactly from this plan. Unlocked exercises will dynamically pre-fill based on your latest workout.')}
										</div>
									)}

									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragEnd={(e) => handleDragEnd(e, dIndex)}
									>
										<SortableContext items={day.exercises.map((e: any) => e._id)} strategy={verticalListSortingStrategy}>
											{day.exercises.map((ex: any, eIndex: number) => (
												<SortableExerciseRow
													key={ex._id}
													ex={ex}
													eIndex={eIndex}
													dIndex={dIndex}
													getExerciseName={getExerciseName}
													updateExerciseField={updateExerciseField}
													toggleExerciseLock={toggleExerciseLock}
													removeExercise={removeExercise}
												/>
											))}
										</SortableContext>
									</DndContext>


									<button
										className="btn btn-secondary"
										style={{ width: '100%', marginTop: '4px', fontSize: '13px', padding: '8px' }}
										onClick={() => setShowPicker({ dayIndex: dIndex })}
									>
										<Plus size={14} style={{ marginRight: '4px' }} /> {t('Add Exercise')}
									</button>
								</>
							) : (
								// Read-only view
								day.exercises.map((ex: any, i: number) => (
									<div key={i} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
										<span style={{ width: '24px', color: 'var(--text-tertiary)' }}>{i + 1}</span>
										<span style={{ flex: 1, color: 'var(--text-primary)' }}>{getExerciseName(ex)}</span>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											{ex.locked && (
												<Lock size={12} style={{ color: 'var(--accent, #6366f1)' }} />
											)}
											<span>{ex.sets} x {ex.reps}</span>
											{(ex.weight_kg > 0) && (
												<span style={{ color: 'var(--accent, #6366f1)', fontSize: '12px' }}>
													{ex.weight_kg}kg
												</span>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</div>
				))}
			</div>

			{
				showPicker && (
					<ExercisePicker
						onSelect={(ex) => addExerciseToDay(showPicker.dayIndex, ex)}
						onClose={() => setShowPicker(null)}
					/>
				)
			}
		</div >
	);
}

function SortableExerciseRow({ ex, eIndex, dIndex, getExerciseName, updateExerciseField, toggleExerciseLock, removeExercise }: any) {
	const { t } = useTranslation();
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
		alignItems: 'center',
		padding: '8px',
		backgroundColor: ex.locked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0,0,0,0.2)',
		borderRadius: '6px',
		gap: '8px',
		border: ex.locked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
		marginBottom: '4px'
	};

	return (
		<div ref={setNodeRef} style={style}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', cursor: 'grab' }} {...attributes} {...listeners}>
				<GripVertical size={16} color="var(--text-tertiary)" />
			</div>
			<span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{getExerciseName(ex)}
			</span>
			<input
				type="number"
				className="input"
				value={ex.sets || 3}
				onChange={(e) => updateExerciseField(dIndex, eIndex, 'sets', parseInt(e.target.value) || 1)}
				style={{ width: '55px', textAlign: 'center', padding: '4px', fontSize: '13px' }}
				min={1}
			/>
			<input
				type="text"
				className="input"
				value={ex.reps || '10'}
				onChange={(e) => updateExerciseField(dIndex, eIndex, 'reps', e.target.value)}
				style={{ width: '65px', textAlign: 'center', padding: '4px', fontSize: '13px' }}
			/>
			<input
				type="number"
				className="input"
				value={ex.weight_kg || 0}
				onChange={(e) => updateExerciseField(dIndex, eIndex, 'weight_kg', parseFloat(e.target.value) || 0)}
				style={{ width: '65px', textAlign: 'center', padding: '4px', fontSize: '13px' }}
				step={0.5}
				min={0}
			/>
			<button
				className={`btn btn-ghost p-1`}
				onClick={() => toggleExerciseLock(dIndex, eIndex)}
				style={{
					width: '60px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '2px',
					fontSize: '11px',
					color: ex.locked ? 'var(--accent, #6366f1)' : 'var(--text-tertiary)',
					background: ex.locked ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
					borderRadius: '4px'
				}}
				title={ex.locked ? t('Locked TIP') : t('Unlocked TIP')}
			>
				{ex.locked ? <><Lock size={12} /> {t('Lock')}</> : <><Unlock size={12} /> {t('Free')}</>}
			</button>
			<button
				className="btn btn-ghost p-1"
				onClick={() => removeExercise(dIndex, eIndex)}
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '8px',
					flexShrink: 0
				}}
			>
				<Trash2 size={18} style={{ color: 'var(--error)' }} />
			</button>
		</div>
	);
}
