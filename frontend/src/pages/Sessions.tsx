import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Calendar, Clock, History, HelpCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';


export default function Sessions() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [showHelp, setShowHelp] = useState(false);

	// Load routines to find favorite
	const routines = useLiveQuery(() => db.routines.toArray());

	// Load sessions for history and current status
	// We need all sessions to determine next up, but limit history display
	const sessions = useLiveQuery(() => db.sessions.orderBy('started_at').reverse().toArray());




	if (!routines || !sessions) return <div className="container">{t('Loading...')}</div>;

	// Determine Active Routine (Favorite or First — skip archived)
	const nonArchivedRoutines = routines.filter(r => !r.archived_at);
	const activeRoutine = nonArchivedRoutines.find(r => r.is_favorite) || nonArchivedRoutines[0];

	// Determine "Up Next"
	let nextSessionCard = null;
	if (activeRoutine) {
		// Check for incomplete active session
		const activeSession = sessions.find(s => !s.completed_at && s.routine_id === activeRoutine.id);

		if (activeSession) {
			// Resume
			const dayName = activeRoutine.days[activeSession.day_index || 0]?.day_name || `Day ${(activeSession.day_index || 0) + 1}`;

			const discardAndStartNew = async () => {
				if (!confirm(t("Are you sure you want to discard your in-progress session and start a new one?"))) return;

				// Delete previous incomplete session and its sets
				await db.sets.where('session_id').equals(activeSession.id!).delete();
				await db.sessions.delete(activeSession.id!);

				// Calculate next day for new session
				const completedSessions = sessions.filter(s => s.completed_at && s.routine_id === activeRoutine.id);
				const lastSession = completedSessions[0];
				let nextDayIndex = 0;
				if (activeRoutine.days && activeRoutine.days.length > 0) {
					if (lastSession && typeof lastSession.day_index === 'number') {
						nextDayIndex = (lastSession.day_index + 1) % activeRoutine.days.length;
					}
				}

				if (!activeRoutine.days || activeRoutine.days.length === 0) return;

				const id = await db.sessions.add({
					user_id: activeRoutine.user_id,
					routine_id: activeRoutine.id,
					day_index: nextDayIndex,
					started_at: new Date().toISOString(),
					syncStatus: 'created',
					locked_exercises: []
				});
				navigate(`/sessions/${id}`);
			};

			nextSessionCard = (
				<div className="card" style={{ borderLeft: '4px solid var(--accent)', background: 'linear-gradient(to right, rgba(0,255,255,0.05), transparent)' }}>
					<h2 className="text-lg font-bold mb-2 flex items-center gap-2">
						<Play size={20} className="text-accent" fill="currentColor" />
						{t('Resume Workout')}
					</h2>
					<div className="mb-4">
						<div className="text-xl font-semibold">{activeRoutine.name}</div>
						<div className="text-secondary">{dayName}</div>
						<div className="text-xs text-tertiary mt-2">
							Started {new Date(activeSession.started_at).toLocaleString()}
						</div>
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => navigate(`/sessions/${activeSession.id}`)}
							className="btn btn-primary flex-1"
						>
							{t('Resume Session')}
						</button>
						<button
							onClick={discardAndStartNew}
							className="btn btn-secondary flex-1"
						>
							{t('Start New')}
						</button>
					</div>
				</div>
			);
		} else {
			// Calculate next day
			// Find most recent completed session for this routine
			const completedSessions = sessions.filter(s => s.completed_at && s.routine_id === activeRoutine.id);
			// sessions is already sorted by started_at reverse (newest first)
			const lastSession = completedSessions[0];

			let nextDayIndex = 0;
			if (activeRoutine.days && activeRoutine.days.length > 0) {
				if (lastSession && typeof lastSession.day_index === 'number') {
					nextDayIndex = (lastSession.day_index + 1) % activeRoutine.days.length;
				}
			}

			const nextDay = activeRoutine.days?.[nextDayIndex];

			const startSession = async () => {
				if (!activeRoutine.days || activeRoutine.days.length === 0) return;

				const id = await db.sessions.add({
					user_id: activeRoutine.user_id,
					routine_id: activeRoutine.id,
					day_index: nextDayIndex,
					started_at: new Date().toISOString(),
					syncStatus: 'created',
					locked_exercises: []
				});
				navigate(`/sessions/${id}`);
			};

			if (activeRoutine.days && activeRoutine.days.length > 0) {
				nextSessionCard = (
					<div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'linear-gradient(to right, rgba(204, 255, 0, 0.05), transparent)' }}>
						<h2 className="text-lg font-bold mb-2 flex items-center gap-2">
							<Play size={20} className="text-primary" fill="currentColor" />
							{t("Up Next")}
						</h2>
						<div className="mb-4">
							<div className="text-sm text-primary uppercase tracking-wider mb-1">{activeRoutine.name}</div>
							<div className="text-xl font-semibold mb-1">{nextDay?.day_name || `Day ${nextDayIndex + 1}`}</div>
							<div className="text-sm text-secondary">
								{nextDay?.exercises.length || 0} {t('exercises')}
							</div>
						</div>
						<button
							onClick={startSession}
							className="btn btn-primary w-full"
						>
							{t('Start Workout')}
						</button>
					</div>
				);
			} else {
				nextSessionCard = (
					<div className="card text-center p-8 text-tertiary">
						{t('Routine has no days configured.')}
					</div>
				);
			}
		}
	} else {
		// No routines at all
		nextSessionCard = (
			<div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
				<h3 className="text-lg font-semibold mb-2">{t('No active routine')}</h3>
				<p className="text-secondary mb-4">{t('Create a routine to start tracking your workouts.')}</p>
				<Link to="/routines/new" className="btn btn-primary">
					{t('Create Routine')}
				</Link>
			</div>
		);
	}

	// History List (Completed sessions)
	const historySessions = sessions.filter(s => !!s.completed_at);

	return (
		<div className="container" style={{ paddingBottom: '80px' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
				<h1 className="text-2xl font-bold">{t('Sessions')}</h1>
				<button className="btn btn-ghost" onClick={() => setShowHelp(!showHelp)} style={{ padding: '4px' }}>
					<HelpCircle size={18} color="var(--text-tertiary)" />
				</button>
			</div>

			{showHelp && (
				<div style={{
					background: 'var(--bg-tertiary)',
					padding: '12px 16px',
					borderRadius: '8px',
					fontSize: '13px',
					color: 'var(--text-secondary)',
					border: '1px solid rgba(99, 102, 241, 0.3)',
					marginBottom: '16px',
					lineHeight: '1.6',
					position: 'relative'
				}}>
					<button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
						<X size={14} />
					</button>
					<strong style={{ color: 'var(--text-primary)' }}>{t('How sessions work')}</strong><br />
					{t('A session is one workout. Your active routine determines what\'s "Up Next".')}<br />
					{t('Sessions cycle through each day of your routine automatically.')}<br />
					{t('If you have an unfinished session, you can resume or discard it.')}<br />
					{t('Completed sessions appear in the History below.')}
				</div>
			)}

			<h3 className="section-title text-sm font-semibold text-secondary uppercase tracking-wider mb-3 px-1">{t('Current')}</h3>
			{nextSessionCard}

			<h3 className="section-title text-sm font-semibold text-secondary uppercase tracking-wider mb-3 mt-8 px-1 flex items-center gap-2">
				<History size={16} />
				{t('History')}
			</h3>

			{historySessions.length === 0 ? (
				<div className="text-center text-tertiary py-8 text-sm">
					{t('No completed sessions yet.')}
				</div>
			) : (
				<div className="grid gap-3">
					{historySessions.map(session => {
						const routine = routines.find(r => r.id === session.routine_id);
						const dayName = routine?.days[session.day_index || 0]?.day_name || t('Unknown Day');
						const date = new Date(session.completed_at!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
						const duration = session.started_at && session.completed_at
							? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
							: 0;

						return (
							<Link
								key={session.id}
								to={`/sessions/${session.id}`}
								className="card hover:bg-white/5 transition-colors"
								style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}
							>
								<div>
									<div className="font-semibold text-white mb-1">
										{routine?.name || t('Unknown Routine')}
									</div>
									<div className="text-sm text-secondary">
										{dayName}
									</div>
								</div>
								<div className="text-right flex flex-col items-end gap-1">
									<div className="flex items-center gap-1.5 text-xs text-secondary bg-white/5 px-2 py-1 rounded">
										<Calendar size={12} />
										{date}
									</div>
									{duration > 0 && (
										<div className="flex items-center gap-1.5 text-xs text-tertiary">
											<Clock size={12} />
											{duration} min
										</div>
									)}
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
