import { useState } from 'react';
import { Lightbulb, X, Check, ArrowRight } from 'lucide-react';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestions';

interface SuggestionBadgeProps {
	suggestion: ProgressionSuggestion;
	onApply: (suggestion: ProgressionSuggestion) => void;
	onDismiss: () => void;
}

export default function SuggestionBadge({ suggestion, onApply, onDismiss }: SuggestionBadgeProps) {
	const [expanded, setExpanded] = useState(false);

	const typeColors: Record<string, string> = {
		weight_increase: 'var(--accent)',
		rep_increase: 'var(--accent)',
		deload: '#f59e0b',
		exercise_swap: '#ef4444',
		bw_progression: 'var(--accent)',
		cardio_increase: 'var(--accent)',
	};

	const typeLabels: Record<string, string> = {
		weight_increase: 'Weight ↑',
		rep_increase: 'Reps ↑',
		deload: 'Deload',
		exercise_swap: 'Swap',
		bw_progression: 'Progress',
		cardio_increase: 'Cardio ↑',
	};

	const color = typeColors[suggestion.type] || 'var(--accent)';
	const label = typeLabels[suggestion.type] || 'Suggestion';

	return (
		<div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
			{/* Lightbulb badge */}
			<button
				onClick={() => setExpanded(!expanded)}
				style={{
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: '2px',
					display: 'flex',
					alignItems: 'center',
					gap: '2px',
					color,
					fontSize: '11px',
					fontWeight: 600,
				}}
				title="View suggestion"
			>
				<Lightbulb size={14} fill={color} />
			</button>

			{/* Expanded card */}
			{expanded && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						minWidth: '280px',
						zIndex: 50,
						background: 'var(--bg-secondary, #1a1a2e)',
						border: `1px solid ${color}33`,
						borderRadius: '8px',
						padding: '12px',
						marginTop: '4px',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
					}}
				>
					{/* Header */}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
						<span style={{
							fontSize: '11px',
							fontWeight: 700,
							textTransform: 'uppercase',
							color,
							letterSpacing: '0.5px',
						}}>
							{label}
						</span>
						<button
							onClick={() => { setExpanded(false); onDismiss(); }}
							style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
						>
							<X size={14} />
						</button>
					</div>

					{/* Reason text */}
					<p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
						{suggestion.reason}
					</p>

					{/* Suggested values */}
					{suggestion.type !== 'exercise_swap' && (
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '8px',
							fontSize: '13px',
							color: 'var(--text-secondary)',
							marginBottom: '10px',
						}}>
							<span>
								{suggestion.current.weight !== undefined
									? `${suggestion.current.weight}kg × ${suggestion.current.reps}`
									: suggestion.current.distance !== undefined
										? `${suggestion.current.distance}km`
										: `${suggestion.current.reps} reps`
								}
							</span>
							<ArrowRight size={14} color={color} />
							<span style={{ color, fontWeight: 600 }}>
								{suggestion.suggested.weight !== undefined
									? `${suggestion.suggested.weight}kg × ${suggestion.suggested.reps}`
									: suggestion.suggested.distance !== undefined
										? `${suggestion.suggested.distance}km`
										: `${suggestion.suggested.reps} reps`
								}
							</span>
						</div>
					)}

					{/* New exercise name for bw_progression */}
					{suggestion.new_exercise_name && (
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							fontSize: '13px',
							color,
							fontWeight: 600,
							marginBottom: '10px',
						}}>
							<ArrowRight size={14} />
							{suggestion.new_exercise_name} ({suggestion.suggested.sets}×{suggestion.suggested.reps})
						</div>
					)}

					{/* Actions */}
					<div style={{ display: 'flex', gap: '8px' }}>
						<button
							onClick={() => { onApply(suggestion); setExpanded(false); }}
							className="btn"
							style={{
								flex: 1,
								background: color,
								color: '#fff',
								border: 'none',
								padding: '6px 12px',
								borderRadius: '6px',
								fontSize: '12px',
								fontWeight: 600,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '4px',
							}}
						>
							<Check size={14} /> Apply
						</button>
						<button
							onClick={() => { setExpanded(false); onDismiss(); }}
							className="btn btn-ghost"
							style={{
								padding: '6px 12px',
								borderRadius: '6px',
								fontSize: '12px',
								cursor: 'pointer',
							}}
						>
							Dismiss
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
