import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Play, ArrowLeft, Edit, Save, X, Lock, Unlock, Plus, Trash2, GripVertical, FileText, Pencil } from 'lucide-react';
import CheckSuggestionsButton from '../components/CheckSuggestionsButton';
import SuggestionBadge from '../components/SuggestionBadge';
import { useProgressionSuggestions } from '../hooks/useProgressionSuggestions';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestions';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import HybridNumber from '../components/HybridNumber';
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

	const routine = useLiveQuery(async () => {
		if (!id) return null;
		return await db.routines.get(parseInt(id));
	}, [id]);

	const [editMode, setEditMode] = useState(false);
	const [editedDays, setEditedDays] = useState<any[] | null>(null);
	const [saving, setSaving] = useState(false);
	const [showPicker, setShowPicker] = useState<{ dayIndex: number; cardioMode?: boolean } | null>(null);
	const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
	const [editedDescription, setEditedDescription] = useState<string>('');
	const [suggestionDayIndex, setSuggestionDayIndex] = useState<number | undefined>(undefined);
	const [pendingFetchDay, setPendingFetchDay] = useState<number | undefined>(undefined);
	const progressionSuggestions = useProgressionSuggestions(routine?.id ? Number(routine.id) : undefined, suggestionDayIndex);
	const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());

	// Trigger fetch when day index changes
	React.useEffect(() => {
		if (pendingFetchDay !== undefined && suggestionDayIndex === pendingFetchDay) {
			progressionSuggestions.fetch();
			setPendingFetchDay(undefined);
		}
	}, [suggestionDayIndex, pendingFetchDay]);

	// Filter out explicitly applied/matching suggestions
	const getValidSuggestionsCount = (dIndex: number) => {
		if (suggestionDayIndex !== dIndex || !progressionSuggestions.fetched) return null;
		const day = routine?.days[dIndex];
		if (!day) return 0;
		let count = 0;
		day.exercises.forEach((ex: any) => {
			const sug = progressionSuggestions.suggestions.get(ex.exercise_id);
			if (sug && !dismissedSuggestions.has(ex.exercise_id)) {
				let applied = true;
				if (sug.suggested.weight !== undefined && ex.weight_kg !== sug.suggested.weight) applied = false;
				if (sug.suggested.reps !== undefined && ex.reps !== String(sug.suggested.reps)) applied = false;
				if (sug.suggested.sets !== undefined && ex.sets !== sug.suggested.sets) applied = false;
				if (!applied) count++;
			}
		});
		return count;
	};

	// Fetch all exercises to map IDs to translated names
	const exercisesMap = useLiveQuery(async () => {
		const all = await db.exercises.toArray();
		const map = new Map();
		const currentLang = i18n.language.split('-')[0];
		all.forEach(ex => {
			const e = ex as any;
			map.set(ex.id, {
				name: e.name_translations?.[currentLang] || e.name,
				muscle: e.muscle_translations?.[currentLang] || e.muscle || '',
				equipment: e.equipment_translations?.[currentLang] || e.equipment || '',
			});
		});
		return map;
	}, [i18n.language]);

	const getExerciseName = (ex: any) => {
		if (exercisesMap && ex.exercise_id && exercisesMap.has(ex.exercise_id)) {
			return exercisesMap.get(ex.exercise_id).name;
		}
		return ex.name;
	};

	const getExerciseContext = (ex: any) => {
		if (exercisesMap && ex.exercise_id && exercisesMap.has(ex.exercise_id)) {
			const data = exercisesMap.get(ex.exercise_id);
			const equipmentLabel = data.equipment || '';
			const isBodyweightExercise = new Set([
				'None (Bodyweight)',
				'Bodyweight',
				t('None (Bodyweight)'),
				t('Bodyweight'),
			]).has(equipmentLabel);
			const contextLabel = isBodyweightExercise
				? t('Bodyweight')
				: [equipmentLabel, data.muscle].filter(Boolean).join(' · ');
			if (!contextLabel) return null;
			return (
				<span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-tertiary)' }}>
					{contextLabel}
				</span>
			);
		}
		return null;
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

	const addDay = () => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		newDays.push({
			day_name: `Day ${newDays.length + 1}`,
			exercises: []
		});
		setEditedDays(newDays);
	};

	const removeDay = (dayIndex: number) => {
		if (!editedDays) return;
		if (editedDays.length <= 1) {
			alert(t('Cannot remove the last day of the routine.'));
			return;
		}
		if (window.confirm(t('Are you sure you want to remove this entire day?'))) {
			const newDays = JSON.parse(JSON.stringify(editedDays));
			newDays.splice(dayIndex, 1);
			setEditedDays(newDays);
		}
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
		const isCardio = exercise.type === 'Cardio';
		newDays[dayIndex].exercises.push({
			_id: Math.random().toString(36).substring(7),
			exercise_id: exercise.id,
			name: exercise.name, // Store canonical name
			sets: isCardio ? 1 : 3,
			reps: isCardio ? '20 min' : '10',
			rest: isCardio ? 0 : 60,
			weight_kg: 0,
			locked: false
		});
		setEditedDays(newDays);
		setShowPicker(null);
	};

	const addExercisesToDay = (dayIndex: number, exercises: any[]) => {
		if (!editedDays) return;
		const newDays = JSON.parse(JSON.stringify(editedDays));
		for (const exercise of exercises) {
			const isCardio = exercise.type === 'Cardio';
			newDays[dayIndex].exercises.push({
				_id: Math.random().toString(36).substring(7),
				exercise_id: exercise.id,
				name: exercise.name,
				sets: isCardio ? 1 : 3,
				rips: isCardio ? '20 min' : '10',
				rest: isCardio ? 0 : 60,
				weight_kg: 0,
				locked: false
			});
		}
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
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							className="btn btn-ghost"
							onClick={() => navigate(`/routines/${id}/report`)}
							style={{ padding: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}
							title="Progression Report"
						>
							<FileText size={16} />
						</button>
						<button className="btn btn-secondary" onClick={startEdit} style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
							<Edit size={16} /> {t('Edit')}
						</button>
					</div>
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
							{editMode ? (
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
									<input
										type="text"
										className="input"
										value={day.day_name || ''}
										onChange={(e) => {
											const newDays = JSON.parse(JSON.stringify(editedDays));
											newDays[dIndex].day_name = e.target.value;
											setEditedDays(newDays);
										}}
										style={{ fontWeight: 'bold', fontSize: '18px', padding: '4px 8px', flex: 1 }}
									/>
									<button
										className="btn btn-ghost p-2"
										onClick={() => removeDay(dIndex)}
										title={t('Remove Day')}
										style={{ color: 'var(--error)' }}
									>
										<Trash2 size={18} />
									</button>
								</div>
							) : (
								<h3 style={{ margin: 0 }}>{day.day_name}</h3>
							)}
							{!editMode && (
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									{getValidSuggestionsCount(dIndex) !== 0 && (
										<CheckSuggestionsButton
											loading={progressionSuggestions.loading && suggestionDayIndex === dIndex}
											fetched={progressionSuggestions.fetched && suggestionDayIndex === dIndex}
											suggestionsCount={getValidSuggestionsCount(dIndex) || 0}
											onClick={() => {
												if (suggestionDayIndex === dIndex) {
													progressionSuggestions.fetch();
												} else {
													setSuggestionDayIndex(dIndex);
													setPendingFetchDay(dIndex);
												}
											}}
										/>
									)}
									<button
										className="btn btn-primary"
										style={{ padding: '8px 16px', fontSize: '14px' }}
										onClick={() => startSession(dIndex)}
									>
										<Play size={16} fill="black" style={{ marginRight: '6px' }} /> {t('Start Workout')}
									</button>
								</div>
							)}
						</div>

						<div style={{ display: 'grid', gap: '8px' }}>
							{editMode ? (
								<>


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
													getExerciseContext={getExerciseContext}
													updateExerciseField={updateExerciseField}
													toggleExerciseLock={toggleExerciseLock}
													removeExercise={removeExercise}
													editing={editingExerciseId === ex._id}
													onStartEdit={() => setEditingExerciseId(ex._id)}
													onStopEdit={() => setEditingExerciseId(null)}
												/>
											))}
										</SortableContext>
									</DndContext>


									<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
										<button
											className="btn btn-secondary"
											style={{ flex: 2, fontSize: '13px', padding: '8px' }}
											onClick={() => setShowPicker({ dayIndex: dIndex })}
										>
											<Plus size={14} style={{ marginRight: '4px' }} /> {t('Add Exercise')}
										</button>
										<button
											className="btn btn-secondary"
											style={{ flex: 1, fontSize: '13px', padding: '8px' }}
											onClick={() => setShowPicker({ dayIndex: dIndex, cardioMode: true })}
										>
											<Plus size={14} style={{ marginRight: '4px' }} /> {t('Cardio')}
										</button>
									</div>
								</>
							) : (
								// Read-only view
								day.exercises.map((ex: any, i: number) => (
									<div key={i} style={{ marginBottom: '8px' }}>
										<div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
											<span style={{ width: '24px', color: 'var(--text-tertiary)' }}>{i + 1}</span>
											<div style={{ flex: 1, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
												{getExerciseName(ex)}
												{getExerciseContext(ex)}
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
												{ex.locked && (
													<Lock size={12} style={{ color: 'var(--primary)' }} />
												)}
												<span>{ex.sets} x {ex.reps}</span>
												{(ex.weight_kg > 0) && (
													<span style={{ color: 'var(--primary)', fontSize: '12px' }}>
														{ex.weight_kg}kg
													</span>
												)}
											</div>
										</div>
										{(() => {
											if (suggestionDayIndex !== dIndex || !progressionSuggestions.fetched) return null;
											const sug = progressionSuggestions.suggestions.get(ex.exercise_id);
											if (!sug || dismissedSuggestions.has(ex.exercise_id)) return null;

											let applied = true;
											if (sug.suggested.weight !== undefined && ex.weight_kg !== sug.suggested.weight) applied = false;
											if (sug.suggested.reps !== undefined && ex.reps !== String(sug.suggested.reps)) applied = false;
											if (sug.suggested.sets !== undefined && ex.sets !== sug.suggested.sets) applied = false;

											if (applied) return null; // Already applied to routine def

											return (
												<div style={{ paddingLeft: '24px' }}>
													<SuggestionBadge
														suggestion={sug}
														exerciseName={getExerciseName(ex)}
														onApply={(suggestion: ProgressionSuggestion) => {
															// Update routine definition
															if (routine) {
																const updatedDays = JSON.parse(JSON.stringify(routine.days));
																const dayExercises = updatedDays[dIndex]?.exercises;
																if (dayExercises) {
																	const routineEx = dayExercises.find((e: any) => e.exercise_id === ex.exercise_id);
																	if (routineEx) {
																		if (suggestion.suggested.weight !== undefined) routineEx.weight_kg = suggestion.suggested.weight;
																		if (suggestion.suggested.reps !== undefined) routineEx.reps = String(suggestion.suggested.reps);
																		if (suggestion.suggested.sets !== undefined) routineEx.sets = suggestion.suggested.sets;
																		if (suggestion.new_exercise_id) routineEx.exercise_id = suggestion.new_exercise_id;
																	}
																}
																db.routines.update(routine.id!, { days: updatedDays, syncStatus: 'updated' as any });
																api.put(`/routines/${routine.id}`, { days: updatedDays }).catch(() => { });

																// Sync suggestion to active draft session if it exists
																const syncDraft = async () => {
																	try {
																		const activeSession = await db.sessions
																			.where('routine_id').equals(routine.id!)
																			.filter((s: any) => !s.completed_at).first();

																		if (activeSession && activeSession.id) {
																			const updates: any = { syncStatus: 'updated' };
																			if (suggestion.suggested.weight !== undefined) updates.weight_kg = suggestion.suggested.weight;
																			if (suggestion.suggested.reps !== undefined) {
																				updates.reps = parseInt(String(suggestion.suggested.reps).split('-')[0]) || 0;
																			}

																			if (Object.keys(updates).length > 1) {
																				const setsToUpdate = await db.sets
																					.where('session_id').equals(activeSession.id)
																					.filter((s: any) => s.exercise_id === ex.exercise_id).toArray();

																				for (const s of setsToUpdate) {
																					if (s.id) await db.sets.update(s.id, updates);
																				}
																			}
																		}
																	} catch { /* ignore session sync prep errors */ }
																};
																syncDraft();
															}
															api.post('/progression/feedback', {
																exercise_id: ex.exercise_id,
																suggestion_type: suggestion.type,
																suggested_value: suggestion.suggested,
																action: 'accepted',
																applied_value: suggestion.suggested,
															}).catch(() => { });
															setDismissedSuggestions(prev => new Set([...prev, ex.exercise_id]));
														}}
														onDismiss={() => {
															api.post('/progression/feedback', {
																exercise_id: ex.exercise_id,
																suggestion_type: progressionSuggestions.suggestions.get(ex.exercise_id)!.type,
																suggested_value: progressionSuggestions.suggestions.get(ex.exercise_id)!.suggested,
																action: 'rejected',
															}).catch(() => { });
															setDismissedSuggestions(prev => new Set([...prev, ex.exercise_id]));
														}}
													/>
												</div>
											);
										})()}
									</div>
								))
							)}
						</div>
					</div>
				))}
				{editMode && (
					<button
						className="btn btn-secondary fade-in"
						onClick={addDay}
						style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', marginTop: '8px' }}
					>
						<Plus size={18} /> {t('Add New Day')}
					</button>
				)}
			</div>

			{
				showPicker && (
					<ExercisePicker
						multiSelect={!showPicker.cardioMode}
						onSelect={(ex) => addExerciseToDay(showPicker.dayIndex, ex)}
						onSelectMultiple={(exs) => addExercisesToDay(showPicker.dayIndex, exs)}
						onClose={() => setShowPicker(null)}
						cardioMode={showPicker.cardioMode ?? false}
					/>
				)
			}
		</div >
	);
}

