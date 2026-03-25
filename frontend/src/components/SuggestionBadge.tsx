import { useState } from 'react';
import { Lightbulb, X, Check, ArrowRight } from 'lucide-react';
import type { ProgressionSuggestion } from '../hooks/useProgressionSuggestions';

interface SuggestionBadgeProps {
	suggestion: ProgressionSuggestion;
	exerciseName?: string;
	onApply: (suggestion: ProgressionSuggestion) => void;
	onDismiss: () => void;
}

export default function SuggestionBadge({ suggestion, exerciseName, onApply, onDismiss }: SuggestionBadgeProps) {
	const [expanded, setExpanded] = useState(false);

	const typeColors: Record<string, string> = {
		weight_increase: 'var(--primary)',
		rep_increase: 'var(--primary)',
		deload: '#f59e0b',
		exercise_swap: '#8b8cf8',
		bw_progression: 'var(--primary)',
		cardio_increase: 'var(--primary)',
	};

	const typeLabels: Record<string, string> = {
		weight_increase: 'Weight ↑',
		rep_increase: 'Reps ↑',
		deload: 'Deload',
		exercise_swap: 'Swap',
		bw_progression: suggestion.new_exercise_name ? 'Next Progression' : 'Progress',
		cardio_increase: 'Cardio ↑',
	};

	const color = typeColors[suggestion.type] || 'var(--primary)';
	const label = typeLabels[suggestion.type] || 'Suggestion';
	const applyTextColor = suggestion.type === 'deload' ? '#fff' : suggestion.type === 'exercise_swap' ? '#fff' : '#000';

	return (
		<div style={{ marginTop: '4px' }}>
			{/* Trigger button — small inline lightbulb + label */}
			<button
				onClick={() => setExpanded(!expanded)}
				style={{
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: '3px 0',
					display: 'flex',
					alignItems: 'center',
					gap: '5px',
					color,
					fontSize: '11px',
					fontWeight: 700,
				}}
				title="View suggestion"
			>
				<Lightbulb size={13} fill={color} style={{ flexShrink: 0 }} />
				{suggestion.new_exercise_name && (suggestion.type === 'exercise_swap' || suggestion.type === 'bw_progression')
					? <>
						<span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{exerciseName || 'Exercise'}</span>
						<ArrowRight size={11} />
						<span>{suggestion.new_exercise_name}</span>
					</>
					: label
				}
			</button>

			{/* Popup — expands in place (no absolute positioning) */}
			{expanded && (
				<div style={{
					background: 'var(--bg-secondary)',
					border: `1px solid ${color}44`,
					borderRadius: '8px',
					padding: '12px',
					marginTop: '4px',
					boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
				}}>
					{/* Header */}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
						<span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '0.5px' }}>
							{suggestion.new_exercise_name
								? <>
									<span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{exerciseName || 'Exercise'}</span>
									{' → '}
									{suggestion.new_exercise_name}
								</>
								: label
							}
						</span>
						<button
							onClick={() => { setExpanded(false); onDismiss(); }}
							style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
						>
							<X size={14} />
						</button>
					</div>

					{/* Reason */}
					<p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 10px', lineHeight: 1.4 }}>
						{suggestion.reason}
					</p>

					{/* Current → Suggested values */}
					{suggestion.type !== 'exercise_swap' && !suggestion.new_exercise_name && (
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
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

					{/* Progression chain: current → new exercise */}
					{suggestion.new_exercise_name && (
						<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color, marginBottom: '10px' }}>
							<ArrowRight size={14} />
							{suggestion.new_exercise_name}
							{` (${suggestion.suggested.sets}×${suggestion.suggested.reps})`}
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
								color: applyTextColor,
								border: 'none',
								padding: '7px 12px',
								borderRadius: '6px',
								fontSize: '12px',
								fontWeight: 700,
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '4px',
							}}
						>
							<Check size={13} /> Apply
						</button>
						<button
							onClick={() => { setExpanded(false); onDismiss(); }}
							className="btn btn-ghost"
							style={{ padding: '7px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
						>
							Dismiss
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
