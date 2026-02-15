import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface WorkoutTimerProps {
	mode: 'stopwatch' | 'timer';
	startTime: number; // timestamp when session started
}

export default function WorkoutTimer({ mode, startTime: _startTime }: WorkoutTimerProps) {
	// Stopwatch state: track accumulated time + whether currently running
	const [isRunning, setIsRunning] = useState(false); // Start paused
	const [accumulatedTime, setAccumulatedTime] = useState(0);
	const lastTickRef = useRef<number | null>(null);

	// Timer mode state — default 1 min (60s)
	const [timerDuration, setTimerDuration] = useState(60);
	const [timerRemaining, setTimerRemaining] = useState(60);

	// Stopwatch mode: properly track elapsed time accounting for pauses
	useEffect(() => {
		if (mode !== 'stopwatch') return;

		if (isRunning) {
			lastTickRef.current = Date.now();
			const interval = setInterval(() => {
				const now = Date.now();
				const delta = Math.floor((now - (lastTickRef.current || now)) / 1000);
				if (delta > 0) {
					setAccumulatedTime((prev: number) => prev + delta);
					lastTickRef.current = now;
				}
			}, 1000);
			return () => clearInterval(interval);
		} else {
			lastTickRef.current = null;
		}
	}, [mode, isRunning]);

	// Timer mode: countdown
	useEffect(() => {
		if (mode === 'timer' && isRunning && timerRemaining > 0) {
			const interval = setInterval(() => {
				setTimerRemaining((prev: number) => {
					if (prev <= 1) {
						setIsRunning(false);
						if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [mode, isRunning, timerRemaining]);

	const formatTime = (seconds: number) => {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const toggleRunning = () => {
		setIsRunning(!isRunning);
	};

	const resetTimer = () => {
		if (mode === 'timer') {
			setTimerRemaining(timerDuration);
			setIsRunning(false);
		}
	};

	const resetStopwatch = () => {
		setAccumulatedTime(0);
		setIsRunning(false);
		lastTickRef.current = null;
	};

	const adjustTimer = (delta: number) => {
		if (isRunning) return;
		const newDuration = Math.max(10, timerDuration + delta);
		setTimerDuration(newDuration);
		setTimerRemaining(newDuration);
	};

	if (mode === 'stopwatch') {
		return (
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
				<div style={{
					fontFamily: 'monospace',
					fontSize: '18px',
					fontWeight: 'bold',
					color: isRunning ? 'var(--accent)' : 'var(--text-secondary)',
					minWidth: '80px'
				}}>
					{formatTime(accumulatedTime)}
				</div>
				<button
					className="btn btn-ghost p-2"
					onClick={toggleRunning}
					style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
				>
					{isRunning ? <Pause size={16} /> : <Play size={16} />}
				</button>
				{accumulatedTime > 0 && !isRunning && (
					<button
						className="btn btn-ghost p-2"
						onClick={resetStopwatch}
						style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
					>
						<RotateCcw size={14} />
					</button>
				)}
			</div>
		);
	}

	// Timer mode with --, -, time, +, ++ buttons
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
				{/* -- button: -1 minute */}
				<button
					className="btn btn-ghost"
					onClick={() => adjustTimer(-60)}
					disabled={isRunning}
					style={{ padding: '4px 6px', fontSize: '11px', minWidth: '28px', fontWeight: 'bold' }}
				>
					--
				</button>
				{/* - button: -10 seconds */}
				<button
					className="btn btn-ghost"
					onClick={() => adjustTimer(-10)}
					disabled={isRunning}
					style={{ padding: '4px 8px', fontSize: '13px', minWidth: '24px', fontWeight: 'bold' }}
				>
					-
				</button>
				<div style={{
					fontFamily: 'monospace',
					fontSize: '18px',
					fontWeight: 'bold',
					color: timerRemaining === 0 ? 'var(--success)' : 'var(--accent)',
					minWidth: '60px',
					textAlign: 'center'
				}}>
					{formatTime(timerRemaining)}
				</div>
				{/* + button: +10 seconds */}
				<button
					className="btn btn-ghost"
					onClick={() => adjustTimer(10)}
					disabled={isRunning}
					style={{ padding: '4px 8px', fontSize: '13px', minWidth: '24px', fontWeight: 'bold' }}
				>
					+
				</button>
				{/* ++ button: +1 minute */}
				<button
					className="btn btn-ghost"
					onClick={() => adjustTimer(60)}
					disabled={isRunning}
					style={{ padding: '4px 6px', fontSize: '11px', minWidth: '28px', fontWeight: 'bold' }}
				>
					++
				</button>
			</div>
			<div style={{ display: 'flex', gap: '4px' }}>
				<button
					className="btn btn-ghost p-2"
					onClick={toggleRunning}
					style={{ fontSize: '12px' }}
				>
					{isRunning ? <Pause size={14} /> : <Play size={14} />}
				</button>
				<button
					className="btn btn-ghost p-2"
					onClick={resetTimer}
					style={{ fontSize: '12px' }}
				>
					<RotateCcw size={14} />
				</button>
			</div>
		</div>
	);
}