function SortableExerciseRow({ ex, eIndex, dIndex, getExerciseName, getExerciseContext, updateExerciseField, toggleExerciseLock, removeExercise, editing, onStartEdit, onStopEdit }: any) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id: ex._id });

	const isCardio = typeof ex.reps === 'string' && isNaN(Number(ex.reps)) && ex.reps !== '';

	const pillLabel = ex.weight_kg > 0
		? `${ex.sets}×${ex.reps} · ${ex.weight_kg}kg`
		: `${ex.sets}×${ex.reps}`;

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				backgroundColor: ex.locked ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
				border: editing ? '1px solid var(--primary)' : ex.locked ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border)',
				borderRadius: '8px',
				marginBottom: '6px',
				overflow: editing ? 'visible' : 'hidden',
				position: 'relative',
				zIndex: editing ? 2 : 0,
			}}
		>
			{/* Single row: grip | name+meta | pill | lock | trash */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px' }}>
				<div
					style={{ width: '20px', cursor: 'grab', display: 'flex', justifyContent: 'center', flexShrink: 0 }}
					{...attributes} {...listeners}
				>
					<GripVertical size={14} color="var(--text-tertiary)" />
				</div>
				<div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
					<span style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{getExerciseName(ex)}
					</span>
					{getExerciseContext && getExerciseContext(ex)}
				</div>
				{/* Pill button */}
				<button
					onClick={onStartEdit}
					style={{
						display: 'flex', alignItems: 'center', gap: '4px',
						padding: '4px 8px', borderRadius: '6px', flexShrink: 0,
						border: '1px solid var(--border)', background: 'var(--bg-secondary)',
						color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
					}}
				>
					{pillLabel}
					<Pencil size={9} color="var(--text-tertiary)" />
				</button>
				{/* Lock toggle */}
				<button
					onClick={() => toggleExerciseLock(dIndex, eIndex)}
					style={{
						padding: '4px', borderRadius: '4px', border: 'none', background: 'none',
						cursor: 'pointer', flexShrink: 0,
						color: ex.locked ? 'var(--accent, #6366f1)' : 'var(--text-tertiary)',
					}}
					title={ex.locked ? 'Locked — pre-fills from plan' : 'Free — pre-fills from last session'}
				>
					{ex.locked ? <Lock size={14} /> : <Unlock size={14} />}
				</button>
				{/* Trash */}
				<button
					onClick={() => removeExercise(dIndex, eIndex)}
					style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
				>
					<Trash2 size={15} color="var(--error)" />
				</button>
			</div>

			{/* Inline edit panel */}
			{editing && (
				<div style={{ padding: '8px 12px 14px 36px', borderTop: '1px solid var(--border)', background: 'rgba(204,255,0,0.03)', display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
					<HybridNumber
						value={ex.sets}
						onChange={v => updateExerciseField(dIndex, eIndex, 'sets', v)}
						min={1} max={20} step={1} sensitivity={28} label="Sets" showDelta={false}
					/>
					<span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, paddingBottom: '12px' }}>×</span>
					{isCardio ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
							<span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</span>
							<input
								className="input"
								style={{ width: '80px', height: '40px', fontSize: '13px', padding: '4px 8px' }}
								value={ex.reps}
								onChange={e => updateExerciseField(dIndex, eIndex, 'reps', e.target.value)}
							/>
						</div>
					) : (
						<HybridNumber
							value={Number(ex.reps) || 10}
							onChange={v => updateExerciseField(dIndex, eIndex, 'reps', String(v))}
							min={1} max={100} step={1} sensitivity={28} label="Reps" showDelta={false}
						/>
					)}
					<HybridNumber
						value={ex.weight_kg || 0}
						onChange={v => updateExerciseField(dIndex, eIndex, 'weight_kg', v)}
						min={0} max={500} step={2.5} sensitivity={14} label="KG" showDelta={false}
					/>
					<button
						onClick={onStopEdit}
						style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}
					>
						Done
					</button>
				</div>
			)}
		</div>
	);
}
