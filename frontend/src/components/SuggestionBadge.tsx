import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);
	const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 320 });

	const typeColors: Record<string, string> = {
		weight_increase: 'var(--lime)',
		rep_increase: 'var(--lime)',
		deload: 'var(--reward)',
		exercise_swap: 'var(--reward)',
		bw_progression: 'var(--lime)',
		cardio_increase: 'var(--lime)',
		plateau_warning: 'var(--reward)',
	};

	const typeLabels: Record<string, string> = {
		weight_increase: 'Weight ↑',
		rep_increase: 'Reps ↑',
		deload: 'Deload',
		exercise_swap: 'Swap',
		bw_progression: suggestion.new_exercise_name ? 'Next Progression' : 'Progress',
		cardio_increase: 'Cardio ↑',
		plateau_warning: 'Plateau Risk',
	};

	const color = typeColors[suggestion.type] || 'var(--primary)';
	const label = typeLabels[suggestion.type] || 'Suggestion';
	const applyTextColor = 'var(--on-lime)';
	const resolvedExerciseName = exerciseName?.trim() || 'Current exercise';

	const updatePopupPosition = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const width = Math.min(360, Math.max(280, window.innerWidth - 24));
		const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
		const estimatedHeight = 250;
		const top = (rect.bottom + 8 + estimatedHeight > window.innerHeight - 8)
			? Math.max(8, rect.top - estimatedHeight - 8)
			: rect.bottom + 8;
		setPopupPos({
			top,
			left,
			width,
		});
	}, []);

	useEffect(() => {
		if (!expanded) return;
		updatePopupPosition();
		const onResize = () => updatePopupPosition();
		const onScroll = () => updatePopupPosition();
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll, true);
		};
	}, [expanded, updatePopupPosition]);

	useEffect(() => {
		if (!expanded) return;
		const onDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (popupRef.current?.contains(target)) return;
			if (triggerRef.current?.contains(target)) return;
			setExpanded(false);
		};
		const onEsc = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setExpanded(false);
		};
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onEsc);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onEsc);
		};
	}, [expanded]);

	return (
		<div style={{ marginTop: '4px', position: 'relative' }}>
			{/* Trigger button — small inline lightbulb + label */}
			<button
				ref={triggerRef}
				onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
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
						<span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{resolvedExerciseName}</span>
						<ArrowRight size={11} />
						<span>{suggestion.new_exercise_name}</span>
					</>
					: label
				}
			</button>

			{/* Popup — rendered as fixed overlay so it never shifts layout */}
			{expanded && typeof document !== 'undefined' && createPortal(
				<div style={{
					position: 'fixed',
					inset: 0,
					zIndex: 280,
					pointerEvents: 'none',
				}}>
					<div
						ref={popupRef}
						style={{
							position: 'fixed',
							top: popupPos.top,
							left: popupPos.left,
							width: popupPos.width,
							maxWidth: 'calc(100vw - 24px)',
							background: 'var(--card-solid)',
							border: '1px solid var(--line-strong)',
							borderRadius: '14px',
							padding: '13px 14px',
							boxShadow: '0 16px 38px -16px rgba(0,0,0,0.6)',
							pointerEvents: 'auto',
						}}
					>
					{/* Header */}
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
						<span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '0.5px' }}>
							{suggestion.new_exercise_name
								? <>
									<span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{resolvedExerciseName}</span>
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
							style={{
								flex: 1,
								background: color,
								color: applyTextColor,
								border: 'none',
								padding: '9px 12px',
								borderRadius: '10px',
								fontFamily: 'var(--font-disp)',
								fontSize: '12.5px',
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
							className="tool-chip"
							style={{ height: 'auto', padding: '9px 12px', fontSize: '12.5px' }}
						>
							Dismiss
						</button>
					</div>
				</div>
				</div>,
				document.body
			)}
		</div>
	);
}
