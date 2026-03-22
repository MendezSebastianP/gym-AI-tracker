import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Minus, Plus } from 'lucide-react';
import {
	getRestTimerState,
	restTimerStart,
	restTimerPause,
	restTimerSkip,
	restTimerReset,
	restTimerSetTotal,
	restTimerAdjust,
} from '../store/timerStore';

/* ── Swipe Time Adjuster ─────────────────────────────────────────────────── */

function SwipeTimeAdjust({ value, onChange, min = 15, max = 600, disabled = false }: {
	value: number;
	onChange: (v: number) => void;
	min?: number;
	max?: number;
	disabled?: boolean;
}) {
	const [dragging, setDragging] = useState(false);
	const [delta, setDelta] = useState(0);
	const startY = useRef(0);
	const startVal = useRef(0);
	const mouseActive = useRef(false);

	const STEP = 5;
	const PX_PER_STEP = 10;

	const onDragStart = useCallback((clientY: number) => {
		if (disabled) return;
		startY.current = clientY;
		startVal.current = value;
		setDragging(true);
		setDelta(0);
	}, [value, disabled]);

	const onDragMove = useCallback((clientY: number) => {
		const dy = startY.current - clientY;
		const steps = Math.round(dy / PX_PER_STEP);
		const newVal = Math.max(min, Math.min(max, startVal.current + steps * STEP));
		onChange(newVal);
		setDelta(newVal - startVal.current);
	}, [onChange, min, max]);

	const onDragEnd = useCallback(() => {
		setDragging(false);
		setDelta(0);
	}, []);

	const handleTouchStart = useCallback((e: React.TouchEvent) => onDragStart(e.touches[0].clientY), [onDragStart]);
	const handleTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientY); }, [onDragMove]);
	const handleTouchEnd = useCallback(() => onDragEnd(), [onDragEnd]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		mouseActive.current = true;
		onDragStart(e.clientY);
		e.preventDefault();
	}, [onDragStart]);

	useEffect(() => {
		if (!dragging || !mouseActive.current) return;
		const move = (e: MouseEvent) => { if (mouseActive.current) onDragMove(e.clientY); };
		const up = () => { mouseActive.current = false; onDragEnd(); };
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
		return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
	}, [dragging, onDragMove, onDragEnd]);

	const minutes = Math.floor(value / 60);
	const seconds = value % 60;

	return (
		<div
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onMouseDown={handleMouseDown}
			style={{
				position: 'relative',
				cursor: disabled ? 'default' : 'ns-resize',
				userSelect: 'none',
				WebkitUserSelect: 'none',
				touchAction: 'none',
				opacity: disabled ? 0.5 : 1,
			}}
		>
			{dragging && delta !== 0 && (
				<div style={{
					position: 'absolute',
					top: -20,
					left: '50%',
					transform: 'translateX(-50%)',
					fontSize: '12px',
					fontWeight: 700,
					color: delta > 0 ? 'var(--success)' : 'var(--error)',
					whiteSpace: 'nowrap',
					pointerEvents: 'none',
					zIndex: 10,
				}}>
					{delta > 0 ? '+' : ''}{delta}s
				</div>
			)}

			<div style={{
				fontSize: '32px',
				fontWeight: 800,
				letterSpacing: '-1px',
				color: dragging ? 'var(--primary)' : 'inherit',
				transition: dragging ? 'none' : 'color 0.2s',
			}}>
				{minutes}:{seconds.toString().padStart(2, '0')}
			</div>

			{!disabled && !dragging && (
				<div style={{
					fontSize: 10,
					color: 'var(--text-tertiary)',
					textAlign: 'center',
					marginTop: 2,
				}}>
					drag to adjust
				</div>
			)}
		</div>
	);
}

/* ── Circular Rest Timer ─────────────────────────────────────────────────── */

interface RestTimerProps {
	defaultTime?: number;
	onFinish?: () => void;
}

