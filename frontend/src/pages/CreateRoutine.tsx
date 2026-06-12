import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import ExercisePicker from '../components/ExercisePicker';
import GenLoader from '../components/GenLoader';
import { Plus, Trash2, GripVertical, Pencil as PencilIcon, RefreshCw, ArrowRight, Check } from 'lucide-react';
import ExerciseSuggestions from '../components/ExerciseSuggestions';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import HybridNumber from '../components/HybridNumber';
import { useAuthStore } from '../store/authStore';
import { getCoinRecoveryTarget } from '../utils/coinRecovery';
import { K, Coin } from '../components/kit';

export default function CreateRoutine() {
	const { user, updateUser } = useAuthStore();
	const [mode, setMode] = useState<'select' | 'manual' | 'ai'>(() => {
		const savedMode = localStorage.getItem('draftRoutineMode');
		if (savedMode === 'manual') {
			try {
				const savedDays = localStorage.getItem('draftRoutineDays');
				const hasDraft = savedDays && JSON.parse(savedDays).some((d: any) => d.exercises?.length > 0);
				if (hasDraft) return 'manual';
			} catch { /* ignore invalid draft */ }
		}
		return 'select';
	});
	const [name, setName] = useState(() => {
		return localStorage.getItem('draftRoutineName') || '';
	});
	const [days, setDays] = useState<any[]>(() => {
		const saved = localStorage.getItem('draftRoutineDays');
		return saved ? JSON.parse(saved) : [{ day_name: 'Day 1', exercises: [] }];
	});
	const [aiUsageId, setAiUsageId] = useState<number | null>(() => {
		const saved = localStorage.getItem('draftRoutineAiUsageId');
		return saved ? parseInt(saved, 10) : null;
	});
	const [showPicker, setShowPicker] = useState<{ dayIndex: number; cardioMode?: boolean } | null>(null);
	const [nameInitialized, setNameInitialized] = useState(false);

	// AI State
	const [aiExtraPrompt, setAiExtraPrompt] = useState('');
	const [genPhase, setGenPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const genRun = useRef(0);
	const pendingRoutine = useRef<{ routine: any; enrichedDays: any[] } | null>(null);
	const [aiError, setAiError] = useState<string | null>(null);
	const [isAiGenerated, setIsAiGenerated] = useState(() => {
		return localStorage.getItem('draftRoutineIsAi') === 'true';
	});
	const [aiCoachMessage, setAiCoachMessage] = useState(() => {
		return localStorage.getItem('draftRoutineCoachMsg') || '';
	});

	// Coin balance for AI features
	const [coinBalance, setCoinBalance] = useState<number | null>(null);
	const coinRecoveryTarget = getCoinRecoveryTarget(user?.onboarding_progress);
	useEffect(() => {
		if (mode === 'ai') {
			api.get('/gamification/stats').then(res => {
				setCoinBalance(res.data.currency ?? 0);
			}).catch(() => {});
		}
	}, [mode]);

	// Training context check
	const [hasContext, setHasContext] = useState<boolean | null>(null);
	useEffect(() => {
		if (mode === 'ai') {
			api.get('/preferences').then(res => {
				const p = res.data;
				setHasContext(!!(p.primary_goal || p.experience_level));
			}).catch(() => setHasContext(null));
		}
	}, [mode]);

	// Interactive AI Refinement state
	const [selectedForReplace, setSelectedForReplace] = useState<Set<string>>(new Set());
	const [replacePrompt, setReplacePrompt] = useState('');
	const [replacing, setReplacing] = useState(false);

	// Undo state
	const [undoState, setUndoState] = useState<{ dIndex: number, eIndex: number, ex: any } | null>(null);
	const undoTimeoutRef = useRef<number | null>(null);

	const existingRoutines = useLiveQuery(() => db.routines.count());
	const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

	useEffect(() => {
		if (!nameInitialized && existingRoutines !== undefined) {
			if (existingRoutines === 0 && !localStorage.getItem('draftRoutineName')) {
				setName('Main Routine');
			}
			setNameInitialized(true);
		}
	}, [existingRoutines, nameInitialized]);

	useEffect(() => {
		localStorage.setItem('draftRoutineMode', mode);
		localStorage.setItem('draftRoutineName', name);
		localStorage.setItem('draftRoutineDays', JSON.stringify(days));
		localStorage.setItem('draftRoutineIsAi', isAiGenerated.toString());
		localStorage.setItem('draftRoutineCoachMsg', aiCoachMessage);
		if (aiUsageId) {
			localStorage.setItem('draftRoutineAiUsageId', aiUsageId.toString());
		} else {
			localStorage.removeItem('draftRoutineAiUsageId');
		}
	}, [mode, name, days, aiUsageId, isAiGenerated, aiCoachMessage]);

	const handleCancel = () => {
		setMode('select');
		setName('');
		setDays([{ day_name: 'Day 1', exercises: [] }]);
		setAiUsageId(null);
		setIsAiGenerated(false);
		setAiCoachMessage('');
		localStorage.removeItem('draftRoutineMode');
		localStorage.removeItem('draftRoutineName');
		localStorage.removeItem('draftRoutineDays');
		localStorage.removeItem('draftRoutineIsAi');
		localStorage.removeItem('draftRoutineCoachMsg');
		localStorage.removeItem('draftRoutineAiUsageId');
	};

	const handleRemoveExercise = (dIndex: number, eIndex: number) => {
		const newDays = [...days];
		const ex = newDays[dIndex].exercises[eIndex];
		newDays[dIndex].exercises.splice(eIndex, 1);
		setDays(newDays);
		setUndoState({ dIndex, eIndex, ex });

		if (undoTimeoutRef.current) {
			window.clearTimeout(undoTimeoutRef.current);
		}
		undoTimeoutRef.current = window.setTimeout(() => {
			setUndoState(prev => prev?.ex === ex ? null : prev);
		}, 5000);
	};

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
		if (!name) return alert(t('Name is required'));

		const routineData = { name, days, ai_usage_id: aiUsageId };

		try {
			if (navigator.onLine) {
				const res = await api.post('/routines', routineData);
				// Sync back to local DB? usually happen via sync logic, but we can optimistically add
				await db.routines.put({ ...res.data, syncStatus: 'synced' });
				const me = await api.get('/auth/me');
				updateUser(me.data);
				await db.users.put(me.data).catch(() => {});
			} else {
				// Offline save
				await db.routines.add({ ...routineData, user_id: 0, syncStatus: 'created' } as any);
				// Add to sync queue
				await db.syncQueue.add({
					event_type: 'create_routine',
					payload: routineData,
					client_timestamp: new Date().toISOString(),
					processed: false
				});
			}

			// Clear drafts upon successful save
			localStorage.removeItem('draftRoutineMode');
			localStorage.removeItem('draftRoutineName');
			localStorage.removeItem('draftRoutineDays');
			localStorage.removeItem('draftRoutineAiUsageId');

			navigate('/routines');
		} catch (e) {
			alert(t('Error creating routine'));
		}
	};

	const generateAI = async () => {
		const run = ++genRun.current;
		setGenPhase('loading');
		setAiError(null);
		try {
			const res = await api.post('/ai/generate-routine', {
				extra_prompt: aiExtraPrompt || undefined,
			});
			const routine = res.data;
			// Add _id and resolve exercise names from local DB
			const enrichedDays = await Promise.all(
				(routine.days || []).map(async (day: any) => ({
					...day,
					exercises: await Promise.all(
						(day.exercises || []).map(async (ex: any) => {
							const localEx = await db.exercises.get(ex.exercise_id);
							// Convert range reps (e.g. "8-12") to middle value
							let reps = String(ex.reps || '10');
							if (reps.includes('-') && !reps.includes('min')) {
								const [lo, hi] = reps.split('-').map(Number);
								if (!isNaN(lo) && !isNaN(hi)) {
									reps = String(Math.round((lo + hi) / 2));
								}
							}
							return {
								_id: Math.random().toString(36).substring(7),
								exercise_id: ex.exercise_id,
								name: localEx?.name || `Exercise #${ex.exercise_id}`,
								muscle_group: localEx?.muscle || localEx?.muscle_group || null,
								equipment: localEx?.equipment || null,
								sets: ex.sets || 3,
								reps,
								rest: ex.rest || 60,
								notes: ex.notes || null,
							};
						})
					),
				}))
			);
			if (genRun.current !== run) return; // cancelled meanwhile
			pendingRoutine.current = { routine, enrichedDays };
			setGenPhase('done');
		} catch (e: any) {
			if (genRun.current !== run) return;
			const detail = e?.response?.data?.detail || e?.message || 'Unknown error';
			if (e?.response?.status === 402) {
				setAiError(t('Not enough coins.'));
			} else if (e?.response?.status === 429) {
				setAiError(t('Rate limit reached. Please try again later.'));
			} else if (e?.response?.status === 503) {
				setAiError(t('AI service is not available. Please try again later.'));
			} else {
				setAiError(detail);
			}
			setGenPhase('error');
		}
	};

	const applyGenerated = () => {
		const p = pendingRoutine.current;
		setGenPhase('idle');
		if (!p) return;
		pendingRoutine.current = null;
		const routine = p.routine;
		setName(routine.name || 'AI Routine');
		if (routine.coach_message) {
			setAiCoachMessage(routine.coach_message);
		}
		setDays(p.enrichedDays);
		setIsAiGenerated(true);
		setAiUsageId(routine.ai_usage_id);
		if (routine.currency !== undefined) setCoinBalance(routine.currency);
		setMode('manual');
	};

	const toggleSelectExercise = (exerciseUid: string) => {
		setSelectedForReplace(prev => {
			const next = new Set(prev);
			if (next.has(exerciseUid)) next.delete(exerciseUid);
			else next.add(exerciseUid);
			return next;
		});
	};

	const replaceSelected = async () => {
		if (selectedForReplace.size === 0) return;
		setReplacing(true);
		setAiError(null);
		try {
			// Collect rejected exercise_ids
			const rejectedIds: number[] = [];
			for (const day of days) {
				for (const ex of day.exercises) {
					if (selectedForReplace.has(ex._id)) {
						rejectedIds.push(ex.exercise_id);
					}
				}
			}

			const res = await api.post('/ai/replace-exercises', {
				current_routine: {
					name,
					days: days.map((d: any) => ({
						day_name: d.day_name,
						exercises: d.exercises.map((ex: any) => ({
							exercise_id: ex.exercise_id,
							sets: ex.sets,
							reps: ex.reps,
							rest: ex.rest,
						}))
					}))
				},
				rejected_exercise_ids: rejectedIds,
				extra_prompt: replacePrompt || undefined,
			});

			const replacements: Record<number, any> = {};
			for (const rep of res.data.replacements) {
				replacements[rep.original_exercise_id] = rep;
			}

			// Swap in the replacements
			const updatedDays = await Promise.all(
				days.map(async (day: any) => ({
					...day,
					exercises: await Promise.all(
						day.exercises.map(async (ex: any) => {
							if (selectedForReplace.has(ex._id) && replacements[ex.exercise_id]) {
								const rep = replacements[ex.exercise_id];
								const localEx = await db.exercises.get(rep.exercise_id);
								// Convert range reps to middle value
								let reps = String(rep.reps || ex.reps || '10');
								if (reps.includes('-') && !reps.includes('min')) {
									const [lo, hi] = reps.split('-').map(Number);
									if (!isNaN(lo) && !isNaN(hi)) {
										reps = String(Math.round((lo + hi) / 2));
									}
								}
								return {
									_id: Math.random().toString(36).substring(7),
									exercise_id: rep.exercise_id,
									name: localEx?.name || `Exercise #${rep.exercise_id}`,
									muscle_group: localEx?.muscle || localEx?.muscle_group || null,
									equipment: localEx?.equipment || null,
									sets: rep.sets || ex.sets,
									reps,
									rest: rep.rest || ex.rest,
									notes: rep.notes || null,
								};
							}
							return ex;
						})
					),
				}))
			);

			setDays(updatedDays);
			setSelectedForReplace(new Set());
			setReplacePrompt('');
		} catch (e: any) {
			const detail = e?.response?.data?.detail || e?.message || 'Unknown error';
			setAiError(detail);
		} finally {
			setReplacing(false);
		}
	};

	const addExercise = (dayIndex: number, exercise: any) => {
		const newDays = [...days];
		const isCardio = exercise.type === 'Cardio';
		newDays[dayIndex].exercises.push({
			_id: Math.random().toString(36).substring(7),
			exercise_id: exercise.id,
			name: exercise.name,
			muscle_group: exercise.muscle || exercise.muscle_group || null,
			equipment: exercise.equipment || null,
			sets: isCardio ? 1 : 3,
			reps: isCardio ? '20 min' : '10',
			rest: isCardio ? 0 : 60
		});
		setDays(newDays);
		setShowPicker(null);
	};

	const addExercises = (dayIndex: number, exercises: any[]) => {
		const newDays = [...days];
		for (const exercise of exercises) {
			const isCardio = exercise.type === 'Cardio';
			newDays[dayIndex].exercises.push({
				_id: Math.random().toString(36).substring(7),
				exercise_id: exercise.id,
				name: exercise.name,
				muscle_group: exercise.muscle || exercise.muscle_group || null,
				equipment: exercise.equipment || null,
				sets: isCardio ? 1 : 3,
				reps: isCardio ? '20 min' : '10',
				rest: isCardio ? 0 : 60
			});
		}
		setDays(newDays);
		setShowPicker(null);
	};

	// Check for onboarding param
	const query = new URLSearchParams(window.location.search);
	const isOnboarding = query.get('onboarding') === 'true';

	const handleSkip = () => {
		navigate('/');
	};

	// ── AI generation overlay ──
	if (genPhase !== 'idle') {
		const p = pendingRoutine.current;
		const doneSub = p
			? `${p.enrichedDays.length} ${t('days')} · ${p.enrichedDays.reduce((a: number, d: any) => a + d.exercises.length, 0)} ${t('exercises')}`
			: '';
		return (
			<GenLoader
				variant="routine"
				status={genPhase === 'loading' ? 'loading' : genPhase === 'done' ? 'done' : 'error'}
				doneTitle={t('Routine ready')}
				doneSub={doneSub}
				errorText={aiError}
				onDone={applyGenerated}
				onRetry={generateAI}
				onCancel={() => { genRun.current++; setGenPhase('idle'); }}
			/>
		);
	}

	// ── Mode: pick AI vs manual ──
	if (mode === 'select') {
		return (
			<div className="container">
				<header className="page-hdr" style={{ alignItems: 'center' }}>
					<span className="page-title" style={{ fontSize: 30 }}>{t('Create Routine')}</span>
					{isOnboarding && (
						<button className="flow-cancel" onClick={handleSkip}>{t('Skip')}</button>
					)}
				</header>

				<div className="wiz">
					<span className="wiz-spark"><K.sparkBig /></span>
					<div className="wiz-body">
						<div className="wiz-head">
							<span className="wiz-badge"><K.spark width={18} height={18} /></span>
							<span className="wiz-title">{t('AI Wizard')}</span>
						</div>
						<p className="wiz-desc">{t('Generate a personalized routine based on your profile and goals.')}</p>
						<button className="btn-primary wiz-cta" onClick={() => setMode('ai')}>
							<K.spark />{t('Generate with AI')}
							<span className="credit"><Coin size={13} />50</span>
						</button>
					</div>
				</div>

				<button className="opt-card" onClick={() => setMode('manual')}>
					<div className="opt-head">
						<span className="opt-ic"><Plus size={17} /></span>
						<span className="opt-title">{t('Manual Builder')}</span>
					</div>
					<p className="opt-desc">{t('Build your routine from scratch, exercise by exercise.')}</p>
				</button>
			</div>
		);
	}

	return (
		<div className="container" style={{ paddingBottom: 96 }}>
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<span className="page-title" style={{ fontSize: mode === 'ai' ? 30 : 25 }}>
					{mode === 'ai' ? t('AI Setup') : t('New Routine')}
				</span>
				<button className="flow-cancel" onClick={handleCancel}>{t('Cancel')}</button>
			</header>

			{mode === 'ai' ? (
				<>
					<div className="ai-panel">
						<div className="pn-head">
							<span className="pn-spark"><K.spark width={17} height={17} /></span>
							<span className="pn-title">{t('AI Routine Generator')}</span>
						</div>
						<p>{t('We\'ll use your profile and training context to generate a routine. Optionally add specific instructions below.')}</p>

						{hasContext === false && (
							<p style={{ color: 'var(--text-2)' }}>
								{t('Your Training Context isn\'t configured yet. The AI will generate a generic routine.')}{' '}
								<a href="/settings/questionnaire" style={{ color: 'var(--lime)', textDecoration: 'underline', textUnderlineOffset: 2, fontWeight: 600 }}>
									{t('Configure')}
								</a>
							</p>
						)}

						<div className="ai-ta-label">{t('Additional instructions (optional)')}</div>
						<textarea
							className="ai-ta"
							maxLength={500}
							value={aiExtraPrompt}
							onChange={e => setAiExtraPrompt(e.target.value)}
							placeholder={t('e.g., I want supersets to save time, focus on calves, include a deload week...')}
						/>
						<div className="ai-count num">{aiExtraPrompt.length}/500</div>
					</div>

					{aiError && (
						<div
							className="coach"
							style={{
								marginTop: 12,
								borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)',
								background: 'color-mix(in oklab, var(--danger) 7%, var(--card-solid))',
							}}
						>
							<span className="badge" style={{ background: 'color-mix(in oklab, var(--danger) 16%, transparent)', color: 'var(--danger)' }}>!</span>
							<div><b style={{ color: 'var(--danger)' }}>{t('Generation failed')}</b><p>{aiError}</p></div>
						</div>
					)}

					{coinBalance !== null && coinBalance < 50 && (
						<div className="card" style={{ marginTop: 12, marginBottom: 0, textAlign: 'center' }}>
							<div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
								<Coin size={16} />
								{t('Need 50 coins, you have')} <span className="num" style={{ color: 'var(--reward)' }}>{coinBalance}</span>
							</div>
							<p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
								{coinRecoveryTarget.helper}
							</p>
							<button
								type="button"
								className="tool-chip"
								style={{ margin: '12px auto 0' }}
								onClick={() => navigate(coinRecoveryTarget.to)}
							>
								{coinRecoveryTarget.label}
								<ArrowRight size={14} />
							</button>
						</div>
					)}

					<button
						className="btn-primary"
						style={{ width: '100%', marginTop: 16, opacity: (coinBalance !== null && coinBalance < 50) ? 0.5 : 1 }}
						onClick={generateAI}
						disabled={coinBalance !== null && coinBalance < 50}
					>
						<K.spark />{t('Generate Routine')}
						<span className="credit"><Coin size={13} />50</span>
					</button>
				</>
			) : (
				<>
					{isAiGenerated && (
						<div className="coach" style={{ marginBottom: 12 }}>
							<span className="badge"><K.spark width={15} height={15} /></span>
							<div>
								<b>{t('AI-generated suggestion — tap exercises to swap them')}</b>
								{aiCoachMessage && <p>{aiCoachMessage}</p>}
							</div>
						</div>
					)}

					{/* AI Refinement Bar */}
					{isAiGenerated && selectedForReplace.size > 0 && (
						<div
							className="card"
							style={{
								marginBottom: 12,
								borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
								background: 'color-mix(in oklab, var(--reward) 6%, var(--card-solid))',
							}}
						>
							<span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--reward)', display: 'flex', alignItems: 'center', gap: 7 }}>
								<RefreshCw size={14} />
								{selectedForReplace.size} {t(selectedForReplace.size > 1 ? 'exercises selected for replacement' : 'exercise selected for replacement')}
							</span>
							<div className="field" style={{ marginTop: 10 }}>
								<input
									placeholder={t('e.g. "Use machines instead" or "I have a shoulder injury"')}
									value={replacePrompt}
									onChange={e => setReplacePrompt(e.target.value)}
									style={{ marginTop: 0, fontSize: 14 }}
								/>
							</div>
							<div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
								<button
									className="tool-chip"
									style={{ flex: 1, justifyContent: 'center' }}
									onClick={() => { setSelectedForReplace(new Set()); setReplacePrompt(''); }}
								>
									{t('Cancel')}
								</button>
								<button
									className="tool-chip on"
									style={{ flex: 1, justifyContent: 'center' }}
									onClick={replaceSelected}
									disabled={replacing}
								>
									<K.spark width={14} height={14} />
									{replacing ? t('Replacing...') : t('Replace Selected')}
								</button>
							</div>
							{aiError && (
								<p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--danger)' }}>{aiError}</p>
							)}
						</div>
					)}

					<div className="field" style={{ marginTop: 6 }}>
						<label>{t('Routine Name')}</label>
						<input value={name} onChange={e => setName(e.target.value)} placeholder={t('e.g. PPL Split')} />
					</div>

					{days.map((day, dIndex) => (
						<div key={dIndex} className="b-day">
							<div className="b-day-head">
								<input
									value={day.day_name}
									onChange={(e) => {
										const newDays = [...days];
										newDays[dIndex].day_name = e.target.value;
										setDays(newDays);
									}}
									style={{
										flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
										color: 'var(--text)', fontFamily: 'var(--font-disp)', fontWeight: 800,
										fontSize: 17, letterSpacing: '-0.01em', padding: '2px 0',
									}}
								/>
								{days.length > 1 && (
									<button
										className="b-day-del"
										onClick={() => {
											const newDays = [...days];
											newDays.splice(dIndex, 1);
											setDays(newDays);
										}}
										aria-label={t('Delete day')}
									>
										<Trash2 size={15} />
									</button>
								)}
							</div>

							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={(e) => handleDragEnd(e, dIndex)}
							>
								<SortableContext items={day.exercises.map((e: any) => e._id)} strategy={verticalListSortingStrategy}>
									<div className="b-ex-list" style={{ marginTop: day.exercises.length > 0 ? 12 : 0 }}>
										{day.exercises.map((ex: any, eIndex: number) => (
											<SortableCreateExerciseRow
												key={ex._id}
												ex={ex}
												eIndex={eIndex}
												dIndex={dIndex}
												days={days}
												setDays={setDays}
												isAiGenerated={isAiGenerated}
												isSelected={selectedForReplace.has(ex._id)}
												onToggleSelect={() => toggleSelectExercise(ex._id)}
												onRemove={() => handleRemoveExercise(dIndex, eIndex)}
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

							{/* Smart Suggestions */}
							<ExerciseSuggestions
								existingExerciseIds={day.exercises.map((e: any) => e.exercise_id)}
								onAdd={(exercise) => {
									const newDays = [...days];
									newDays[dIndex].exercises.push({
										_id: Math.random().toString(36).substring(7),
										exercise_id: exercise.id,
										name: exercise.name,
										muscle_group: exercise.muscle || exercise.muscle_group || null,
										equipment: exercise.equipment || null,
										sets: 3, reps: '10', rest: 60
									});
									setDays(newDays);
								}}
							/>
						</div>
					))}

					<button className="b-add-day" onClick={() => setDays([...days, { day_name: `Day ${days.length + 1}`, exercises: [] }])}>
						<Plus size={17} />{t('Add Training Day')}
					</button>

					<button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={handleSave}>
						{t('Save Routine')}
					</button>

					{/* Undo Toast */}
					{undoState && createPortal(
						<div className="toast" style={{ bottom: 'calc(var(--nav-h) + 24px)' }}>
							<span>{t('Exercise removed')}</span>
							<button
								onClick={() => {
									const newDays = [...days];
									newDays[undoState.dIndex].exercises.splice(undoState.eIndex, 0, undoState.ex);
									setDays(newDays);
									setUndoState(null);
									if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
								}}
								style={{
									background: 'var(--lime)', color: 'var(--on-lime)', border: 'none', cursor: 'pointer',
									borderRadius: 99, padding: '5px 13px', fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 12.5,
								}}
							>
								{t('Undo')}
							</button>
						</div>,
						document.body
					)}
				</>
			)}

			{showPicker && (
				<ExercisePicker
					multiSelect={!showPicker.cardioMode}
					onSelect={(ex) => addExercise(showPicker.dayIndex, ex)}
					onSelectMultiple={(exs) => addExercises(showPicker.dayIndex, exs)}
					onClose={() => setShowPicker(null)}
					cardioMode={showPicker.cardioMode ?? false}
				/>
			)}
		</div>
	);
}

