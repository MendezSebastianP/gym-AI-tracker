import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { getStopwatchState, stopwatchStart, stopwatchPause, stopwatchReset } from '../store/timerStore';

export function Stopwatch() {
	const initial = getStopwatchState();
	const [elapsed, setElapsed] = useState(initial.elapsed);
	const [running, setRunning] = useState(initial.running);

	useEffect(() => {
		if (!running) return;
		const tick = () => setElapsed(getStopwatchState().elapsed);
		tick();
		const id = setInterval(tick, 500);
		return () => clearInterval(id);
	}, [running]);

	const hours = Math.floor(elapsed / 3600);
	const minutes = Math.floor((elapsed % 3600) / 60);
	const seconds = elapsed % 60;

	const RADIUS = 54;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const progress = (elapsed % 60) / 60;
	const dashOffset = CIRCUMFERENCE * (1 - progress);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap: 16,
			padding: '20px 16px',
			background: 'var(--bg-secondary)',
			border: '1px solid var(--border)',
			borderRadius: 'var(--radius-lg)',
		}}>
			<div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
				{running ? 'Stopwatch running...' : elapsed > 0 ? 'Stopwatch paused' : 'Stopwatch'}
			</div>

			<div style={{ position: 'relative', width: 130, height: 130 }}>
				<svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
					<circle cx="65" cy="65" r={RADIUS} fill="none" stroke="var(--bg-tertiary)" strokeWidth="6" />
					<circle
						cx="65" cy="65" r={RADIUS}
						fill="none"
						stroke={running ? 'var(--accent, #6366f1)' : 'var(--text-tertiary)'}
						strokeWidth="6"
						strokeLinecap="round"
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={dashOffset}
						style={{ transition: running ? 'stroke-dashoffset 0.5s linear' : 'stroke-dashoffset 0.3s ease' }}
					/>
				</svg>

				<div style={{
					position: 'absolute', inset: 0,
					display: 'flex', alignItems: 'center', justifyContent: 'center',
				}}>
					<div style={{
						fontSize: '32px', fontWeight: 800, letterSpacing: '-1px',
						color: running ? 'var(--accent, #6366f1)' : 'var(--text-primary)',
					}}>
						{hours > 0
							? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
							: `${minutes}:${seconds.toString().padStart(2, '0')}`
						}
					</div>
				</div>
			</div>

			<div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
				{elapsed > 0 && !running && (
					<button onClick={() => { stopwatchReset(); setElapsed(0); }} style={btnStyle('var(--bg-tertiary)')}>
						<RotateCcw size={16} /> Reset
					</button>
				)}
				<button
					onClick={() => {
						if (running) { stopwatchPause(); setRunning(false); }
						else { stopwatchStart(); setRunning(true); }
					}}
					style={btnStyle(running ? 'var(--bg-tertiary)' : 'var(--accent, #6366f1)')}
				>
					{running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> {elapsed > 0 ? 'Resume' : 'Start'}</>}
				</button>
			</div>
		</div>
	);
}

function btnStyle(bg: string): React.CSSProperties {
	const isAccent = bg.includes('accent') || bg.includes('6366f1');
	return {
		display: 'flex', alignItems: 'center', gap: 6,
		padding: '8px 16px', borderRadius: 'var(--radius-full)',
		border: 'none', background: bg,
		color: isAccent ? 'white' : 'var(--text-primary)',
		fontSize: '14px', fontWeight: 700, cursor: 'pointer',
	};
}

export default Stopwatch;
