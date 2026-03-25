import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';

interface Exercise {
	exercise_id: number;
	name: string;
	sets: number;
	reps: string;
	rest: number;
}

interface Day {
	day_name: string;
	exercises: Exercise[];
}

const MOCK_DAYS: Day[] = [
	{
		day_name: 'Push A',
		exercises: [
			{ exercise_id: 1, name: 'Bench Press', sets: 4, reps: '8', rest: 90 },
			{ exercise_id: 2, name: 'Overhead Press', sets: 3, reps: '10', rest: 90 },
			{ exercise_id: 3, name: 'Incline Dumbbell Press', sets: 3, reps: '12', rest: 60 },
			{ exercise_id: 4, name: 'Lateral Raise', sets: 3, reps: '15', rest: 45 },
			{ exercise_id: 5, name: 'Tricep Pushdown', sets: 3, reps: '12', rest: 60 },
		],
	},
	{
		day_name: 'Pull A',
		exercises: [
			{ exercise_id: 6, name: 'Pull Up', sets: 4, reps: '8', rest: 120 },
			{ exercise_id: 7, name: 'Barbell Row', sets: 4, reps: '8', rest: 90 },
			{ exercise_id: 8, name: 'Lat Pulldown', sets: 3, reps: '12', rest: 60 },
			{ exercise_id: 9, name: 'Barbell Curl', sets: 3, reps: '10', rest: 60 },
		],
	},
	{
		day_name: 'Leg A',
		exercises: [
			{ exercise_id: 10, name: 'Squat', sets: 4, reps: '8', rest: 120 },
			{ exercise_id: 11, name: 'Romanian Deadlift', sets: 3, reps: '10', rest: 90 },
			{ exercise_id: 12, name: 'Leg Press', sets: 3, reps: '12', rest: 90 },
			{ exercise_id: 13, name: 'Calf Raise', sets: 4, reps: '15', rest: 45 },
		],
	},
];

export default function CopyDay() {
	const [days, setDays] = useState<Day[]>(MOCK_DAYS);
	const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

	const copyDay = (source: Day) => {
		const copy: Day = {
			day_name: `${source.day_name} (copy)`,
			exercises: source.exercises.map(ex => ({ ...ex })),
		};
		setDays(prev => [...prev, copy]);
		setCopiedFrom(source.day_name);
	};

	const removeDay = (idx: number) => {
		setDays(prev => prev.filter((_, i) => i !== idx));
	};

	const renameDay = (idx: number, name: string) => {
		setDays(prev => prev.map((d, i) => i === idx ? { ...d, day_name: name } : d));
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				Duplicate any day's exercise list. Useful for A/B alternating routines — build Push A, copy it as Push B, then tweak.
			</p>

			{copiedFrom && (
				<div style={{
					padding: '8px 12px', borderRadius: '8px',
					background: 'rgba(204, 255, 0, 0.08)',
					border: '1px solid rgba(204, 255, 0, 0.3)',
					fontSize: '12px', color: 'var(--primary)',
				}}>
					Copied "{copiedFrom}" — rename it and adjust below
				</div>
			)}

			{days.map((day, dayIdx) => {
				const isCopy = day.day_name.includes('(copy)');
				return (
					<div key={dayIdx} style={{
						borderRadius: '10px',
						border: isCopy ? '1px solid rgba(204, 255, 0, 0.3)' : '1px solid var(--border)',
						background: isCopy ? 'rgba(204, 255, 0, 0.03)' : 'var(--bg-card)',
						overflow: 'hidden',
					}}>
						{/* Day header */}
						<div style={{
							padding: '10px 12px',
							borderBottom: '1px solid var(--border)',
							display: 'flex', alignItems: 'center', gap: '8px',
						}}>
							{isCopy ? (
								<input
									className="input"
									value={day.day_name}
									onChange={e => renameDay(dayIdx, e.target.value)}
									style={{ flex: 1, fontSize: '14px', fontWeight: 600, padding: '4px 8px', height: '32px' }}
								/>
							) : (
								<span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{day.day_name}</span>
							)}
							<span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
								{day.exercises.length} exercises
							</span>
							<button
								onClick={() => copyDay(day)}
								title="Copy this day"
								style={{
									display: 'flex', alignItems: 'center', gap: '4px',
									padding: '5px 10px', borderRadius: '6px',
									border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
									color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								<Copy size={12} /> Copy
							</button>
							{isCopy && (
								<button
									onClick={() => removeDay(dayIdx)}
									style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
								>
									<Trash2 size={16} />
								</button>
							)}
						</div>

						{/* Exercise list */}
						<div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
							{day.exercises.map((ex, i) => (
								<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
									<span style={{ color: 'var(--text-primary)' }}>{ex.name}</span>
									<span style={{ color: 'var(--text-tertiary)' }}>{ex.sets} × {ex.reps}</span>
								</div>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
