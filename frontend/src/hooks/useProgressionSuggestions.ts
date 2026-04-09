import { useState, useCallback } from 'react';
import { api } from '../api/client';

export interface ProgressionSuggestion {
	type: string; // weight_increase, rep_increase, deload, exercise_swap, bw_progression, cardio_increase, plateau_warning
	current: Record<string, any>;
	suggested: Record<string, any>;
	reason: string;
	confidence: number;
	new_exercise_id?: number;
	new_exercise_name?: string;
}

interface UseProgressionSuggestionsReturn {
	suggestions: Map<number, ProgressionSuggestion>;
	loading: boolean;
	error: string | null;
	fetched: boolean;
	fetch: () => Promise<void>;
}

export function useProgressionSuggestions(
	routineId: number | undefined,
	dayIndex: number | undefined,
): UseProgressionSuggestionsReturn {
	const [suggestions, setSuggestions] = useState<Map<number, ProgressionSuggestion>>(new Map());
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fetched, setFetched] = useState(false);

	const fetchSuggestions = useCallback(async () => {
		if (routineId === undefined || dayIndex === undefined) return;
		setLoading(true);
		setError(null);
		try {
			const res = await api.get(`/progression/routine/${routineId}`, {
				params: { day_index: dayIndex },
			});
			const data = res.data.suggestions as Record<string, ProgressionSuggestion>;
			const map = new Map<number, ProgressionSuggestion>();
			for (const [exId, suggestion] of Object.entries(data)) {
				map.set(Number(exId), suggestion);
			}
			setSuggestions(map);
			setFetched(true);
		} catch (e: any) {
			setError(e?.response?.data?.detail || 'Failed to load suggestions');
		} finally {
			setLoading(false);
		}
	}, [routineId, dayIndex]);

	return { suggestions, loading, error, fetched, fetch: fetchSuggestions };
}