export function RestTimer({ defaultTime = 90, onFinish }: RestTimerProps) {
	// Read initial state from global store
	const initial = getRestTimerState();
	const [total, setTotal] = useState(initial.total || defaultTime);
	const [remaining, setRemaining] = useState(initial.remaining || defaultTime);
	const [running, setRunning] = useState(initial.running);
	const [finished, setFinished] = useState(initial.finished);
	const onFinishRef = useRef(onFinish);
	onFinishRef.current = onFinish;

	// Tick — re-read from store every second
	useEffect(() => {
		if (!running) return;
		const tick = () => {
			const state = getRestTimerState();
			setRemaining(state.remaining);
			setTotal(state.total);
			setRunning(state.running);
			if (state.finished && !finished) {
				setFinished(true);
				setRunning(false);
				if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
				onFinishRef.current?.();
			}
		};
		tick();
		const id = setInterval(tick, 500);
		return () => clearInterval(id);
	}, [running, finished]);

	const start = () => { restTimerStart(); setFinished(false); setRunning(true); };
	const pause = () => { restTimerPause(); setRunning(false); };
	const skip = () => { restTimerSkip(); setRunning(false); setRemaining(0); setFinished(true); };
	const reset = () => { restTimerReset(); const s = getRestTimerState(); setRemaining(s.remaining); setTotal(s.total); setFinished(false); setRunning(false); };

	const handleTimeChange = (newTotal: number) => {
		restTimerSetTotal(newTotal);
		setTotal(newTotal);
		setRemaining(newTotal);
		setFinished(false);
	};

	// SVG circle math
	const RADIUS = 54;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const progress = total > 0 ? remaining / total : 0;
	const dashOffset = CIRCUMFERENCE * (1 - progress);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap: 16,
			padding: '20px 16px',
			background: finished ? 'rgba(0, 204, 68, 0.06)' : 'var(--bg-secondary)',
			border: `1px solid ${finished ? 'var(--success)' : 'var(--border)'}`,
			borderRadius: 'var(--radius-lg)',
			transition: 'all 0.3s',
		}}>
			{/* Label */}
			<div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
				{finished ? 'Rest complete!' : running ? 'Resting...' : 'Rest Timer — drag time to adjust'}
			</div>

			{/* Circular progress with swipeable time inside */}
			<div style={{ position: 'relative', width: 130, height: 130 }}>
				<svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
					<circle
						cx="65" cy="65" r={RADIUS}
						fill="none"
						stroke="var(--bg-tertiary)"
						strokeWidth="6"
					/>
					<circle
						cx="65" cy="65" r={RADIUS}
						fill="none"
						stroke={finished ? 'var(--success)' : 'var(--primary)'}
						strokeWidth="6"
						strokeLinecap="round"
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={dashOffset}
						style={{ transition: running ? 'stroke-dashoffset 0.5s linear' : 'stroke-dashoffset 0.3s ease' }}
					/>
				</svg>

				<div style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: finished ? 'var(--success)' : 'var(--text-primary)',
				}}>
					{running ? (
						<div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>
							{Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
						</div>
					) : (
						<SwipeTimeAdjust
							value={finished ? total : remaining}
							onChange={handleTimeChange}
							disabled={false}
						/>
					)}
				</div>
			</div>

			{/* Controls row: -15s | +15s | Action */}
			<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
				<button onClick={() => { restTimerAdjust(-15); const s = getRestTimerState(); setRemaining(s.remaining); setTotal(s.total); }} style={adjustBtnStyle}>
					<Minus size={14} /> 15s
				</button>
				<button onClick={() => { restTimerAdjust(+15); const s = getRestTimerState(); setRemaining(s.remaining); setTotal(s.total); }} style={adjustBtnStyle}>
					<Plus size={14} /> 15s
				</button>

				{finished ? (
					<button onClick={reset} style={actionBtnStyle('var(--primary)')}>
						Restart
					</button>
				) : running ? (
					<>
						<button onClick={pause} style={actionBtnStyle('var(--bg-tertiary)')}>
							<Pause size={16} /> Pause
						</button>
						<button onClick={skip} style={actionBtnStyle('var(--bg-tertiary)')}>
							<SkipForward size={16} /> Skip
						</button>
					</>
				) : (
					<button onClick={remaining > 0 ? start : reset} style={actionBtnStyle('var(--primary)')}>
						<Play size={16} /> {remaining > 0 && remaining < total ? 'Resume' : 'Start'}
					</button>
				)}
			</div>
		</div>
	);
}

const adjustBtnStyle: React.CSSProperties = {
	padding: '8px 12px', borderRadius: 'var(--radius-full)',
	border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
	color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
	cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
};

function actionBtnStyle(bg: string): React.CSSProperties {
	return {
		display: 'flex',
		alignItems: 'center',
		gap: 6,
		padding: '10px 20px',
		borderRadius: 'var(--radius-full)',
		border: 'none',
		background: bg,
		color: bg === 'var(--primary)' ? 'var(--btn-text)' : 'var(--text-primary)',
		fontSize: '14px',
		fontWeight: 700,
		cursor: 'pointer',
	};
}

export default RestTimer;
