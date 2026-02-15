import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, CheckCircle, Trash2, Lock, Edit, Calendar } from 'lucide-react';
import WorkoutTimer from '../components/WorkoutTimer';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';

export default function ActiveSession() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const sessionId = parseInt(id || '0');
	const editMode = searchParams.get('edit') === 'true';
	const { user } = useAuthStore();
	const { t, i18n } = useTranslation();

	const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
	const routine = useLiveQuery(
		() => session?.routine_id ? db.routines.get(session.routine_id) : Promise.resolve(null),
		[session?.routine_id]
	);

	const sets = useLiveQuery(
		() => db.sets.where('session_id').equals(sessionId).toArray(),
		[sessionId]
	);

	const [exercises, setExercises] = useState<any[]>([]);
	const [startTime, setStartTime] = useState<number | null>(null);
	const [collapsedExercises, setCollapsedExercises] = useState<number[]>([]);
	const [timerMode, setTimerMode] = useState<'stopwatch' | 'timer'>('stopwatch');

	// Pre-fill sets from previous session or routine defaults
	useEffect(() => {
		const prefillSets = async () => {
			if (!routine || !session || !sets || sets.length > 0 || session.day_index === undefined) return;

			const day = routine.days[session.day_index];
			if (!day || !day.exercises || day.exercises.length === 0) return;

			// Fetch exercise details for default weights
			const exerciseIds = day.exercises.map((e: any) => e.exercise_id);
			const exerciseDetails = await db.exercises.bulkGet(exerciseIds);
			const detailsMap = new Map();
			exerciseDetails.forEach((ed: any) => { if (ed) detailsMap.set(ed.id, ed); });

			const previousSessions = await db.sessions
				.where('routine_id')
				.equals(routine.id)
				.and((s: any) => s.completed_at !== undefined && s.id !== sessionId && s.day_index === session.day_index)
				.reverse()
				.sortBy('completed_at');

			let previousSets: any[] = [];
			if (previousSessions && previousSessions.length > 0) {
				const lastSession = previousSessions[0];
				previousSets = await db.sets
					.where('session_id')
					.equals(lastSession.id!)
					.toArray();
			}

			const newSets: any[] = [];

			for (const ex of day.exercises) {
				const isLocked = ex.locked === true;
				const prevExSets = previousSets.filter((s: any) => s.exercise_id === ex.exercise_id);
				const detail = detailsMap.get(ex.exercise_id);
				// Use the stored default weight if available
				const defaultWeightDb = (detail as any)?.default_weight_kg || 0;

				if (isLocked) {
					const numSets = ex.sets || 3;
					const defaultReps = typeof ex.reps === 'string' ? parseInt(ex.reps.split('-')[0]) || 10 : ex.reps || 10;
					const defaultWeight = ex.weight_kg || defaultWeightDb || 0;

					for (let i = 1; i <= numSets; i++) {
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: i,
							weight_kg: defaultWeight,
							reps: defaultReps,
							completed_at: new Date().toISOString(),
							syncStatus: 'created'
						});
					}
				} else if (prevExSets.length > 0) {
					prevExSets.forEach((prevSet: any, idx: number) => {
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: idx + 1,
							weight_kg: prevSet.weight_kg || 0,
							reps: prevSet.reps || 0,
							completed_at: new Date().toISOString(),
							syncStatus: 'created'
						});
					});
				} else {
					const numSets = ex.sets || 3;
					const defaultReps = typeof ex.reps === 'string' ? parseInt(ex.reps.split('-')[0]) || 10 : ex.reps || 10;
					const defaultWeight = ex.weight_kg || defaultWeightDb || 0;

					for (let i = 1; i <= numSets; i++) {
						newSets.push({
							session_id: sessionId,
							exercise_id: ex.exercise_id,
							set_number: i,
							weight_kg: defaultWeight,
							reps: defaultReps,
							completed_at: new Date().toISOString(),
							syncStatus: 'created'
						});
					}
				}
			}

			try {
				await db.sets.bulkAdd(newSets);
				console.log(`Pre-filled ${newSets.length} sets`);
			} catch (e) {
				console.error('Error pre-filling sets:', e);
			}
		};

		prefillSets();
	}, [routine, session, sets, sessionId]);

	// Load timer mode and collapsed exercises
	useEffect(() => {
		if (session?.locked_exercises) {
			setCollapsedExercises(session.locked_exercises);
		}
		if (user?.settings?.timer_mode) {
			setTimerMode(user.settings.timer_mode);
		}
	}, [session, user]);

	// Fetch exercise details and resolve translations
	useEffect(() => {
		if (routine && session && session.day_index !== undefined) {
			const day = routine.days[session.day_index];
			if (day) {
				const ids = day.exercises.map((e: any) => e.exercise_id);
				db.exercises.bulkGet(ids).then(exerciseDetails => {
					const currentLang = i18n.language.split('-')[0];

					const enriched = day.exercises.map((e: any, i: number) => {
						const detail = exerciseDetails[i];
						// Resolve translated name
						const translatedName = (detail as any)?.name_translations?.[currentLang] || detail?.name || e.name || 'Unknown';

						return {
							...e,
							name: translatedName, // Use translated name for display
							is_bodyweight: detail?.is_bodyweight || false,
						};
					});
					setExercises(enriched);
				});
			}
			setStartTime(new Date(session.started_at).getTime());
		}
	}, [routine, session, i18n.language]);

	const finishSession = async () => {
		if (!session) return;
		const end = new Date().toISOString();
		const duration = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);

		await db.sessions.update(sessionId, {
			completed_at: end,
			syncStatus: 'created'
		});

		await db.syncQueue.add({
			event_type: 'complete_session',
			payload: { id: sessionId, completed_at: end, duration_sec: duration },
			client_timestamp: end,
			processed: false
		});
		navigate('/sessions');
	};

	const updateSet = async (setId: number, field: string, value: any) => {
		await db.sets.update(setId, { [field]: value, syncStatus: 'updated' });
	};

	const deleteSet = async (setId: number) => {
		await db.sets.delete(setId);
	};

	const addSet = async (exerciseId: number) => {
		const existingSets = sets?.filter((s: any) => s.exercise_id === exerciseId) || [];
		const nextSetNumber = existingSets.length + 1;
		await db.sets.add({
			session_id: sessionId,
			exercise_id: exerciseId,
			set_number: nextSetNumber,
			weight_kg: 0,
			reps: 0,
			completed_at: new Date().toISOString(),
			syncStatus: 'created'
		});
	};

	const toggleCollapse = async (exerciseId: number) => {
		const newCollapsed = collapsedExercises.includes(exerciseId)
			? collapsedExercises.filter((id: number) => id !== exerciseId)
			: [...collapsedExercises, exerciseId];

		setCollapsedExercises(newCollapsed);
		await db.sessions.update(sessionId, { locked_exercises: newCollapsed });
	};

	const isCompleted = !!session?.completed_at;
	const isEditable = !isCompleted || editMode;

	const getSessionDuration = () => {
		if (!session?.started_at || !session?.completed_at) return null;
		const start = new Date(session.started_at).getTime();
		const end = new Date(session.completed_at).getTime();
		const durationMin = Math.round((end - start) / 60000);
		return durationMin;
	};

	if (!session) return <div className="container">Loading session...</div>;

	return (
		<div className="container fade-in" style={{ paddingBottom: '100px' }}>
			{isCompleted && !editMode && (
				<div style={{ background: 'var(--success)', color: '#000', padding: '10px', textAlign: 'center', marginBottom: '16px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<span>{t('Session Completed')}</span>
					<button
						className="btn btn-ghost"
						onClick={() => navigate(`/sessions/${sessionId}?edit=true`)}
						style={{ padding: '4px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.3)', color: '#000' }}
					>
						<Edit size={14} style={{ marginRight: '4px' }} />
						{t('Edit')}
					</button>
				</div>
			)}

			{isCompleted && editMode && (
				<div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--text-primary)', padding: '16px', marginBottom: '16px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
						<span style={{ fontWeight: 'bold' }}>✏️ {t('Editing completed session')}</span>
						<button
							className="btn btn-ghost"
							onClick={() => navigate(`/sessions/${sessionId}`)}
							style={{ padding: '4px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}
						>
							{t('Done')}
						</button>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('Date & Time')}</label>
						<input
							type="datetime-local"
							value={session.started_at ? new Date(new Date(session.started_at).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
							onChange={async (e) => {
								if (!e.target.value) return;
								const newDate = new Date(e.target.value);
								// Adjust back to ISO string (browser handles local time to ISO conversion via new Date())

								const oldStart = new Date(session.started_at);
								const oldEnd = new Date(session.completed_at!);
								const duration = oldEnd.getTime() - oldStart.getTime();

								const newStartIso = newDate.toISOString();
								const newEndIso = new Date(newDate.getTime() + duration).toISOString();

								await db.sessions.update(sessionId, {
									started_at: newStartIso,
									completed_at: newEndIso,
									syncStatus: 'updated'
								});
							}}
							className="input"
							style={{ width: '100%', fontSize: '14px', padding: '12px' }}
						/>
					</div>
				</div>
			)}

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-primary)', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
				<div style={{ display: 'flex', alignItems: 'center' }}>
					<button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ paddingLeft: 0, marginRight: '8px' }}>
						<ArrowLeft size={24} />
					</button>
					<div>
						<h2 style={{ fontSize: '16px', margin: 0, fontWeight: 'bold' }}>
							{routine?.name}
						</h2>
						{!isCompleted && startTime && (
							<div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
								<WorkoutTimer mode={timerMode} startTime={startTime} />
							</div>
						)}
						{isCompleted && (
							<div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
								<Calendar size={12} />
								<span>{new Date(session.started_at).toLocaleDateString()}</span>
								{getSessionDuration() !== null && (
									<>
										<span>•</span>
										<span>{getSessionDuration()} min</span>
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{isEditable && !isCompleted && (
					<button className="btn btn-primary" onClick={finishSession} style={{ padding: '8px 16px', fontSize: '14px' }}>
						{t('Finish')}
					</button>
				)}
			</div>

			<div style={{ display: 'grid', gap: '24px' }}>
				{exercises.map((ex: any, i: number) => {
					const exerciseSets = sets?.filter((s: any) => s.exercise_id === ex.exercise_id).sort((a: any, b: any) => a.set_number - b.set_number) || [];
					const isCollapsed = collapsedExercises.includes(ex.exercise_id);
					const isExerciseLocked = ex.locked === true;

					return (
						<div key={i} className="card" style={{ overflow: 'hidden' }}>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									marginBottom: isCollapsed ? '0' : '12px',
									cursor: isCollapsed ? 'pointer' : 'default',
								}}
								onClick={() => isCollapsed && toggleCollapse(ex.exercise_id)}
							>
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									<h3 style={{ margin: 0 }}>{ex.name}</h3>
									{ex.is_bodyweight && <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>Bodyweight</span>}
									{isExerciseLocked && (
										<span style={{
											fontSize: '10px',
											background: 'rgba(99, 102, 241, 0.15)',
											padding: '2px 6px',
											borderRadius: '4px',
											color: 'var(--accent, #6366f1)',
											display: 'flex',
											alignItems: 'center',
											gap: '2px'
										}}>
											<Lock size={10} /> Locked
										</span>
									)}
								</div>
								{isEditable && (
									<button
										className="btn btn-ghost p-2"
										onClick={(e: any) => {
											e.stopPropagation();
											toggleCollapse(ex.exercise_id);
										}}
										style={{ fontSize: '12px' }}
									>
										{isCollapsed ? <>{t('Expand')}</> : <>{t('Collapse')}</>}
									</button>
								)}
							</div>

							{!isCollapsed && (
								<>
									<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-tertiary)', padding: '0 8px' }}>
										<span style={{ width: '40px' }}>SET</span>
										<span style={{ width: '80px', textAlign: 'center' }}>{ex.is_bodyweight ? '+KG' : 'KG'}</span>
										<span style={{ width: '80px', textAlign: 'center' }}>REPS</span>
										<span style={{ width: '50px' }}></span>
									</div>

									{exerciseSets.map((s: any) => (
										<div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginBottom: '4px' }}>
											<span style={{ width: '40px', fontWeight: 'bold', fontSize: '14px' }}>{s.set_number}</span>

											{isEditable ? (
												<>
													<input
														type="number"
														value={s.weight_kg || 0}
														onChange={(e: any) => updateSet(s.id!, 'weight_kg', parseFloat(e.target.value) || 0)}
														className="input"
														style={{ width: '80px', textAlign: 'center', padding: '6px', fontSize: '14px' }}
														step="0.5"
													/>
													<input
														type="number"
														value={s.reps || 0}
														onChange={(e: any) => updateSet(s.id!, 'reps', parseInt(e.target.value) || 0)}
														className="input"
														style={{ width: '80px', textAlign: 'center', padding: '6px', fontSize: '14px' }}
													/>
													<button
														className="btn btn-ghost p-1"
														onClick={() => deleteSet(s.id!)}
														style={{ width: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
													>
														<Trash2 size={16} style={{ color: 'var(--error)' }} />
													</button>
												</>
											) : (
												<>
													<span style={{ width: '80px', textAlign: 'center' }}>{s.weight_kg}</span>
													<span style={{ width: '80px', textAlign: 'center' }}>{s.reps}</span>
													<span style={{ width: '50px', display: 'flex', justifyContent: 'center' }}>
														<CheckCircle size={16} color="var(--success)" />
													</span>
												</>
											)}
										</div>
									))}

									{isEditable && (
										<button
											className="btn btn-secondary"
											onClick={() => addSet(ex.exercise_id)}
											style={{ width: '100%', marginTop: '8px', fontSize: '14px', padding: '8px' }}
										>
											+ {t('Add Set')}
										</button>
									)}
								</>
							)}

							{isCollapsed && (
								<div style={{ padding: '12px 0', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
									{exerciseSets.length} {t('sets')} • {t('Click to expand')}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
