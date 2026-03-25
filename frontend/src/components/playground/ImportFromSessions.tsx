import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { ChevronDown, ChevronRight, CheckSquare, Square, Download } from 'lucide-react';

interface ImportedExercise {
	exercise_id: number;
	name: string;
	sets: number;
	reps: string;
	rest: number;
}

interface SessionExercise {
	exercise_id: number;
	name: string;
	setCount: number;
	avgReps: number;
}

interface RecentSession {
	id: number;
	date: string;
	routineName?: string;
	exercises: SessionExercise[];
}

export default function ImportFromSessions() {
	const [expanded, setExpanded] = useState<number | null>(null);
	const [selected, setSelected] = useState<Map<string, SessionExercise>>(new Map());
	const [imported, setImported] = useState<ImportedExercise[]>([]);

	// Load recent sessions with exercise data from IndexedDB
	const recentSessions = useLiveQuery(async (): Promise<RecentSession[]> => {
		const sessions = await db.sessions.orderBy('started_at').reverse().limit(10).toArray();
		const result: RecentSession[] = [];

		for (const session of sessions) {
			if (!session.id) continue;

			// Get all sets for this session
			const sets = await db.sets.where('session_id').equals(session.id).toArray();
			if (sets.length === 0) continue;

			// Group sets by exercise_id
			const byExercise = new Map<number, typeof sets>();
			for (const s of sets) {
				if (!byExercise.has(s.exercise_id)) byExercise.set(s.exercise_id, []);
				byExercise.get(s.exercise_id)!.push(s);
			}

			// Enrich with exercise names
			const exercises: SessionExercise[] = [];
			for (const [exerciseId, exSets] of byExercise.entries()) {
				const ex = await db.exercises.get(exerciseId);
				const reps = exSets.map(s => s.reps ?? 0).filter(r => r > 0);
				const avgReps = reps.length > 0 ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : 10;
				exercises.push({
					exercise_id: exerciseId,
					name: ex?.name ?? `Exercise #${exerciseId}`,
					setCount: exSets.length,
					avgReps,
				});
			}

			// Get routine name if available
			let routineName: string | undefined;
			if (session.routine_id) {
				const routine = await db.routines.get(session.routine_id);
				routineName = routine?.name;
			}

			result.push({
				id: session.id,
				date: session.started_at,
				routineName,
				exercises,
			});
		}

		return result;
	}, []);

	const toggleExercise = (sessionId: number, ex: SessionExercise) => {
		const key = `${sessionId}-${ex.exercise_id}`;
		setSelected(prev => {
			const next = new Map(prev);
			if (next.has(key)) next.delete(key);
			else next.set(key, ex);
			return next;
		});
	};

	const isSelected = (sessionId: number, exerciseId: number) =>
		selected.has(`${sessionId}-${exerciseId}`);

	const importSelected = () => {
		const result: ImportedExercise[] = Array.from(selected.values()).map(ex => ({
			exercise_id: ex.exercise_id,
			name: ex.name,
			sets: ex.setCount,
			reps: String(ex.avgReps),
			rest: 60,
		}));
		setImported(result);
		setSelected(new Map());
	};

	const formatDate = (iso: string) => {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	};

	if (!recentSessions) {
		return <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>Loading sessions...</p>;
	}

	if (recentSessions.length === 0) {
		return (
			<p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
				No completed sessions found. Complete a workout first to import exercises from it.
			</p>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				Pull exercises from a past session directly into your routine. Sets and reps are pre-filled from your actual performance.
			</p>

			{/* Session list */}
			{recentSessions.map(session => (
				<div key={session.id} style={{
					borderRadius: '10px',
					border: '1px solid var(--border)',
					background: 'var(--bg-card)',
					overflow: 'hidden',
				}}>
					{/* Session header */}
					<div
						onClick={() => setExpanded(expanded === session.id ? null : session.id!)}
						style={{
							padding: '12px', cursor: 'pointer',
							display: 'flex', alignItems: 'center', gap: '8px',
						}}
					>
						{expanded === session.id
							? <ChevronDown size={16} color="var(--text-tertiary)" />
							: <ChevronRight size={16} color="var(--text-tertiary)" />
						}
						<div style={{ flex: 1 }}>
							<div style={{ fontSize: '14px', fontWeight: 600 }}>
								{session.routineName ?? 'Free Session'}
							</div>
							<div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
								{formatDate(session.date)} · {session.exercises.length} exercises
							</div>
						</div>
						<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
							{session.exercises.filter(ex => isSelected(session.id, ex.exercise_id)).length > 0 &&
								`${session.exercises.filter(ex => isSelected(session.id, ex.exercise_id)).length} selected`
							}
						</span>
					</div>

					{/* Expanded exercise list */}
					{expanded === session.id && (
						<div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
							{session.exercises.map(ex => {
								const checked = isSelected(session.id, ex.exercise_id);
								return (
									<div
										key={ex.exercise_id}
										onClick={() => toggleExercise(session.id, ex)}
										style={{
											display: 'flex', alignItems: 'center', gap: '10px',
											padding: '8px', borderRadius: '6px', cursor: 'pointer',
											background: checked ? 'rgba(204, 255, 0, 0.06)' : 'transparent',
											transition: 'background 0.15s',
										}}
									>
										{checked
											? <CheckSquare size={16} color="var(--primary)" />
											: <Square size={16} color="var(--text-tertiary)" />
										}
										<span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{ex.name}</span>
										<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
											{ex.setCount} × {ex.avgReps}
										</span>
									</div>
								);
							})}
						</div>
					)}
				</div>
			))}

			{/* Import button */}
			{selected.size > 0 && (
				<button
					onClick={importSelected}
					style={{
						padding: '12px', borderRadius: '10px', border: 'none',
						background: 'var(--primary)', color: '#000',
						fontSize: '14px', fontWeight: 700, cursor: 'pointer',
						display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
					}}
				>
					<Download size={16} />
					Import {selected.size} exercise{selected.size !== 1 ? 's' : ''}
				</button>
			)}

			{/* Result */}
			{imported.length > 0 && (
				<div>
					<div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>
						Imported ({imported.length}):
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						{imported.map((ex, i) => (
							<div key={i} style={{
								padding: '8px 12px', borderRadius: '8px',
								border: '1px solid rgba(204, 255, 0, 0.3)',
								background: 'rgba(204, 255, 0, 0.04)',
								display: 'flex', justifyContent: 'space-between',
								fontSize: '13px',
							}}>
								<span style={{ fontWeight: 600 }}>{ex.name}</span>
								<span style={{ color: 'var(--text-secondary)' }}>{ex.sets} × {ex.reps}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
