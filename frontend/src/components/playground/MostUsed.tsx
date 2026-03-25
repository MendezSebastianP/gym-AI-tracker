import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Plus, TrendingUp } from 'lucide-react';

interface QuickExercise {
	exercise_id: number;
	name: string;
	count: number;
	muscle_group: string | null;
	equipment: string | null;
}

interface AddedExercise extends QuickExercise {
	sets: number;
	reps: string;
}

export default function MostUsed() {
	const [added, setAdded] = useState<AddedExercise[]>([]);

	// Count how many times each exercise appears in local sets history
	const topExercises = useLiveQuery(async (): Promise<QuickExercise[]> => {
		const sets = await db.sets.toArray();

		// Count appearances per exercise
		const counts = new Map<number, number>();
		for (const s of sets) {
			counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1);
		}

		if (counts.size === 0) return [];

		// Sort by count, take top 12
		const top = Array.from(counts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 12);

		// Enrich with exercise names
		const result: QuickExercise[] = [];
		for (const [exerciseId, count] of top) {
			const ex = await db.exercises.get(exerciseId);
			if (ex) {
				result.push({
					exercise_id: exerciseId,
					name: ex.name,
					count,
					muscle_group: ex.muscle_group ?? null,
					equipment: ex.equipment ?? null,
				});
			}
		}
		return result;
	}, []);

	const addExercise = (ex: QuickExercise) => {
		if (added.some(a => a.exercise_id === ex.exercise_id)) return;
		setAdded(prev => [...prev, { ...ex, sets: 3, reps: '10' }]);
	};

	if (!topExercises) {
		return <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>Loading history...</p>;
	}

	if (topExercises.length === 0) {
		return (
			<p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
				No workout history found. Complete a few sessions to see your most-used exercises here.
			</p>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				Your most-performed exercises across all sessions. One tap to add to a day.
			</p>

			{/* Chip grid */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
				{topExercises.map(ex => {
					const isAdded = added.some(a => a.exercise_id === ex.exercise_id);
					return (
						<button
							key={ex.exercise_id}
							onClick={() => addExercise(ex)}
							disabled={isAdded}
							style={{
								display: 'flex', alignItems: 'center', gap: '6px',
								padding: '7px 12px', borderRadius: '20px',
								border: isAdded ? '1px solid var(--primary)' : '1px solid var(--border)',
								background: isAdded ? 'rgba(204, 255, 0, 0.12)' : 'var(--bg-card)',
								color: isAdded ? 'var(--primary)' : 'var(--text-primary)',
								fontSize: '13px', fontWeight: 600, cursor: isAdded ? 'default' : 'pointer',
								transition: 'all 0.15s',
							}}
						>
							{isAdded
								? <span style={{ fontSize: '12px' }}>✓</span>
								: <Plus size={13} />
							}
							{ex.name}
							<span style={{ fontSize: '10px', color: isAdded ? 'var(--primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
								<TrendingUp size={9} /> {ex.count}×
							</span>
						</button>
					);
				})}
			</div>

			{/* Added result */}
			{added.length > 0 && (
				<div>
					<div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
						Added ({added.length}):
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						{added.map((ex, i) => (
							<div key={i} style={{
								padding: '8px 12px', borderRadius: '8px',
								border: '1px solid rgba(204, 255, 0, 0.3)',
								background: 'rgba(204, 255, 0, 0.04)',
								display: 'flex', justifyContent: 'space-between', alignItems: 'center',
								fontSize: '13px',
							}}>
								<div>
									<span style={{ fontWeight: 600 }}>{ex.name}</span>
									{ex.muscle_group && (
										<span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>{ex.muscle_group}</span>
									)}
								</div>
								<span style={{ color: 'var(--text-secondary)' }}>3 × 10</span>
							</div>
						))}
					</div>
					<button
						onClick={() => setAdded([])}
						style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
					>
						Clear
					</button>
				</div>
			)}
		</div>
	);
}
