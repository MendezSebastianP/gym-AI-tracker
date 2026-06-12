import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, Edit2, Save, X, Lock, Unlock, Plus, Trash2, GripVertical, FileText, Pencil as PencilIcon, Check } from 'lucide-react';
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
import { K, SecLabel } from '../components/kit';

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
	const [editedName, setEditedName] = useState<string>('');
	const [suggestionDayIndex, setSuggestionDayIndex] = useState<number | undefined>(undefined);
	const [pendingFetchDay, setPendingFetchDay] = useState<number | undefined>(undefined);
	const progressionSuggestions = useProgressionSuggestions(routine?.id ? Number(routine.id) : undefined, suggestionDayIndex);
	const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());
	const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
	const toggleNameExpanded = (key: string) => {
		setExpandedNames(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key); else next.add(key);
			return next;
		});
	};

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
			return <span className="exl-tag">{contextLabel}</span>;
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
		setEditedName(routine?.name || '');
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

			const trimmedName = editedName.trim();
			const updatePayload: any = {
				days: cleanDays,
				description: editedDescription || null,
				name: trimmedName || routine.name,
			};
			if (navigator.onLine) {
				await api.put(`/routines/${routine.id}`, updatePayload);
			}
			await db.routines.update(routine.id, { ...updatePayload, syncStatus: 'updated' });
			setEditMode(false);
			setEditedDays(null);
		} catch (e) {
			console.error("Failed to save routine", e);
			alert(t('Error saving routine changes'));
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
				reps: isCardio ? '20 min' : '10',
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
			alert(t('Error starting session'));
		}
	};

	if (!routine) {
		return (
			<div className="container">
				<div className="mono" style={{ padding: '80px 0', textAlign: 'center', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<button className="icon-btn" onClick={() => navigate('/routines')} aria-label={t('Back')}>
					<ArrowLeft size={20} />
				</button>
				{editMode ? (
					<input
						type="text"
						value={editedName}
						onChange={(e) => setEditedName(e.target.value)}
						placeholder={t('Routine name')}
						style={{
							flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
							borderBottom: '1.5px dashed var(--line-strong)',
							color: 'var(--text)', fontFamily: 'var(--font-disp)', fontWeight: 800,
							fontSize: 24, letterSpacing: '-0.02em', padding: '0 0 4px',
						}}
					/>
				) : (
					<div className="page-title sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{routine.name}
					</div>
				)}
				{!editMode ? (
					<>
						<button className="icon-btn sm" onClick={() => navigate(`/routines/${id}/report`)} aria-label={t('Progression Report')}>
							<FileText size={16} />
						</button>
						<button className="edit-btn" onClick={startEdit}>
							<Edit2 size={13} />{t('Edit')}
						</button>
					</>
				) : (
					<>
						<button className="icon-btn sm" onClick={cancelEdit} aria-label={t('Cancel')}>
							<X size={16} />
						</button>
						<button className="done-pill on" onClick={saveEdit} style={{ opacity: saving ? 0.6 : 1 }}>
							<Save size={13} />{saving ? t('Saving...') : t('Save')}
						</button>
					</>
				)}
			</header>

			{editMode ? (
				<textarea
					className="ai-ta"
					value={editedDescription}
					onChange={(e) => setEditedDescription(e.target.value)}
					placeholder={t('Add a description...')}
					style={{ minHeight: 64, marginTop: 4 }}
				/>
			) : (
				routine.description && (
					<p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
						{routine.description}
					</p>
				)
			)}

			<SecLabel>{t('Program Days')} · {days.length}</SecLabel>

			{days.map((day: any, dIndex: number) => (
				<div key={dIndex} className="b-day" style={{ marginTop: dIndex === 0 ? 0 : 12 }}>
					<div className="b-day-head">
						{editMode ? (
							<>
								<input
									type="text"
									value={day.day_name || ''}
									onChange={(e) => {
										const newDays = JSON.parse(JSON.stringify(editedDays));
										newDays[dIndex].day_name = e.target.value;
										setEditedDays(newDays);
									}}
									style={{
										flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
										color: 'var(--text)', fontFamily: 'var(--font-disp)', fontWeight: 800,
										fontSize: 17, letterSpacing: '-0.01em', padding: '2px 0',
									}}
								/>
								<button className="b-day-del" onClick={() => removeDay(dIndex)} aria-label={t('Remove Day')}>
									<Trash2 size={15} />
								</button>
							</>
						) : (
							<>
								<span className="b-day-title">{day.day_name}</span>
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
							</>
						)}
					</div>

					{editMode ? (
						<>
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={(e) => handleDragEnd(e, dIndex)}
							>
								<SortableContext items={day.exercises.map((e: any) => e._id)} strategy={verticalListSortingStrategy}>
									<div className="b-ex-list" style={{ marginTop: day.exercises.length > 0 ? 12 : 0 }}>
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
									</div>
								</SortableContext>
							</DndContext>

							<div className="b-add-row">
								<button className="b-add-btn" onClick={() => setShowPicker({ dayIndex: dIndex })}>
									<Plus size={15} />{t('Add Exercise')}
								</button>
								<button className="b-add-btn sec" onClick={() => setShowPicker({ dayIndex: dIndex, cardioMode: true })}>
									<Plus size={15} />{t('Cardio')}
								</button>
							</div>
						</>
					) : (
						<>
							{/* Read-only view */}
							<div style={{ marginTop: 10 }}>
								{day.exercises.map((ex: any, i: number) => {
									const nameKey = `${dIndex}-${i}`;
									const nameExpanded = expandedNames.has(nameKey);
									return (
										<div key={i} style={{ padding: '7px 0', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
											<div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
												<span className="mono num" style={{ width: 18, flexShrink: 0, fontSize: 10.5, color: 'var(--text-4)', paddingTop: 3 }}>
													{i + 1}
												</span>
												<div
													onClick={(e) => { e.stopPropagation(); toggleNameExpanded(nameKey); }}
													style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, flexWrap: nameExpanded ? 'wrap' : 'nowrap', cursor: 'pointer' }}
												>
													<span
														style={{
															fontSize: 14.5, fontWeight: 600,
															overflow: nameExpanded ? 'visible' : 'hidden',
															textOverflow: nameExpanded ? 'clip' : 'ellipsis',
															whiteSpace: nameExpanded ? 'normal' : 'nowrap',
															minWidth: 0,
															wordBreak: 'break-word',
														}}
													>
														{getExerciseName(ex)}
													</span>
													{getExerciseContext(ex)}
												</div>
												<div className="num" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 13.5, fontWeight: 700 }}>
													{ex.locked && <Lock size={11} style={{ color: 'var(--lime)' }} />}
													<span>{ex.sets} × {ex.reps}</span>
													{(ex.weight_kg > 0) && (
														<span style={{ color: 'var(--lime)', fontSize: 12.5 }}>{ex.weight_kg}kg</span>
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
													<div style={{ paddingLeft: 27, marginTop: 4 }}>
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
									);
								})}
							</div>

							<button className="btn-primary sm" style={{ width: '100%', marginTop: 12 }} onClick={() => startSession(dIndex)}>
								<K.bolt />{t('Start Workout')}
							</button>
						</>
					)}
				</div>
			))}

			{editMode && (
				<button className="b-add-day" onClick={addDay}>
					<Plus size={17} />{t('Add New Day')}
				</button>
			)}

			{showPicker && (
				<ExercisePicker
					multiSelect={!showPicker.cardioMode}
					onSelect={(ex) => addExerciseToDay(showPicker.dayIndex, ex)}
					onSelectMultiple={(exs) => addExercisesToDay(showPicker.dayIndex, exs)}
					onClose={() => setShowPicker(null)}
					cardioMode={showPicker.cardioMode ?? false}
				/>
			)}
		</div>
	);
}

function SortableExerciseRow({ ex, eIndex, dIndex, getExerciseName, getExerciseContext, updateExerciseField, toggleExerciseLock, removeExercise, editing, onStartEdit, onStopEdit }: any) {
	const { t } = useTranslation();
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id: ex._id });

	const [nameExpanded, setNameExpanded] = useState(false);
	const isCardio = typeof ex.reps === 'string' && isNaN(Number(ex.reps)) && ex.reps !== '';

	const pillLabel = ex.weight_kg > 0
		? `${ex.sets}×${ex.reps} · ${ex.weight_kg}kg`
		: `${ex.sets}×${ex.reps}`;

	return (
		<div
			ref={setNodeRef}
			className="b-ex-row"
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				flexWrap: 'wrap',
				borderColor: editing
					? 'color-mix(in oklab, var(--lime) 40%, transparent)'
					: ex.locked
						? 'color-mix(in oklab, var(--green-mid) 50%, transparent)'
						: undefined,
				overflow: editing ? 'visible' : 'hidden',
				position: 'relative',
				zIndex: editing ? 2 : 0,
			}}
		>
			{/* Single row: grip | name+meta | pill | lock | trash */}
			<div
				style={{ width: 20, cursor: 'grab', display: 'flex', justifyContent: 'center', flexShrink: 0, color: 'var(--text-4)' }}
				{...attributes} {...listeners}
			>
				<GripVertical size={14} />
			</div>
			<div
				onClick={(e) => { e.stopPropagation(); setNameExpanded(v => !v); }}
				className="be-main"
				style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: nameExpanded ? 'wrap' : 'nowrap', cursor: 'pointer' }}
			>
				<span
					className="be-name"
					style={{
						overflow: nameExpanded ? 'visible' : 'hidden',
						textOverflow: nameExpanded ? 'clip' : 'ellipsis',
						whiteSpace: nameExpanded ? 'normal' : 'nowrap',
						wordBreak: 'break-word',
						minWidth: 0,
					}}
				>
					{getExerciseName(ex)}
				</span>
				{getExerciseContext && getExerciseContext(ex)}
			</div>
			{/* sets×reps·kg pill */}
			<button
				onClick={onStartEdit}
				className="num"
				style={{
					display: 'flex', alignItems: 'center', gap: 5,
					padding: '5px 10px', borderRadius: 8, flexShrink: 0,
					border: '1px solid var(--line-strong)', background: 'var(--raised)',
					color: 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-disp)',
				}}
			>
				{pillLabel}
				<PencilIcon size={9} style={{ color: 'var(--text-4)' }} />
			</button>
			{/* Lock toggle */}
			<button
				onClick={() => toggleExerciseLock(dIndex, eIndex)}
				style={{
					padding: 4, borderRadius: 4, border: 'none', background: 'none',
					cursor: 'pointer', flexShrink: 0, display: 'flex',
					color: ex.locked ? 'var(--lime)' : 'var(--text-4)',
				}}
				title={ex.locked ? t('Locked — pre-fills from plan') : t('Free — pre-fills from last session')}
			>
				{ex.locked ? <Lock size={14} /> : <Unlock size={14} />}
			</button>
			{/* Trash */}
			<button className="be-del" onClick={() => removeExercise(dIndex, eIndex)} aria-label={t('Delete')}>
				<Trash2 size={15} />
			</button>

			{/* Inline edit panel */}
			{editing && (
				<div
					onClick={e => e.stopPropagation()}
					style={{
						flexBasis: '100%', display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap',
						padding: '10px 2px 4px 26px', borderTop: '1px solid var(--line)', marginTop: 8,
					}}
				>
					<div style={{ width: 78 }}>
						<HybridNumber
							value={ex.sets}
							onChange={v => updateExerciseField(dIndex, eIndex, 'sets', v)}
							min={1} max={20} step={1} sensitivity={28} label={t('Sets')} showDelta={false}
						/>
					</div>
					{isCardio ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							<span className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)', textAlign: 'center' }}>{t('Duration')}</span>
							<input
								value={ex.reps}
								onChange={e => updateExerciseField(dIndex, eIndex, 'reps', e.target.value)}
								style={{
									width: 78, height: 44, borderRadius: 10, textAlign: 'center',
									background: 'var(--raised)', border: '1px solid var(--line)', color: 'var(--text)',
									fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 14, outline: 'none',
								}}
							/>
						</div>
					) : (
						<div style={{ width: 78 }}>
							<HybridNumber
								value={Number(ex.reps) || 10}
								onChange={v => updateExerciseField(dIndex, eIndex, 'reps', String(v))}
								min={1} max={100} step={1} sensitivity={28} label={t('Reps')} showDelta={false}
							/>
						</div>
					)}
					<div style={{ width: 78 }}>
						<HybridNumber
							value={ex.weight_kg || 0}
							onChange={v => updateExerciseField(dIndex, eIndex, 'weight_kg', v)}
							min={0} max={500} step={2.5} sensitivity={14} label="kg" showDelta={false}
						/>
					</div>
					<button
						onClick={e => { e.stopPropagation(); onStopEdit(); }}
						style={{
							marginLeft: 'auto', height: 40, padding: '0 16px', borderRadius: 11, border: 'none',
							background: 'var(--lime)', color: 'var(--on-lime)', fontFamily: 'var(--font-disp)',
							fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
						}}
					>
						<Check size={14} />{t('Done')}
					</button>
				</div>
			)}
		</div>
	);
}
