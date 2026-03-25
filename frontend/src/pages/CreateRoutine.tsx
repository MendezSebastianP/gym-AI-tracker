import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import ExercisePicker from '../components/ExercisePicker';
import { Plus, Trash, Trash2, Wand2, GripVertical, Pencil, Bot, RefreshCw } from 'lucide-react';
import ExerciseSuggestions from '../components/ExerciseSuggestions';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import HybridNumber from '../components/HybridNumber';
import CoinIcon from '../components/icons/CoinIcon';

export default function CreateRoutine() {
	const [mode, setMode] = useState<'select' | 'manual' | 'ai'>(() => {
		const savedMode = localStorage.getItem('draftRoutineMode');
		if (savedMode === 'manual') {
			try {
				const savedDays = localStorage.getItem('draftRoutineDays');
				const hasDraft = savedDays && JSON.parse(savedDays).some((d: any) => d.exercises?.length > 0);
				if (hasDraft) return 'manual';
			} catch { }
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
	const [loading, setLoading] = useState(false);
	const [finishingLoading, setFinishingLoading] = useState(false);
	const [aiError, setAiError] = useState<string | null>(null);
	const [isAiGenerated, setIsAiGenerated] = useState(() => {
		return localStorage.getItem('draftRoutineIsAi') === 'true';
	});
	const [aiCoachMessage, setAiCoachMessage] = useState(() => {
		return localStorage.getItem('draftRoutineCoachMsg') || '';
	});

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
		if (!name) return alert('Name is required');

		const routineData = { name, days, ai_usage_id: aiUsageId };

		try {
			if (navigator.onLine) {
				const res = await api.post('/routines', routineData);
				// Sync back to local DB? usually happen via sync logic, but we can optimistically add
				await db.routines.put({ ...res.data, syncStatus: 'synced' });
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
			alert('Error creating routine');
		}
	};

	const generateAI = async () => {
		setLoading(true);
		setAiError(null);
		try {
			const res = await api.post('/ai/generate-routine', {
				extra_prompt: aiExtraPrompt || undefined,
			});
			const routine = res.data;
			setName(routine.name || 'AI Routine');
			if (routine.coach_message) {
				setAiCoachMessage(routine.coach_message);
			}
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
			setDays(enrichedDays);
			setIsAiGenerated(true);
			setAiUsageId(routine.ai_usage_id);
			setMode('manual');

			setFinishingLoading(true);
			await new Promise(r => setTimeout(r, 400));
		} catch (e: any) {
			const detail = e?.response?.data?.detail || e?.message || 'Unknown error';
			if (e?.response?.status === 429) {
				setAiError(t('Rate limit reached. Please try again later.'));
			} else if (e?.response?.status === 503) {
				setAiError(t('AI service is not available. Please try again later.'));
			} else {
				setAiError(detail);
			}
		} finally {
			setLoading(false);
			setFinishingLoading(false);
		}
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

	if (mode === 'select') {
		return (
			<div className="container fade-in" style={{ paddingBottom: '80px' }}>
				<style>{`
					@keyframes wizardGlow {
						0%, 100% { box-shadow: 0 0 20px rgba(204,255,0,0.15), 0 0 40px rgba(204,255,0,0.07); }
						50% { box-shadow: 0 0 32px rgba(204,255,0,0.30), 0 0 64px rgba(204,255,0,0.13); }
					}
					@keyframes wandSpin {
						0% { transform: rotate(-10deg) scale(1); }
						50% { transform: rotate(10deg) scale(1.15); }
						100% { transform: rotate(-10deg) scale(1); }
					}
					@keyframes sparkFloat {
						0% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
						50% { transform: translateY(-7px) rotate(20deg); opacity: 1; }
						100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
					}
					@keyframes shimmerWizard {
						0% { background-position: -200% 0; }
						100% { background-position: 200% 0; }
					}
					@keyframes wizardBtnPulse {
						0%, 100% { box-shadow: 0 0 0 0 rgba(204,255,0,0.5); }
						50% { box-shadow: 0 0 0 8px rgba(204,255,0,0); }
					}
				`}</style>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
					<h1>{t('Create Routine')}</h1>
					{isOnboarding && (
						<button className="btn btn-ghost" onClick={handleSkip}>
							{t('Skip')}
						</button>
					)}
				</div>
				<div style={{ display: 'grid', gap: '16px' }}>
					{/* AI Wizard — hero card */}
					<button
						onClick={() => setMode('ai')}
						style={{
							textAlign: 'left', cursor: 'pointer', border: 'none', padding: 0, background: 'none', width: '100%',
						}}
					>
						<div style={{
							background: 'linear-gradient(135deg, rgba(204,255,0,0.1) 0%, rgba(0,230,120,0.06) 100%)',
							border: '1px solid rgba(204,255,0,0.35)',
							borderRadius: '18px',
							padding: '28px 24px',
							position: 'relative',
							overflow: 'hidden',
							animation: 'wizardGlow 4s ease-in-out infinite',
						}}>
							{/* Shimmer overlay */}
							<div style={{
								position: 'absolute', inset: 0, pointerEvents: 'none',
								background: 'linear-gradient(105deg, transparent 40%, rgba(204,255,0,0.05) 50%, transparent 60%)',
								backgroundSize: '200% 100%', animation: 'shimmerWizard 5s linear infinite',
							}} />
							{/* Sparkles */}
							<div style={{ position: 'absolute', top: '16px', right: '20px', animation: 'sparkFloat 2.8s ease-in-out infinite' }}>
								<Wand2 size={20} color="rgba(204,255,0,0.4)" style={{ animation: 'wandSpin 3s ease-in-out infinite' }} />
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
								<div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(204,255,0,0.12)', display: 'flex' }}>
									<Wand2 size={24} color="var(--primary)" />
								</div>
								<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
									{t('AI Wizard')}
								</h3>
							</div>
							<p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
								{t('Generate a personalized routine based on your profile and goals.')}
							</p>
							<div style={{
								padding: '12px 20px', borderRadius: '10px', background: 'var(--primary)',
								color: '#000', fontWeight: 800, fontSize: '14px', textAlign: 'center',
								animation: 'wizardBtnPulse 2.5s ease-in-out infinite',
								display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
							}}>
								<Wand2 size={16} /> {t('Generate with AI')}
								<span style={{ marginLeft: '4px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(0,0,0,0.15)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
									<CoinIcon size={12} style={{ color: 'var(--gold)' }} /> 50
								</span>
							</div>
						</div>
					</button>

					<button className="card" onClick={() => setMode('manual')} style={{ textAlign: 'left', cursor: 'pointer' }}>
						<h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
							<Plus size={20} /> {t('Manual Builder')}
						</h3>
						<p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>
							{t('Build your routine from scratch, exercise by exercise.')}
						</p>
					</button>
				</div>
			</div>
		);
	}

	if (loading) return (
		<div className="container fade-in" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
			<Wand2 size={48} style={{ color: 'var(--primary)', animation: 'pulse 1.5s ease-in-out infinite' }} />

			<h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px' }}>{t('Generating your personalized routine...')}</h2>
			<p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>{t('This may take a few seconds')}</p>

			<style>
				{`
				@keyframes fakeProgress {
					0% { width: 0%; }
					10% { width: 30%; }
					40% { width: 70%; }
					100% { width: 95%; }
				}
			`}
			</style>
			<div style={{ width: '80%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginTop: '16px', marginInline: 'auto' }}>
				<div style={{
					height: '100%',
					backgroundColor: 'var(--primary)',
					animation: finishingLoading ? 'none' : 'fakeProgress 12s cubic-bezier(0.1, 0.8, 0.2, 1) forwards',
					width: finishingLoading ? '100%' : '0%',
					transition: finishingLoading ? 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
				}} />
			</div>
		</div>
	);

	return (
		<div className="container fade-in" style={{ paddingBottom: '96px' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
				<h1>{mode === 'ai' ? t('AI Setup') : t('New Routine')}</h1>
				<button className="btn btn-ghost" onClick={handleCancel}>{t('Cancel')}</button>
			</div>

			{mode === 'ai' ? (
				<div className="card">
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
						<Wand2 size={20} style={{ color: 'var(--primary)' }} />
						<h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>{t('AI Routine Generator')}</h3>
					</div>
					<p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
						{t('We\'ll use your profile and training context to generate a routine. Optionally add specific instructions below.')}
					</p>
					{hasContext === false && (
						<div style={{ background: 'rgba(204, 255, 0, 0.08)', border: '1px solid rgba(204, 255, 0, 0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
							{t('Your Training Context isn\'t configured yet. The AI will generate a generic routine.')}{' '}
							<a href="/settings/questionnaire" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{t('Configure')}</a>
						</div>
					)}
					<div className="input-group">
						<label className="label">{t('Additional instructions (optional)')}</label>
						<textarea
							className="input"
							style={{ minHeight: '100px', padding: '12px', resize: 'vertical' }}
							placeholder={t('e.g., I want supersets to save time, focus on calves, include a deload week...')}
							value={aiExtraPrompt}
							onChange={e => setAiExtraPrompt(e.target.value)}
							maxLength={500}
						/>
						<span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
							{aiExtraPrompt.length}/500
						</span>
					</div>
					{aiError && (
						<div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,0,0,0.1)', color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }}>
							{aiError}
						</div>
					)}
					<button className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={generateAI}>
						<Wand2 size={18} /> {t('Generate Routine')}
					</button>
				</div>
			) : (
				<>
					{isAiGenerated && (
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(204,255,0,0.08)', border: '1px solid rgba(204,255,0,0.2)', marginBottom: '16px', fontSize: '13px', color: 'var(--primary)' }}>
							<Wand2 size={16} />
							{t('AI-generated suggestion — tap exercises to swap them')}
						</div>
					)}

					{/* AI Coach Feedback Message */}
					{isAiGenerated && aiCoachMessage && (
						<div style={{
							padding: '16px',
							borderRadius: '8px',
							backgroundColor: 'var(--bg-card)',
							border: '1px solid var(--border)',
							marginBottom: '16px',
							display: 'flex',
							flexDirection: 'column',
							gap: '12px'
						}}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>
								<span style={{ display: 'inline-flex' }}><Bot size={18} color="var(--primary)" /></span> {t('AI Coach Note')}
							</div>
							<p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
								{aiCoachMessage}
							</p>
						</div>
					)}

					{/* AI Refinement Bar */}
					{isAiGenerated && selectedForReplace.size > 0 && (
						<div style={{
							padding: '12px 16px',
							borderRadius: '8px',
							backgroundColor: 'rgba(255,165,0,0.08)',
							border: '1px solid rgba(255,165,0,0.3)',
							marginBottom: '16px',
							display: 'flex',
							flexDirection: 'column',
							gap: '8px'
						}}>
							<span style={{ fontSize: '13px', color: 'var(--warning, orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
								<RefreshCw size={14} /> {selectedForReplace.size} exercise{selectedForReplace.size > 1 ? 's' : ''} selected for replacement
							</span>
							<input
								className="input"
								placeholder={t('e.g. "Use machines instead" or "I have a shoulder injury"')}
								value={replacePrompt}
								onChange={e => setReplacePrompt(e.target.value)}
								style={{ fontSize: '13px' }}
							/>
							<div style={{ display: 'flex', gap: '8px' }}>
								<button
									className="btn btn-ghost"
									style={{ flex: 1, fontSize: '13px' }}
									onClick={() => { setSelectedForReplace(new Set()); setReplacePrompt(''); }}
								>
									{t('Cancel')}
								</button>
								<button
									className="btn btn-primary"
									style={{ flex: 1, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
									onClick={replaceSelected}
									disabled={replacing}
								>
									<Wand2 size={14} /> {replacing ? t('Replacing...') : t('Replace Selected')}
								</button>
							</div>
						</div>
					)}
					<div className="input-group">
						<label className="label">{t('Routine Name')}</label>
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
												isAiGenerated={isAiGenerated}
												isSelected={selectedForReplace.has(ex._id)}
												onToggleSelect={() => toggleSelectExercise(ex._id)}
												onRemove={() => handleRemoveExercise(dIndex, eIndex)}
												editing={editingExerciseId === ex._id}
												onStartEdit={() => setEditingExerciseId(ex._id)}
												onStopEdit={() => setEditingExerciseId(null)}
											/>
										))}
									</SortableContext>
								</DndContext>
								<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
									<button
										className="btn btn-secondary"
										style={{ flex: 2, fontSize: '14px', padding: '8px' }}
										onClick={() => setShowPicker({ dayIndex: dIndex })}
									>
										<Plus size={16} style={{ marginRight: '4px' }} /> Add Exercise
									</button>
									<button
										className="btn btn-secondary"
										style={{ flex: 1, fontSize: '14px', padding: '8px' }}
										onClick={() => setShowPicker({ dayIndex: dIndex, cardioMode: true })}
									>
										<Plus size={16} style={{ marginRight: '4px' }} /> Cardio
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

						<button onClick={() => setDays([...days, { day_name: `Day ${days.length + 1}`, exercises: [] }])}
							style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', fontSize: '13px', fontWeight: 600, border: '2px dashed rgba(204,255,0,0.35)', borderRadius: '10px', background: 'rgba(204,255,0,0.05)', color: 'var(--primary)', cursor: 'pointer' }}
						>
							<Plus size={15} /> Add Training Day
						</button>
					</div>
					<button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleSave}>
						Save Routine
					</button>

					{/* Undo Toast */}
					{undoState && createPortal(
						<div style={{
							position: 'fixed',
							bottom: '80px',
							right: '24px',
							backgroundColor: 'var(--bg-card)',
							color: 'var(--text-primary)',
							padding: '12px 16px',
							borderRadius: '8px',
							boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							zIndex: 9999,
							border: '1px solid var(--border)'
						}}>
							<span style={{ fontSize: '14px' }}>Exercise removed</span>
							<button
								className="btn btn-primary"
								style={{ padding: '6px 12px', minHeight: 'auto', height: 'auto', fontSize: '13px' }}
								onClick={() => {
									const newDays = [...days];
									newDays[undoState.dIndex].exercises.splice(undoState.eIndex, 0, undoState.ex);
									setDays(newDays);
									setUndoState(null);
									if (undoTimeoutRef.current) window.clearTimeout(undoTimeoutRef.current);
								}}
							>
								Undo
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
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				backgroundColor: isSelected ? 'rgba(255,165,0,0.08)' : 'var(--bg-card)',
				border: isSelected ? '1px solid orange' : editing ? '1px solid var(--primary)' : '1px solid var(--border)',
				borderRadius: '8px',
				marginBottom: '6px',
				overflow: editing ? 'visible' : 'hidden',
				position: 'relative',
				zIndex: editing ? 2 : 0,
			}}
			onClick={isAiGenerated ? onToggleSelect : undefined}
		>
			{/* Single row: grip | name+meta | pill | trash */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px' }}>
				<div
					style={{ width: '20px', cursor: 'grab', display: 'flex', justifyContent: 'center', flexShrink: 0 }}
					{...attributes} {...listeners}
					onClick={e => e.stopPropagation()}
				>
					<GripVertical size={14} color="var(--text-tertiary)" />
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? 'orange' : 'var(--text-primary)' }}>
						{ex.name}
					</div>
					<div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
						{ex.muscle_group || 'Any'} · {ex.equipment || 'Bodyweight'}
					</div>
				</div>
				{/* Pill button */}
				<button
					onClick={handlePillClick}
					style={{
						display: 'flex', alignItems: 'center', gap: '4px',
						padding: '4px 8px', borderRadius: '6px', flexShrink: 0,
						border: '1px solid var(--border)',
						background: isSelected ? 'rgba(255,165,0,0.15)' : 'var(--bg-secondary)',
						color: isSelected ? 'orange' : 'var(--text-primary)',
						cursor: 'pointer', fontSize: '12px', fontWeight: 600,
					}}
				>
					{ex.sets}×{ex.reps}
					{!isAiGenerated && <Pencil size={9} color="var(--text-tertiary)" />}
				</button>
				{/* Trash */}
				<button
					onClick={e => { e.stopPropagation(); if (onRemove) onRemove(); }}
					style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
				>
					<Trash2 size={15} color="var(--error)" />
				</button>
			</div>

			{/* Inline edit panel — expands when pill is tapped */}
			{editing && (
				<div style={{ padding: '8px 12px 14px 36px', borderTop: '1px solid var(--border)', background: 'rgba(204,255,0,0.03)', display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
					<HybridNumber
						value={ex.sets}
						onChange={v => { const nd = [...days]; nd[dIndex].exercises[eIndex].sets = v; setDays(nd); }}
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
								onChange={e => { const nd = [...days]; nd[dIndex].exercises[eIndex].reps = e.target.value; setDays(nd); }}
							/>
						</div>
					) : (
						<HybridNumber
							value={Number(ex.reps) || 10}
							onChange={v => { const nd = [...days]; nd[dIndex].exercises[eIndex].reps = String(v); setDays(nd); }}
							min={1} max={100} step={1} sensitivity={28} label="Reps" showDelta={false}
						/>
					)}
					<button
						onClick={e => { e.stopPropagation(); onStopEdit(); }}
						style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}
					>
						Done
					</button>
				</div>
			)}
		</div>
	);
}
