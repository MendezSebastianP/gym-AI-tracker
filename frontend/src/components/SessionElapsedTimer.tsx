import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface SessionElapsedTimerProps {
	startTime: string; // ISO string
}

export default function SessionElapsedTimer({ startTime }: SessionElapsedTimerProps) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const startMs = new Date(startTime).getTime();
		const update = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [startTime]);

	const hrs = Math.floor(elapsed / 3600);
	const mins = Math.floor((elapsed % 3600) / 60);
	const secs = elapsed % 60;
	const formatted = hrs > 0
		? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
		: `${mins}:${secs.toString().padStart(2, '0')}`;

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--primary)' }}>
			<Clock size={12} />
			<span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatted}</span>
		</div>
	);
}
