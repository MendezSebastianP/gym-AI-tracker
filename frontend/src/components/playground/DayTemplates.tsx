import { useState } from 'react';
import { db } from '../../db/schema';
import { Zap, RotateCcw } from 'lucide-react';

interface FilledExercise {
	exercise_id: number;
	name: string;
	muscle_group: string | null;
	equipment: string | null;
	sets: number;
	reps: string;
	rest: number;
}

interface Template {
	name: string;
	emoji: string;
	muscles: string[];
	maxPerMuscle: number;
}

const TEMPLATES: Template[] = [
	{ name: 'Push Day', emoji: '🤜', muscles: ['Chest', 'Shoulders', 'Triceps'], maxPerMuscle: 2 },
	{ name: 'Pull Day', emoji: '🤛', muscles: ['Back', 'Lats', 'Biceps', 'Rear Delts'], maxPerMuscle: 2 },
	{ name: 'Leg Day', emoji: '🦵', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'], maxPerMuscle: 2 },
	{ name: 'Upper Body', emoji: '💪', muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'], maxPerMuscle: 1 },
	{ name: 'Lower Body', emoji: '🦶', muscles: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'], maxPerMuscle: 2 },
	{ name: 'Full Body', emoji: '🏋️', muscles: ['Chest', 'Back', 'Quadriceps', 'Hamstrings', 'Shoulders'], maxPerMuscle: 1 },
];

export default function DayTemplates() {
	const [result, setResult] = useState<FilledExercise[]>([]);
	const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const applyTemplate = async (template: Template) => {
		setLoading(true);
		try {
			const all = await db.exercises.toArray();
			const picked: FilledExercise[] = [];

			for (const muscle of template.muscles) {
				const matches = all
					.filter(ex =>
						ex.type !== 'Cardio' &&
						(ex.muscle?.toLowerCase() === muscle.toLowerCase() ||
						ex.muscle_group?.toLowerCase() === muscle.toLowerCase())
					)
					// Prefer compound exercises (higher difficulty_level)
					.sort((a, b) => (b.difficulty_level ?? 0) - (a.difficulty_level ?? 0))
					.slice(0, template.maxPerMuscle);

				for (const ex of matches) {
					picked.push({
						exercise_id: ex.id,
						name: ex.name,
						muscle_group: ex.muscle_group ?? null,
						equipment: ex.equipment ?? null,
						sets: 3,
						reps: '10',
						rest: 60,
					});
				}
			}

			setResult(picked);
			setAppliedTemplate(template.name);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				One-tap quick-fill: pick a template and instantly populate a day with exercises from your local library. No AI, no API call.
			</p>

			{/* Template grid */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
				{TEMPLATES.map(t => (
					<button
						key={t.name}
						onClick={() => applyTemplate(t)}
						disabled={loading}
						style={{
							padding: '12px', borderRadius: '10px',
							border: appliedTemplate === t.name ? '1px solid var(--primary)' : '1px solid var(--border)',
							background: appliedTemplate === t.name ? 'rgba(204, 255, 0, 0.08)' : 'var(--bg-card)',
							color: 'var(--text-primary)', cursor: 'pointer',
							display: 'flex', alignItems: 'center', gap: '8px',
							fontSize: '14px', fontWeight: 600,
							transition: 'all 0.15s',
						}}
					>
						<span style={{ fontSize: '20px' }}>{t.emoji}</span>
						<div style={{ textAlign: 'left' }}>
							<div>{t.name}</div>
							<div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
								{t.muscles.slice(0, 3).join(' · ')}
							</div>
						</div>
					</button>
				))}
			</div>

			{/* Result */}
			{result.length > 0 && (
				<div>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
							<Zap size={14} color="var(--primary)" />
							<span style={{ fontSize: '13px', fontWeight: 600 }}>
								{appliedTemplate} — {result.length} exercises
							</span>
						</div>
						<button
							onClick={() => { setResult([]); setAppliedTemplate(null); }}
							style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
						>
							<RotateCcw size={12} /> Reset
						</button>
					</div>
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
					{result.length === 0 && (
						<p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
							No matching exercises in your library. Sync or seed exercises first.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
