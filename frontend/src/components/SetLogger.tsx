import { useState } from 'react';
import { db } from '../db/schema';
import { Check } from 'lucide-react';

interface SetLoggerProps {
	sessionId: number;
	exerciseId: number;
	nextSetNumber: number;
	suggestedWeight?: number;
	suggestedReps?: number;
	isBodyweight?: boolean;
}

export default function SetLogger({
	sessionId,
	exerciseId,
	nextSetNumber,
	suggestedWeight = 0,
	suggestedReps = 0,
	isBodyweight = false
}: SetLoggerProps) {
	const [weight, setWeight] = useState(suggestedWeight);
	const [reps, setReps] = useState(suggestedReps || 8);
	const [saved, setSaved] = useState(false);

	const handleSave = async () => {
		await db.sets.add({
			session_id: sessionId,
			exercise_id: exerciseId,
			set_number: nextSetNumber,
			weight_kg: weight,
			reps: reps,
			completed_at: new Date().toISOString(),
			syncStatus: 'created'
		});
		setSaved(true);

		// Reset for next set or keep values? usually keep for next set
		setTimeout(() => setSaved(false), 2000);
	};

	return (
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
			<span style={{ width: '30px', fontWeight: 'bold', color: 'var(--primary)' }}>{nextSetNumber}</span>

			<span style={{ width: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>-</span>

			<div style={{ width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
				<input
					type="number"
					className="input"
					style={{ padding: '4px', textAlign: 'center', height: '32px' }}
					value={weight || ''}
					placeholder={isBodyweight ? "+0" : "kg"}
					onChange={e => setWeight(parseFloat(e.target.value) || 0)}
					step={0.25}
				/>
			</div>

			<div style={{ width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
				<input
					type="number"
					className="input"
					style={{ padding: '4px', textAlign: 'center', height: '32px' }}
					value={reps}
					onChange={e => setReps(parseInt(e.target.value) || 0)}
				/>
			</div>

			<button
				className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
				style={{ width: '40px', height: '32px', padding: 0 }}
				onClick={handleSave}
				disabled={saved}
			>
				<Check size={16} />
			</button>
		</div>
	);
}
