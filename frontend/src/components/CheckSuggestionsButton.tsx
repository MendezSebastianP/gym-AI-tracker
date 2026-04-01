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
			className={`btn btn-ghost motion-btn motion-btn--ai ${loading ? 'is-loading' : ''}`.trim()}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '6px',
				padding: '6px 14px',
				borderRadius: '8px',
				fontSize: '13px',
				fontWeight: 500,
				color: fetched ? 'var(--accent)' : 'var(--text-secondary)',
				border: `1px solid ${fetched ? 'var(--accent)33' : 'var(--border, #333)'}`,
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
