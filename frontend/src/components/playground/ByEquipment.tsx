import { useState } from 'react';
import { db } from '../../db/schema';
import { Dumbbell, RotateCcw } from 'lucide-react';

const EQUIPMENT_OPTIONS = [
	{ label: 'Barbell', value: 'barbell' },
	{ label: 'Dumbbell', value: 'dumbbell' },
	{ label: 'Cable', value: 'cable' },
	{ label: 'Machine', value: 'machine' },
	{ label: 'Bodyweight', value: 'bodyweight' },
	{ label: 'Kettlebell', value: 'kettlebell' },
	{ label: 'Bands', value: 'bands' },
	{ label: 'Smith Machine', value: 'smith machine' },
];

// Balanced muscle group targets for a well-rounded day
const BALANCED_MUSCLES = ['Chest', 'Back', 'Quadriceps', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps'];

interface FilledExercise {
	exercise_id: number;
	name: string;
	muscle_group: string | null;
	equipment: string | null;
	sets: number;
	reps: string;
}

export default function ByEquipment() {
	const [selectedEquip, setSelectedEquip] = useState<Set<string>>(new Set(['barbell', 'dumbbell']));
	const [result, setResult] = useState<FilledExercise[]>([]);
	const [loading, setLoading] = useState(false);
	const [generated, setGenerated] = useState(false);

	const toggle = (value: string) => {
		setSelectedEquip(prev => {
			const next = new Set(prev);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return next;
		});
		setGenerated(false);
	};

	const generate = async () => {
		if (selectedEquip.size === 0) return;
		setLoading(true);
		try {
			const all = await db.exercises.toArray();
			const picked: FilledExercise[] = [];
			const equipSet = selectedEquip;

			for (const muscle of BALANCED_MUSCLES) {
				const matches = all.filter(ex => {
					if (ex.type === 'Cardio') return false;
					// Muscle match
					const muscleMatch =
						ex.muscle?.toLowerCase() === muscle.toLowerCase() ||
						ex.muscle_group?.toLowerCase() === muscle.toLowerCase();
					if (!muscleMatch) return false;
					// Equipment match (any of selected)
					const exEq = (ex.equipment || '').toLowerCase();
					const bwAliases = ['none (bodyweight)', 'bodyweight', 'body weight', 'none'];
					return Array.from(equipSet).some(e => {
						if (e === 'bodyweight') return bwAliases.includes(exEq);
						return exEq.includes(e);
					});
				}).sort((a, b) => (b.difficulty_level ?? 0) - (a.difficulty_level ?? 0));

				if (matches.length > 0) {
					const ex = matches[0];
					picked.push({
						exercise_id: ex.id,
						name: ex.name,
						muscle_group: ex.muscle_group ?? null,
						equipment: ex.equipment ?? null,
						sets: 3,
						reps: '10',
					});
				}
			}

			setResult(picked);
			setGenerated(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				Select the equipment you have available — get a balanced day using only those tools.
			</p>

			{/* Equipment checkboxes */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
				{EQUIPMENT_OPTIONS.map(opt => {
					const on = selectedEquip.has(opt.value);
					return (
						<button
							key={opt.value}
							onClick={() => toggle(opt.value)}
							style={{
								display: 'flex', alignItems: 'center', gap: '5px',
								padding: '7px 12px', borderRadius: '20px',
								border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
								background: on ? 'rgba(204, 255, 0, 0.12)' : 'var(--bg-card)',
								color: on ? 'var(--primary)' : 'var(--text-secondary)',
								fontSize: '13px', fontWeight: 600, cursor: 'pointer',
								transition: 'all 0.15s',
							}}
						>
							<Dumbbell size={12} />
							{opt.label}
						</button>
					);
				})}
			</div>

			{/* Generate button */}
			<button
				onClick={generate}
				disabled={loading || selectedEquip.size === 0}
				style={{
					padding: '12px', borderRadius: '10px', border: 'none',
					background: selectedEquip.size === 0 ? 'var(--bg-tertiary)' : 'var(--primary)',
					color: selectedEquip.size === 0 ? 'var(--text-tertiary)' : '#000',
					fontSize: '14px', fontWeight: 700, cursor: selectedEquip.size === 0 ? 'not-allowed' : 'pointer',
				}}
			>
				{loading ? 'Finding exercises...' : 'Build Day with Selected Equipment'}
			</button>

			{/* Result */}
			{generated && (
				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
						<span style={{ fontSize: '13px', fontWeight: 600 }}>
							{result.length} exercises found
						</span>
						<button
							onClick={() => { setResult([]); setGenerated(false); }}
							style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
						>
							<RotateCcw size={12} /> Reset
						</button>
					</div>

					{result.length === 0 ? (
						<p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px' }}>
							No exercises found for the selected equipment. Try adding more options or sync your exercise library.
						</p>
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
							{result.map((ex, i) => (
								<div key={i} style={{
									padding: '10px 12px', borderRadius: '8px',
									border: '1px solid var(--border)', background: 'var(--bg-card)',
									display: 'flex', alignItems: 'center', justifyContent: 'space-between',
								}}>
									<div>
										<div style={{ fontSize: '14px', fontWeight: 600 }}>{ex.name}</div>
										<div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
											{ex.muscle_group} · {ex.equipment}
										</div>
									</div>
									<span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
										{ex.sets} × {ex.reps}
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
