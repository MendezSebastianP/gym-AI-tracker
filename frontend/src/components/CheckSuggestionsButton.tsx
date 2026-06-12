import { Lightbulb, Loader2 } from 'lucide-react';

interface CheckSuggestionsButtonProps {
	loading: boolean;
	fetched: boolean;
	suggestionsCount: number;
	onClick: () => void;
}

export default function CheckSuggestionsButton({
	loading,
	fetched,
	suggestionsCount,
	onClick,
}: CheckSuggestionsButtonProps) {
	if (fetched && suggestionsCount === 0) {
		return null; // Hide after fetch if no suggestions
	}

	return (
		<button
			onClick={onClick}
			disabled={loading}
			className={`tool-chip ${fetched ? 'on' : ''}`}
			style={{
				height: 34,
				cursor: loading ? 'wait' : 'pointer',
				opacity: loading ? 0.7 : 1,
			}}
		>
			{loading ? (
				<Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
			) : (
				<Lightbulb size={14} />
			)}
			{loading
				? 'Checking...'
				: fetched
					? `${suggestionsCount} suggestion${suggestionsCount !== 1 ? 's' : ''}`
					: 'Check Suggestions'
			}
		</button>
	);
}
