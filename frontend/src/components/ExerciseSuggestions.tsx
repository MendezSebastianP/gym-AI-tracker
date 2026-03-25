import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ExerciseSuggestionsProps {
	existingExerciseIds: number[];
	onAdd: (exercise: { id: number; name: string; muscle: string | null; muscle_group: string | null; equipment: string | null }) => void;
}

export default function ExerciseSuggestions({ existingExerciseIds, onAdd }: ExerciseSuggestionsProps) {
	const { t } = useTranslation();
	const [suggestions, setSuggestions] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const prevIdsRef = useRef<string>('');

	useEffect(() => {
		if (existingExerciseIds.length === 0) {
			setSuggestions([]);
			return;
		}

		const idsKey = existingExerciseIds.sort().join(',');
		if (idsKey === prevIdsRef.current) return;
		prevIdsRef.current = idsKey;

		if (debounceRef.current) clearTimeout(debounceRef.current);

		debounceRef.current = setTimeout(async () => {
			if (!navigator.onLine) return;
			setLoading(true);
			try {
				const res = await api.get(`/exercises/suggest?existing_ids=${idsKey}&limit=5`);
				setSuggestions(res.data);
			} catch {
				// Fail silently — convenience feature
			} finally {
				setLoading(false);
			}
		}, 300);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [existingExerciseIds]);

	if (suggestions.length === 0 && !loading) return null;

	return (
		<div style={{ marginTop: '8px' }}>
			{loading ? (
				<div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px 0' }}>
					{t('Finding suggestions...')}
				</div>
			) : (
				<div style={{
					display: 'flex', gap: '6px', overflowX: 'auto',
					paddingBottom: '4px', scrollbarWidth: 'none',
				}}>
					<span style={{ fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
						{t('Suggested')}:
					</span>
					{suggestions.map(ex => (
						<button
							key={ex.id}
							onClick={() => onAdd(ex)}
							style={{
								display: 'inline-flex', alignItems: 'center', gap: '4px',
								padding: '5px 10px', borderRadius: '16px',
								background: 'var(--bg-tertiary)',
								border: '1px solid var(--border)',
								fontSize: '12px', color: 'var(--text-secondary)',
								cursor: 'pointer', whiteSpace: 'nowrap',
								transition: 'all 0.15s',
							}}
						>
							<Plus size={12} />
							{ex.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
