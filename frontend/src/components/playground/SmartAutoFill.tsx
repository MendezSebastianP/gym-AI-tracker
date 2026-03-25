import { useState, useRef } from 'react';
import { db } from '../../db/schema';
import { Wand2, CheckSquare, Square } from 'lucide-react';

interface SuggestedExercise {
	exercise_id: number;
	name: string;
	muscle_group: string | null;
	equipment: string | null;
	sets: number;
	reps: string;
	rest: number;
	selected: boolean;
}

const KEYWORD_MAP: Record<string, string[]> = {
	push: ['Chest', 'Shoulders', 'Triceps'],
	pull: ['Back', 'Lats', 'Biceps'],
	leg: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
	lower: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
	upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
	chest: ['Chest', 'Triceps'],
	back: ['Back', 'Lats', 'Biceps'],
	arm: ['Biceps', 'Triceps', 'Forearms'],
	shoulder: ['Shoulders', 'Triceps'],
	core: ['Abdominals', 'Core', 'Lower Back'],
	full: ['Chest', 'Back', 'Quadriceps', 'Hamstrings', 'Shoulders'],
	glute: ['Glutes', 'Hamstrings'],
	cardio: [], // no strength suggestions
};

function detectTheme(dayName: string): { label: string; muscles: string[] } | null {
	const lower = dayName.toLowerCase();
	for (const [keyword, muscles] of Object.entries(KEYWORD_MAP)) {
		if (lower.includes(keyword)) {
			if (muscles.length === 0) return null;
			const label = keyword.charAt(0).toUpperCase() + keyword.slice(1);
			return { label, muscles };
		}
	}
	return null;
}

export default function SmartAutoFill() {
	const [dayName, setDayName] = useState('');
	const [detected, setDetected] = useState<{ label: string; muscles: string[] } | null>(null);
	const [suggestions, setSuggestions] = useState<SuggestedExercise[]>([]);
	const [applied, setApplied] = useState<SuggestedExercise[]>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleDayNameChange = (value: string) => {
		setDayName(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const theme = detectTheme(value);
			setDetected(theme);
			if (!theme || theme.muscles.length === 0) {
				setSuggestions([]);
				return;
			}
			const all = await db.exercises.toArray();
			const picked: SuggestedExercise[] = [];
			for (const muscle of theme.muscles) {
				const matches = all
					.filter(ex =>
						ex.type !== 'Cardio' &&
						(ex.muscle?.toLowerCase() === muscle.toLowerCase() ||
						ex.muscle_group?.toLowerCase() === muscle.toLowerCase())
					)
					.sort((a, b) => (b.difficulty_level ?? 0) - (a.difficulty_level ?? 0))
					.slice(0, 2);
				for (const ex of matches) {
					picked.push({
						exercise_id: ex.id,
						name: ex.name,
						muscle_group: ex.muscle_group ?? null,
						equipment: ex.equipment ?? null,
						sets: 3, reps: '10', rest: 60,
						selected: true,
					});
				}
			}
			setSuggestions(picked);
			setApplied([]);
		}, 300);
	};

	const toggleOne = (idx: number) => {
		setSuggestions(prev => prev.map((ex, i) => i === idx ? { ...ex, selected: !ex.selected } : ex));
	};

	const applySelected = () => {
		setApplied(suggestions.filter(ex => ex.selected));
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
				Type a day name — "Push", "Chest & Tris", "Leg Day" — and exercises matching the theme auto-appear.
			</p>

			<input
				className="input"
				placeholder="Type a day name..."
				value={dayName}
				onChange={e => handleDayNameChange(e.target.value)}
				style={{ fontSize: '15px' }}
			/>

			{detected && suggestions.length > 0 && (
				<div style={{
					padding: '12px', borderRadius: '10px',
					border: '1px solid rgba(204, 255, 0, 0.3)',
					background: 'rgba(204, 255, 0, 0.04)',
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
						<Wand2 size={14} color="var(--primary)" />
						<span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
							Detected: {detected.label} day
						</span>
						<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
							— {detected.muscles.join(', ')}
						</span>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
						{suggestions.map((ex, i) => (
							<div
								key={i}
								onClick={() => toggleOne(i)}
								style={{
									display: 'flex', alignItems: 'center', gap: '10px',
									padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
									background: ex.selected ? 'rgba(204, 255, 0, 0.06)' : 'transparent',
									transition: 'background 0.15s',
								}}
							>
								{ex.selected
									? <CheckSquare size={16} color="var(--primary)" />
									: <Square size={16} color="var(--text-tertiary)" />
								}
								<div style={{ flex: 1 }}>
									<div style={{ fontSize: '13px', fontWeight: 600 }}>{ex.name}</div>
									<div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
										{ex.muscle_group} · {ex.equipment}
									</div>
								</div>
								<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>3 × 10</span>
							</div>
						))}
					</div>

					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							onClick={applySelected}
							style={{
								flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
								background: 'var(--primary)', color: '#000',
								fontSize: '13px', fontWeight: 700, cursor: 'pointer',
							}}
						>
							Apply {suggestions.filter(e => e.selected).length} exercises
						</button>
						<button
							onClick={() => setSuggestions(prev => prev.map(e => ({ ...e, selected: !prev.every(x => x.selected) })))}
							style={{
								padding: '10px 14px', borderRadius: '8px',
								border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
								color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
							}}
						>
							Toggle all
						</button>
					</div>
				</div>
			)}

			{detected && suggestions.length === 0 && dayName.length > 2 && (
				<p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
					No exercises found for "{detected.label}" in your library. Sync exercises first.
				</p>
			)}

			{applied.length > 0 && (
				<div>
					<div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
						Applied ({applied.length}):
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
						{applied.map((ex, i) => (
							<div key={i} style={{
								padding: '8px 12px', borderRadius: '8px',
								border: '1px solid var(--border)', background: 'var(--bg-card)',
								fontSize: '13px', display: 'flex', justifyContent: 'space-between',
							}}>
								<span style={{ fontWeight: 600 }}>{ex.name}</span>
								<span style={{ color: 'var(--text-tertiary)' }}>3 × 10</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
