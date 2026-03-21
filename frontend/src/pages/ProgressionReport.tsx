import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, TrendingUp, Minus, TrendingDown, Check, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';

interface ReportSuggestion {
	type: string;
	current: Record<string, any>;
	suggested: Record<string, any>;
	reason: string;
	confidence: number;
	new_exercise_id?: number;
	new_exercise_name?: string;
	ai_note?: string;
	ai_alternative?: { exercise_id: number; name: string; reason: string } | null;
}

interface ReportData {
	report_id: number;
	routine_name: string;
	overall_assessment: string;
	periodization_note: string | null;
	days: Record<string, Record<string, ReportSuggestion>>;
}

export default function ProgressionReport() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const [report, setReport] = useState<ReportData | null>(null);
	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [appliedExercises, setAppliedExercises] = useState<Set<string>>(new Set());
	const [exerciseNames, setExerciseNames] = useState<Map<number, string>>(new Map());
	const [reportAge, setReportAge] = useState<string | null>(null);
	const [reportsRemaining, setReportsRemaining] = useState<number | null>(null);
	const [maxPerWeek, setMaxPerWeek] = useState(3);
	const [showConfirm, setShowConfirm] = useState(false);

	const routine = useLiveQuery(async () => {
		if (!id) return null;
		return await db.routines.get(parseInt(id));
	}, [id]);

	// Load exercise names for ID resolution
	useEffect(() => {
		db.exercises.toArray().then(exercises => {
			const currentLang = i18n.language.split('-')[0];
			const map = new Map<number, string>();
			exercises.forEach((ex: any) => {
				map.set(ex.id, ex.name_translations?.[currentLang] || ex.name);
			});
			setExerciseNames(map);
		});
	}, [i18n.language]);

	// Load last saved report on mount (GET, no rate limit)
	useEffect(() => {
		if (!id) return;
		setLoading(true);
		api.get(`/progression/report/${id}`)
			.then(res => {
				setReportsRemaining(res.data.reports_remaining);
				setMaxPerWeek(res.data.max_per_week);
				if (res.data.report) {
					setReport(res.data.report);
					if (res.data.report.created_at) {
						const created = new Date(res.data.report.created_at);
						const mins = Math.round((Date.now() - created.getTime()) / 60000);
						if (mins < 60) setReportAge(`${mins}m ago`);
						else if (mins < 1440) setReportAge(`${Math.round(mins / 60)}h ago`);
						else setReportAge(`${Math.round(mins / 1440)}d ago`);
					}
				}
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [id]);

	const confirmGenerate = () => {
		setShowConfirm(true);
	};

	const generateReport = () => {
		if (!id || generating) return;
		setShowConfirm(false);
		setGenerating(true);
		setError(null);
		api.post(`/progression/report/${id}`)
			.then(res => {
				setReport(res.data);
				setReportAge('just now');
				if (reportsRemaining !== null) setReportsRemaining(Math.max(0, reportsRemaining - 1));
			})
			.catch(e => {
				if (e?.response?.status === 429) {
					setReportsRemaining(0);
					setError('No reports remaining this week.');
				} else {
					setError(e?.response?.data?.detail || 'Failed to generate report');
				}
			})
			.finally(() => setGenerating(false));
	};

	const getExerciseName = (exId: string | number): string => {
		return exerciseNames.get(Number(exId)) || `Exercise #${exId}`;
	};

	const trendIcon = (suggestion: ReportSuggestion) => {
		if (suggestion.type === 'weight_increase' || suggestion.type === 'bw_progression' || suggestion.type === 'cardio_increase' || suggestion.type === 'rep_increase') {
			return <TrendingUp size={16} color="var(--success, #22c55e)" />;
		}
		if (suggestion.type === 'deload') {
			return <TrendingDown size={16} color="#f59e0b" />;
		}
		if (suggestion.type === 'exercise_swap') {
			return <AlertTriangle size={16} color="#ef4444" />;
		}
		return <Minus size={16} color="var(--text-tertiary)" />;
	};

	const typeLabel = (type: string) => {
		const labels: Record<string, string> = {
			weight_increase: 'Weight Increase',
			rep_increase: 'Rep Increase',
			deload: 'Deload Recommended',
			exercise_swap: 'Consider Swapping',
			bw_progression: 'Next Progression',
			cardio_increase: 'Cardio Progression',
		};
		return labels[type] || type;
	};

	const applySuggestion = async (dayName: string, exIdStr: string, suggestion: ReportSuggestion, useAlternative?: boolean) => {
		const key = `${dayName}-${exIdStr}`;
		if (appliedExercises.has(key) || !routine) return;

		const updatedDays = JSON.parse(JSON.stringify(routine.days));
		const exId = Number(exIdStr);

		for (const day of updatedDays) {
			if (day.day_name === dayName) {
				const routineEx = day.exercises.find((e: any) => e.exercise_id === exId);
				if (routineEx) {
					if (useAlternative && suggestion.ai_alternative?.exercise_id) {
						// Apply the AI alternative exercise
						routineEx.exercise_id = suggestion.ai_alternative.exercise_id;
					} else {
						// Apply the main suggestion
						if (suggestion.suggested.weight !== undefined) routineEx.weight_kg = suggestion.suggested.weight;
						if (suggestion.suggested.reps !== undefined) routineEx.reps = String(suggestion.suggested.reps);
						if (suggestion.suggested.sets !== undefined) routineEx.sets = suggestion.suggested.sets;
						if (suggestion.new_exercise_id) {
							routineEx.exercise_id = suggestion.new_exercise_id;
						}
					}
				}
			}
		}

		try {
			await api.put(`/routines/${routine.id}`, { days: updatedDays });
			await db.routines.update(routine.id!, { days: updatedDays, syncStatus: 'updated' as any });
		} catch { /* offline */ }

		// Also update current active session if any
		try {
			const activeSessions = await db.sessions
				.where('routine_id')
				.equals(routine.id!)
				.filter(s => !s.completed_at)
				.toArray();

			for (const sess of activeSessions) {
				const sessExId = Number(exIdStr);
				const setsToUpdate = await db.sets
					.where('session_id')
					.equals(sess.id!)
					.filter(s => s.exercise_id === sessExId)
					.toArray();

				for (const s of setsToUpdate) {
					const updates: any = { syncStatus: 'updated' };
					if (suggestion.suggested.weight !== undefined) updates.weight_kg = suggestion.suggested.weight;
					if (suggestion.suggested.reps !== undefined) {
						const repsVal = typeof suggestion.suggested.reps === 'string'
							? parseInt(suggestion.suggested.reps.split('-')[0]) || 0
							: suggestion.suggested.reps;
						updates.reps = repsVal;
					}
					await db.sets.update(s.id!, updates);
				}
			}
		} catch { /* best effort */ }

		// Feedback
		api.post('/progression/feedback', {
			report_id: report?.report_id,
			exercise_id: exId,
			suggestion_type: useAlternative ? 'ai_alternative' : suggestion.type,
			suggested_value: useAlternative ? suggestion.ai_alternative : suggestion.suggested,
			action: 'accepted',
			applied_value: useAlternative ? suggestion.ai_alternative : suggestion.suggested,
		}).catch(() => {});

		setAppliedExercises(prev => new Set([...prev, key]));
	};

	const applyAll = () => {
		if (!report) return;
		for (const [dayName, exercises] of Object.entries(report.days)) {
			for (const [exId, suggestion] of Object.entries(exercises)) {
				const key = `${dayName}-${exId}`;
				if (!appliedExercises.has(key)) {
					applySuggestion(dayName, exId, suggestion);
				}
			}
		}
	};

	if (loading) {
		return (
			<div className="container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
				<Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
				<p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading report...</p>
			</div>
		);
	}

	if (generating) {
		return (
			<div className="container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px', textAlign: 'center' }}>
				<TrendingUp size={48} style={{ color: 'var(--accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
				<h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Generating progression report...</h2>
				<p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>Analysing your session history and consulting AI</p>
				<style>
					{`
					@keyframes fakeProgress {
						0% { width: 0%; }
						10% { width: 30%; }
						40% { width: 70%; }
						100% { width: 95%; }
					}
					@keyframes pulse {
						0%, 100% { opacity: 1; }
						50% { opacity: 0.5; }
					}
					`}
				</style>
				<div style={{ width: '80%', height: '6px', backgroundColor: 'var(--bg-tertiary, #222)', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
					<div style={{
						height: '100%',
						backgroundColor: 'var(--accent)',
						animation: 'fakeProgress 15s cubic-bezier(0.1, 0.8, 0.2, 1) forwards',
						borderRadius: '3px',
					}} />
				</div>
			</div>
		);
	}

	const remainingLabel = reportsRemaining !== null
		? `${reportsRemaining}/${maxPerWeek} reports remaining this week`
		: '';

	if (!report && !error) {
		// No saved report — show generate button
		return (
			<div className="container fade-in">
				<button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '16px' }}>
					<ArrowLeft size={20} /> Back
				</button>
				<div className="card" style={{ textAlign: 'center', padding: '32px' }}>
					<TrendingUp size={32} color="var(--accent)" style={{ marginBottom: '12px' }} />
					<p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Progression Report</p>
					<p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
						Analyse your session history and get AI-powered suggestions for weight, reps, and exercise changes.
					</p>
					{remainingLabel && (
						<p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginBottom: '16px' }}>{remainingLabel}</p>
					)}
					<button
						className="btn btn-primary"
						onClick={generateReport}
						disabled={generating}
						style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
					>
						{generating ? (
							<><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
						) : (
							'Generate Report'
						)}
					</button>
				</div>
			</div>
		);
	}

	if (error && !report) {
		return (
			<div className="container fade-in">
				<button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '16px' }}>
					<ArrowLeft size={20} /> Back
				</button>
				<div className="card" style={{ textAlign: 'center', padding: '32px' }}>
					<AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
					<p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Failed to generate report</p>
					<p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{error}</p>
					{remainingLabel && (
						<p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '8px' }}>{remainingLabel}</p>
					)}
					<button className="btn btn-primary" onClick={generateReport} disabled={generating} style={{ marginTop: '16px' }}>
						{generating ? 'Generating...' : 'Try Again'}
					</button>
				</div>
			</div>
		);
	}

	if (!report) return null;

	const totalSuggestions = Object.values(report.days).reduce(
		(acc, day) => acc + Object.keys(day).length, 0
	);

	return (
		<div className="container fade-in" style={{ paddingBottom: '80px' }}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
				<div style={{ display: 'flex', alignItems: 'center' }}>
					<button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ paddingLeft: 0 }}>
						<ArrowLeft size={24} />
					</button>
					<div>
						<h2 style={{ margin: 0, fontSize: '18px' }}>Progression Report</h2>
						<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
							{report.routine_name}
							{reportAge && <> &middot; {reportAge}</>}
						</span>
					</div>
				</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
					<button
						className="btn btn-ghost"
						onClick={confirmGenerate}
						disabled={generating}
						title={reportsRemaining !== null ? `Regenerate (${reportsRemaining} left this week)` : 'Regenerate report'}
						style={{ padding: '8px', display: 'flex', alignItems: 'center' }}
					>
						<RefreshCw size={16} style={generating ? { animation: 'spin 1s linear infinite' } : undefined} />
					</button>
					{totalSuggestions > 0 && (
						<button
							className="btn btn-primary"
							onClick={applyAll}
							style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
						>
							<Check size={14} /> Apply All ({totalSuggestions})
						</button>
					)}
				</div>
			</div>

			{/* Inline error when regeneration fails but cached report is showing */}
			{error && (
				<div className="card" style={{ marginBottom: '16px', borderLeft: '3px solid #ef4444', padding: '10px 16px' }}>
					<p style={{ margin: 0, fontSize: '13px', color: '#ef4444' }}>{error}</p>
				</div>
			)}

			{/* Overall Assessment */}
			<div className="card" style={{ marginBottom: '16px', borderLeft: '3px solid var(--accent)' }}>
				<h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--accent)' }}>Overall Assessment</h3>
				<p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
					{report.overall_assessment}
				</p>
			</div>

			{/* Periodization Note */}
			{report.periodization_note && (
				<div className="card" style={{ marginBottom: '16px', borderLeft: '3px solid #f59e0b' }}>
					<h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f59e0b' }}>Periodization</h3>
					<p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
						{report.periodization_note}
					</p>
				</div>
			)}

			{/* Per-Day Exercise Breakdown */}
			{Object.entries(report.days).map(([dayName, exercises]) => (
				<div key={dayName} style={{ marginBottom: '20px' }}>
					<h3 style={{ fontSize: '16px', marginBottom: '10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border, #333)', paddingBottom: '6px' }}>
						{dayName}
					</h3>
					<div style={{ display: 'grid', gap: '10px' }}>
						{Object.entries(exercises).map(([exId, suggestion]) => {
							const key = `${dayName}-${exId}`;
							const isApplied = appliedExercises.has(key);

							return (
								<div key={exId} className="card" style={{
									padding: '12px 16px',
									borderLeft: `3px solid ${
										suggestion.type === 'deload' ? '#f59e0b'
										: suggestion.type === 'exercise_swap' ? '#ef4444'
										: 'var(--accent)'
									}`,
									opacity: isApplied ? 0.6 : 1,
								}}>
									{/* Exercise header */}
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											{trendIcon(suggestion)}
											<span style={{ fontWeight: 600, fontSize: '14px' }}>{getExerciseName(exId)}</span>
										</div>
										<span style={{
											fontSize: '11px',
											fontWeight: 600,
											textTransform: 'uppercase',
											padding: '2px 8px',
											borderRadius: '4px',
											background: suggestion.type === 'deload' ? 'rgba(245,158,11,0.15)' : suggestion.type === 'exercise_swap' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
											color: suggestion.type === 'deload' ? '#f59e0b' : suggestion.type === 'exercise_swap' ? '#ef4444' : 'var(--accent)',
										}}>
											{typeLabel(suggestion.type)}
										</span>
									</div>

									{/* Reason */}
									<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
										{suggestion.reason}
									</p>

									{/* AI Note */}
									{suggestion.ai_note && (
										<p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '0 0 6px 0', fontStyle: 'italic' }}>
											Coach note: {suggestion.ai_note}
										</p>
									)}

									{/* AI Alternative */}
									{suggestion.ai_alternative && (
										<div style={{ fontSize: '12px', color: 'var(--accent)', margin: '0 0 8px 0' }}>
											Alternative: <strong>{suggestion.ai_alternative.name}</strong> — {suggestion.ai_alternative.reason}
										</div>
									)}

									{/* Actions */}
									{!isApplied ? (
										<div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
											<button
												onClick={() => applySuggestion(dayName, exId, suggestion)}
												style={{
													background: 'var(--accent)',
													color: '#fff',
													border: 'none',
													padding: '5px 14px',
													borderRadius: '6px',
													fontSize: '12px',
													fontWeight: 600,
													cursor: 'pointer',
													display: 'flex',
													alignItems: 'center',
													gap: '4px',
												}}
											>
												<Check size={12} /> Apply
											</button>
											{suggestion.ai_alternative && (
												<button
													onClick={() => applySuggestion(dayName, exId, suggestion, true)}
													style={{
														background: 'none',
														color: 'var(--accent)',
														border: '1px solid var(--accent)',
														padding: '5px 14px',
														borderRadius: '6px',
														fontSize: '12px',
														fontWeight: 600,
														cursor: 'pointer',
														display: 'flex',
														alignItems: 'center',
														gap: '4px',
													}}
												>
													<Check size={12} /> Use Alternative
												</button>
											)}
											<button
												onClick={() => {
													api.post('/progression/feedback', {
														report_id: report.report_id,
														exercise_id: Number(exId),
														suggestion_type: suggestion.type,
														suggested_value: suggestion.suggested,
														action: 'rejected',
													}).catch(() => {});
													setAppliedExercises(prev => new Set([...prev, key]));
												}}
												className="btn btn-ghost"
												style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px' }}
											>
												Dismiss
											</button>
										</div>
									) : (
										<span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
											Applied
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			))}

			{totalSuggestions === 0 && (
				<div className="card" style={{ textAlign: 'center', padding: '32px' }}>
					<TrendingUp size={32} color="var(--success)" style={{ marginBottom: '12px' }} />
					<p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Looking good!</p>
					<p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
						No progression changes needed right now. Keep training consistently!
					</p>
				</div>
			)}

			{/* Confirmation dialog */}
			{showConfirm && (
				<div style={{
					position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
					display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
				}} onClick={() => setShowConfirm(false)}>
					<div className="card" style={{ maxWidth: '340px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
						{reportsRemaining === 0 ? (
							<>
								<AlertTriangle size={24} color="#f59e0b" style={{ marginBottom: '12px' }} />
								<p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No reports left this week</p>
								<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
									You've used all {maxPerWeek} reports for this week. New reports will be available next week.
								</p>
								<button className="btn btn-ghost" onClick={() => setShowConfirm(false)} style={{ padding: '8px 20px' }}>
									Got it
								</button>
							</>
						) : (
							<>
								<RefreshCw size={24} color="var(--accent)" style={{ marginBottom: '12px' }} />
								<p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Regenerate report?</p>
								<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
									This will generate a fresh AI-powered analysis using your latest session data.
								</p>
								<p style={{ fontSize: '12px', color: reportsRemaining === 1 ? '#f59e0b' : 'var(--text-tertiary)', margin: '0 0 16px 0' }}>
									{remainingLabel}
								</p>
								<div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
									<button className="btn btn-ghost" onClick={() => setShowConfirm(false)} style={{ padding: '8px 20px' }}>
										Cancel
									</button>
									<button className="btn btn-primary" onClick={generateReport} style={{ padding: '8px 20px' }}>
										Generate
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