function SortableCreateExerciseRow({ ex, eIndex, dIndex, days, setDays, isAiGenerated, isSelected, onToggleSelect, onRemove, editing, onStartEdit, onStopEdit }: any) {
	const { t } = useTranslation();
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id: ex._id });

	// Detect cardio: reps is non-numeric text (e.g. "20 min")
	const isCardio = typeof ex.reps === 'string' && isNaN(Number(ex.reps)) && ex.reps !== '';

	const handlePillClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isAiGenerated) {
			onToggleSelect();
		} else {
			onStartEdit();
		}
	};

	return (
		<div
			ref={setNodeRef}
			className="b-ex-row"
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				flexWrap: 'wrap',
				borderColor: isSelected
					? 'color-mix(in oklab, var(--reward) 50%, transparent)'
					: editing
						? 'color-mix(in oklab, var(--lime) 40%, transparent)'
						: undefined,
				background: isSelected ? 'color-mix(in oklab, var(--reward) 9%, transparent)' : undefined,
				overflow: editing ? 'visible' : 'hidden',
				position: 'relative',
				zIndex: editing ? 2 : 0,
			}}
			onClick={isAiGenerated ? onToggleSelect : undefined}
		>
			{/* Single row: grip | name+meta | pill | trash */}
			<div
				style={{ width: 20, cursor: 'grab', display: 'flex', justifyContent: 'center', flexShrink: 0, color: 'var(--text-4)' }}
				{...attributes} {...listeners}
				onClick={e => e.stopPropagation()}
			>
				<GripVertical size={14} />
			</div>
			<div className="be-main">
				<div className="be-name" style={{ color: isSelected ? 'var(--reward)' : undefined }}>{ex.name}</div>
				<div className="be-tag">{ex.muscle_group || t('Any')} · {ex.equipment || t('Bodyweight')}</div>
			</div>
			{/* sets×reps pill */}
			<button
				onClick={handlePillClick}
				className="num"
				style={{
					display: 'flex', alignItems: 'center', gap: 5,
					padding: '5px 10px', borderRadius: 8, flexShrink: 0,
					border: '1px solid var(--line-strong)',
					background: isSelected ? 'color-mix(in oklab, var(--reward) 14%, transparent)' : 'var(--raised)',
					color: isSelected ? 'var(--reward)' : 'var(--text)',
					cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-disp)',
				}}
			>
				{ex.sets}×{ex.reps}
				{!isAiGenerated && <PencilIcon size={9} style={{ color: 'var(--text-4)' }} />}
			</button>
			{/* Trash */}
			<button
				className="be-del"
				onClick={e => { e.stopPropagation(); if (onRemove) onRemove(); }}
				aria-label={t('Delete')}
			>
				<Trash2 size={15} />
			</button>

			{/* Inline edit panel — expands when pill is tapped */}
			{editing && (
				<div
					onClick={e => e.stopPropagation()}
					style={{
						flexBasis: '100%', display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap',
						padding: '10px 2px 4px 26px', borderTop: '1px solid var(--line)', marginTop: 8,
					}}
				>
					<div style={{ width: 86 }}>
						<HybridNumber
							value={ex.sets}
							onChange={v => { const nd = [...days]; nd[dIndex].exercises[eIndex].sets = v; setDays(nd); }}
							min={1} max={20} step={1} sensitivity={28} label={t('Sets')} showDelta={false}
						/>
					</div>
					<span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600, paddingBottom: 13 }}>×</span>
					{isCardio ? (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							<span className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)', textAlign: 'center' }}>{t('Duration')}</span>
							<input
								value={ex.reps}
								onChange={e => { const nd = [...days]; nd[dIndex].exercises[eIndex].reps = e.target.value; setDays(nd); }}
								style={{
									width: 86, height: 44, borderRadius: 10, textAlign: 'center',
									background: 'var(--raised)', border: '1px solid var(--line)', color: 'var(--text)',
									fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 14, outline: 'none',
								}}
							/>
						</div>
					) : (
						<div style={{ width: 86 }}>
							<HybridNumber
								value={Number(ex.reps) || 10}
								onChange={v => { const nd = [...days]; nd[dIndex].exercises[eIndex].reps = String(v); setDays(nd); }}
								min={1} max={100} step={1} sensitivity={28} label={t('Reps')} showDelta={false}
							/>
						</div>
					)}
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
