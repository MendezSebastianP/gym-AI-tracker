import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, ArrowRight, TrendingUp, Minus, TrendingDown, Check, Loader2, AlertTriangle, Sparkles, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import CoinIcon from '../components/icons/CoinIcon';

interface ReportSuggestion {
	type: string;
	current: Record<string, any>;
	suggested: Record<string, any>;
	reason: string;
	confidence: number;
	new_exercise_id?: number;
	new_exercise_name?: string;
	ai_note?: string;
}

interface ReportData {
	report_id: number;
	routine_name: string;
	overall_assessment: string;
	periodization_note: string | null;
	days: Record<string, Record<string, ReportSuggestion>>;
	created_at?: string;
}

export default function ProgressionReport() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { t: _t, i18n } = useTranslation();
	const location = useLocation();

	// ── Core state ──────────────────────────────────────────────────────────────
	const [panel, setPanel] = useState<'past' | 'new'>('new');
	const [generated, setGenerated] = useState(false);
	const [assessmentOpen, setAssessmentOpen] = useState(true);

	const [savedReport, setSavedReport] = useState<ReportData | null>(null);
	const [currentReport, setCurrentReport] = useState<ReportData | null>(null); // what's shown in new panel
	const [reportAge, setReportAge] = useState<string | null>(null);

	const [loading, setLoading] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [appliedPast, setAppliedPast] = useState(new Set<string>());
	const [appliedNew, setAppliedNew] = useState(new Set<string>());

	const [exerciseNames, setExerciseNames] = useState<Map<number, string>>(new Map());

	const [userContext, setUserContext] = useState((location.state as any)?.userContext || '');
	const [coinBalance, setCoinBalance] = useState<number | null>(null);

	useEffect(() => {
		api.get('/gamification/stats').then(res => {
			setCoinBalance(res.data.currency ?? 0);
		}).catch(() => {});
	}, []);

	const routine = useLiveQuery(async () => {
		if (!id) return null;
		return await db.routines.get(parseInt(id));
	}, [id]);

	const completedSessionsCount = useLiveQuery(async () => {
		if (!id) return 0;
		const sessions = await db.sessions.where('routine_id').equals(parseInt(id)).filter(s => !!s.completed_at).toArray();
		return sessions.length;
	}, [id]);

	const minSessionsRequired = routine?.days?.length || 1;
	const canGenerate = (completedSessionsCount || 0) >= minSessionsRequired;

	// ── Exercise name resolution ─────────────────────────────────────────────
	useEffect(() => {
		db.exercises.toArray().then(exercises => {
			const lang = i18n.language.split('-')[0];
			const map = new Map<number, string>();
			exercises.forEach((ex: any) => {
				map.set(ex.id, ex.name_translations?.[lang] || ex.name);
			});
			setExerciseNames(map);
		});
	}, [i18n.language]);

	const getExerciseName = (exId: string | number): string =>
		exerciseNames.get(Number(exId)) || `Exercise #${exId}`;

	// ── Load last saved report on mount ─────────────────────────────────────
	useEffect(() => {
		if (!id) return;
		setLoading(true);
		api.get(`/progression/report/${id}`)
			.then(res => {
				if (res.data.report) {
					const r = res.data.report as ReportData;
					setSavedReport(r);
					setPanel('past');
					if (r.created_at) {
						const mins = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
						if (mins < 60) setReportAge(`${mins}m ago`);
						else if (mins < 1440) setReportAge(`${Math.round(mins / 60)}h ago`);
						else setReportAge(`${Math.round(mins / 1440)}d ago`);
					}
				}
			})
			.catch(() => { })
			.finally(() => setLoading(false));
	}, [id]);

	// ── Generate ─────────────────────────────────────────────────────────────
	const canAfford = coinBalance === null || coinBalance >= 50;

	const generateReport = () => {
		if (!id || generating || !canGenerate || !canAfford) return;
		setGenerating(true);
		setError(null);
		api.post(`/progression/report/${id}`, { user_context: userContext.trim() || undefined })
			.then(res => {
				const r = res.data as ReportData;
				if (res.data.currency !== undefined) setCoinBalance(res.data.currency);
				setCurrentReport(r);
				setSavedReport(r);
				setReportAge('just now');
				setGenerated(true);
				setAppliedNew(new Set());
				setAssessmentOpen(true);
			})
			.catch(e => {
				if (e?.response?.status === 402) {
					setError(_t('Not enough coins.'));
				} else {
					setError(e?.response?.data?.detail || 'Failed to generate report');
				}
			})
			.finally(() => setGenerating(false));
	};

	// ── Apply suggestion ────────────────────────────────────────────────────
	const applySuggestion = async (
		dayName: string, exIdStr: string,
		suggestion: ReportSuggestion,
		reportData: ReportData,
		appliedSet: Set<string>,
		setApplied: (fn: (prev: Set<string>) => Set<string>) => void,
	) => {
		const key = `${dayName}-${exIdStr}`;
		if (appliedSet.has(key) || !routine) return;

		const updatedDays = JSON.parse(JSON.stringify(routine.days));
		const exId = Number(exIdStr);

		for (const day of updatedDays) {
			if (day.day_name === dayName) {
				const routineEx = day.exercises.find((e: any) => e.exercise_id === exId);
				if (routineEx) {
					if (suggestion.suggested.weight !== undefined) routineEx.weight_kg = suggestion.suggested.weight;
					if (suggestion.suggested.reps !== undefined) routineEx.reps = String(suggestion.suggested.reps);
					if (suggestion.suggested.sets !== undefined) routineEx.sets = suggestion.suggested.sets;
					if (suggestion.new_exercise_id) routineEx.exercise_id = suggestion.new_exercise_id;
				}
			}
		}

		try {
			await api.put(`/routines/${routine.id}`, { days: updatedDays });
			await db.routines.update(routine.id!, { days: updatedDays, syncStatus: 'updated' as any });

			// Sync suggestion to active draft session if it exists
			try {
				const activeSession = await db.sessions
					.where('routine_id').equals(routine.id!)
					.filter((s: any) => !s.completed_at).first();

				if (activeSession && activeSession.id) {
					const updates: any = { syncStatus: 'updated' };
					if (suggestion.suggested.weight !== undefined) updates.weight_kg = suggestion.suggested.weight;
					if (suggestion.suggested.reps !== undefined) {
						updates.reps = parseInt(String(suggestion.suggested.reps).split('-')[0]) || 0;
					}

					if (Object.keys(updates).length > 1) {
						const setsToUpdate = await db.sets
							.where('session_id').equals(activeSession.id)
							.filter((s: any) => s.exercise_id === exId).toArray();

						for (const s of setsToUpdate) {
							if (s.id) await db.sets.update(s.id, updates);
						}
					}
				}
			} catch { /* ignore session sync prep errors */ }
		} catch { /* offline */ }

		api.post('/progression/feedback', {
			report_id: reportData.report_id,
			exercise_id: exId,
			suggestion_type: suggestion.type,
			suggested_value: suggestion.suggested,
			action: 'accepted',
			applied_value: suggestion.suggested,
		}).catch(() => { });

		setApplied(prev => new Set([...prev, key]));
	};

	// ── Helpers ───────────────────────────────────────────────────────────────
	const typeColor = (type: string) =>
		type === 'deload' ? '#f59e0b' : type === 'exercise_swap' ? '#8b8cf8' : 'var(--primary)';

	const typeLabel = (s: ReportSuggestion) => {
		if (s.type === 'bw_progression' && s.new_exercise_name) return 'Next Progression';
		return ({
			weight_increase: '+Weight', rep_increase: '+Reps', deload: 'Deload',
			exercise_swap: 'Swap', bw_progression: '+Reps', cardio_increase: '+Cardio',
		}[s.type] || s.type);
	};

	const trendIcon = (type: string) => {
		if (['weight_increase', 'bw_progression', 'cardio_increase', 'rep_increase'].includes(type))
			return <TrendingUp size={15} color="var(--success, #22c55e)" />;
		if (type === 'deload') return <TrendingDown size={15} color="#f59e0b" />;
		if (type === 'exercise_swap') return <AlertTriangle size={15} color="#8b8cf8" />;
		return <Minus size={15} color="var(--text-tertiary)" />;
	};

	const confidenceLabel = (c: number) => c >= 0.85 ? 'High' : c >= 0.7 ? 'Med' : 'Low';
	const confidenceColor = (c: number) => c >= 0.85 ? 'var(--success, #22c55e)' : c >= 0.7 ? '#f59e0b' : 'var(--text-tertiary)';

	const formatChange = (s: ReportSuggestion) => {
		if (s.type === 'exercise_swap' && !s.new_exercise_name) return 'Consider replacement';
		const c = s.current; const g = s.suggested;
		const parts: string[] = [];
		if (c.weight !== undefined && g.weight !== undefined && c.weight !== g.weight) parts.push(`${c.weight}→${g.weight}kg`);
		if (c.sets !== undefined && g.sets !== undefined && c.sets !== g.sets) parts.push(`${c.sets}→${g.sets} sets`);
		if (c.reps !== undefined && g.reps !== undefined && c.reps !== g.reps) parts.push(`${c.reps}→${g.reps} reps`);
		return parts.join(' · ') || 'See details';
	};

	// ── Exercise card (shared between past and new panels) ────────────────────
	const ExerciseCard = ({
		dayName, exId, sug, appliedSet, setApplied, reportData,
	}: {
		dayName: string; exId: string; sug: ReportSuggestion;
		appliedSet: Set<string>; setApplied: (fn: (prev: Set<string>) => Set<string>) => void;
		reportData: ReportData;
	}) => {
		const isAppliedToRoutine = () => {
			if (!routine) return false;
			const day = routine.days.find((d: any) => d.day_name === dayName);
			if (!day) return false;

			if (sug.type === 'exercise_swap' || sug.new_exercise_id) {
				const oldEx = day.exercises.find((e: any) => String(e.exercise_id) === exId);
				const hasNewEx = day.exercises.some((e: any) => e.exercise_id === sug.new_exercise_id);
				if (!oldEx && hasNewEx) return true;
			} else {
				const ex = day.exercises.find((e: any) => String(e.exercise_id) === exId);
				if (!ex) return false; // Not swap, but missing?

				let matched = true;
				if (sug.suggested.weight !== undefined && ex.weight_kg !== sug.suggested.weight) matched = false;
				if (sug.suggested.reps !== undefined && ex.reps !== String(sug.suggested.reps)) matched = false;
				if (sug.suggested.sets !== undefined && ex.sets !== sug.suggested.sets) matched = false;
				if (matched) return true;
			}
			return false;
		};

		const key = `${dayName}-${exId}`;
		const done = appliedSet.has(key) || isAppliedToRoutine();
		const color = typeColor(sug.type);
		const applyTextColor = sug.type === 'exercise_swap' || sug.type === 'deload' ? '#fff' : '#000';

		return (
			<div style={{
				padding: '12px 14px', borderRadius: '10px', marginBottom: '8px',
				background: done ? 'rgba(34,197,94,0.04)' : 'var(--bg-secondary)',
				border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
				opacity: done ? 0.6 : 1,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
					{trendIcon(sug.type)}
					<span style={{ fontWeight: 700, fontSize: '14px', flex: 1, lineHeight: 1.4 }}>
						{sug.new_exercise_name
							? <>
								<span style={{ textDecoration: 'line-through', opacity: 0.5, fontWeight: 500 }}>{getExerciseName(exId)}</span>
								{' '}<ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} color="var(--primary)" />{' '}
								<span style={{ color: 'var(--primary)' }}>{sug.new_exercise_name}</span>
							</>
							: getExerciseName(exId)
						}
					</span>
					<span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: `${color}15`, color }}>{typeLabel(sug)}</span>
				</div>

				{/* Change summary */}
				{sug.new_exercise_name ? (
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '5px', color: 'var(--text-secondary)' }}>
						{sug.suggested.sets && sug.suggested.reps && (
							<span style={{ fontWeight: 600 }}>{sug.suggested.sets}×{sug.suggested.reps}</span>
						)}
					</div>
				) : sug.type === 'exercise_swap' ? (
					<div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '5px', color }}>
						{formatChange(sug)}
					</div>
				) : (
					<div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginBottom: '4px' }}>
						{formatChange(sug)}
					</div>
				)}

				<p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sug.reason}</p>
				{sug.ai_note && <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>"{sug.ai_note}"</p>}

				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
					<span style={{ fontSize: '10px', color: confidenceColor(sug.confidence) }}>● {confidenceLabel(sug.confidence)} reliability</span>
					{done ? (
						<span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>Applied</span>
					) : (
						<button
							onClick={() => applySuggestion(dayName, exId, sug, reportData, appliedSet, setApplied)}
							style={{ fontSize: '11px', padding: '5px 14px', borderRadius: '6px', background: color, color: applyTextColor, border: 'none', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
						>
							<Check size={10} /> Apply
						</button>
					)}
				</div>
			</div>
		);
	};

	// ── Loading ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
				<Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
				<p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading report...</p>
			</div>
		);
	}

	// ── Generating animation ──────────────────────────────────────────────────
	if (generating) {
		return (
			<div className="container fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: '20px', textAlign: 'center' }}>
				<style>{`
					@keyframes fakeProgress { 0% { width: 0%; } 10% { width: 25%; } 40% { width: 65%; } 100% { width: 95%; } }
					@keyframes orbitSpark { 0% { transform: rotate(0deg) translateX(36px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(36px) rotate(-360deg); } }
					@keyframes reportGenGlow { 0%, 100% { box-shadow: 0 0 20px rgba(204,255,0,0.3); } 50% { box-shadow: 0 0 40px rgba(204,255,0,0.6), 0 0 80px rgba(0,229,176,0.2); } }
				`}</style>
				<div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
					<div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(204,255,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'reportGenGlow 2s ease-in-out infinite' }}>
						<TrendingUp size={36} color="var(--primary)" />
					</div>
					{[0, 0.67, 1.33].map((delay, i) => (
						<div key={i} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `orbitSpark 2s linear infinite ${delay}s` }}>
							<Sparkles size={i === 0 ? 14 : i === 1 ? 10 : 12} color={i === 0 ? 'rgba(204,255,0,0.9)' : i === 1 ? 'rgba(0,229,176,0.8)' : 'rgba(204,255,0,0.7)'} />
						</div>
					))}
				</div>
				<div>
					<h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', background: 'linear-gradient(135deg, var(--primary), #00e5b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
						Analysing your training...
					</h2>
					<p style={{ color: 'var(--text-tertiary)', fontSize: '14px', margin: 0 }}>Crunching session history and consulting AI</p>
				</div>
				<div style={{ width: '80%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
					<div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--primary), #00e5b0)', animation: 'fakeProgress 15s cubic-bezier(0.1, 0.8, 0.2, 1) forwards' }} />
				</div>
			</div>
		);
	}

	// ── Generate form (new panel, not yet generated) ──────────────────────────
	const renderGenerateForm = () => (
		<div>
			<style>{`@keyframes genGlow { 0%,100% { box-shadow: 0 0 16px rgba(204,255,0,0.2), 0 4px 12px rgba(0,0,0,0.2); } 50% { box-shadow: 0 0 28px rgba(204,255,0,0.45), 0 6px 20px rgba(0,0,0,0.3); } }`}</style>
			<h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>Generate New Report</h3>
			<p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
				AI analyses your full session history and tells you what to change for each exercise.
				{routine && <> · <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{routine.name}</span></>}
			</p>
			<div style={{ marginBottom: '16px' }}>
				<textarea
					value={userContext}
					onChange={e => setUserContext(e.target.value)}
					placeholder='e.g. "Check if I should deload" or "Focus on my bench press plateau"'
					maxLength={400}
					rows={3}
					style={{
						width: '100%', padding: '10px 12px', borderRadius: '8px',
						background: 'var(--bg-secondary)', border: '1px solid var(--border)',
						color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box'
					}}
				/>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '20px', fontSize: '13px' }}>
				{!canGenerate ? (
					<span style={{ color: '#f59e0b', fontWeight: 600 }}>
						Complete at least {minSessionsRequired} session{minSessionsRequired > 1 ? 's' : ''} first ({completedSessionsCount || 0}/{minSessionsRequired})
					</span>
				) : (
					<span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
						Cost: <strong><CoinIcon size={14} style={{ color: 'var(--gold)' }} /> 50</strong>
					</span>
				)}
			</div>
			{error && (
				<p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
			)}
			{!canAfford && (
				<div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,0,0,0.08)', color: 'var(--error)', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
					{_t('Need 50 coins, you have')} {coinBalance}
				</div>
			)}
			<button
				onClick={generateReport}
				disabled={generating || !canGenerate || !canAfford}
				style={{
					width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
					background: (!canGenerate || !canAfford) ? 'var(--bg-secondary)' : 'linear-gradient(135deg, var(--primary) 0%, #00e5b0 100%)',
					color: (!canGenerate || !canAfford) ? 'var(--text-tertiary)' : '#000',
					fontWeight: 800, fontSize: '15px', cursor: (!canGenerate || !canAfford) ? 'not-allowed' : 'pointer',
					display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
					letterSpacing: '0.01em',
					animation: 'genGlow 2.5s ease-in-out infinite',
				}}
			>
				<Sparkles size={17} />
				Generate Report — <CoinIcon size={15} style={{ color: (!canGenerate || !canAfford) ? 'var(--text-tertiary)' : 'rgba(0,0,0,0.6)' }} /> 50
			</button>
		</div>
	);

	// ── Report view (past panel OR new panel after generating) ────────────────
	const renderReportView = ({
		report, appliedSet, setApplied, showBack,
	}: {
		report: ReportData;
		appliedSet: Set<string>;
		setApplied: (fn: (prev: Set<string>) => Set<string>) => void;
		showBack?: boolean;
	}) => {
		const total = Object.values(report.days).reduce((a, d) => a + Object.keys(d).length, 0);
		const appliedCount = appliedSet.size;

		return (
			<div>
				{showBack && (
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
						<button onClick={() => { setGenerated(false); setCurrentReport(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px' }}>
							<ArrowLeft size={18} />
						</button>
						<div>
							<h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{report.routine_name}</h3>
							<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>just now · {total} suggestions</span>
						</div>
						{total > 0 && (
							<button
								onClick={() => {
									for (const [dayName, exs] of Object.entries(report.days)) {
										for (const [exId, sug] of Object.entries(exs)) {
											if (!appliedSet.has(`${dayName}-${exId}`)) {
												applySuggestion(dayName, exId, sug, report, appliedSet, setApplied);
											}
										}
									}
								}}
								style={{ marginLeft: 'auto', fontSize: '11px', padding: '6px 14px', borderRadius: '8px', background: 'var(--primary)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
							>
								<Check size={12} /> Apply All
							</button>
						)}
					</div>
				)}

				{/* Collapsible Assessment */}
				<button onClick={() => setAssessmentOpen(!assessmentOpen)} style={{
					width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					padding: '12px 14px', borderRadius: assessmentOpen ? '10px 10px 0 0' : '10px',
					background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
					borderBottom: assessmentOpen ? 'none' : undefined, marginBottom: assessmentOpen ? 0 : '12px',
				}}>
					<span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
						AI Assessment · {appliedCount}/{total} applied
					</span>
					{assessmentOpen ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
				</button>
				{assessmentOpen && (
					<div style={{ padding: '12px 14px 14px', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginBottom: '12px', background: 'var(--bg-card)' }}>
						<p style={{ margin: '0 0 8px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{report.overall_assessment}</p>
						{report.periodization_note && (
							<p style={{ margin: 0, fontSize: '12px', color: '#f59e0b', lineHeight: 1.5 }}>⚠ {report.periodization_note}</p>
						)}
					</div>
				)}

				{/* Exercises per day */}
				{Object.entries(report.days).map(([dayName, exercises]) => (
					<div key={dayName} style={{ marginBottom: '16px' }}>
						<h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>{dayName}</h4>
						{Object.entries(exercises).map(([exId, sug]) => (
							<ExerciseCard
								key={exId}
								dayName={dayName} exId={exId} sug={sug}
								appliedSet={appliedSet} setApplied={setApplied}
								reportData={report}
							/>
						))}
					</div>
				))}

				{total === 0 && (
					<div className="card" style={{ textAlign: 'center', padding: '28px' }}>
						<TrendingUp size={28} color="var(--success)" style={{ marginBottom: '10px' }} />
						<p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>Looking good!</p>
						<p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No progression changes needed. Keep training consistently!</p>
					</div>
				)}
			</div>
		);
	};

	// ── Root render ───────────────────────────────────────────────────────────
	const hasSavedReport = savedReport !== null;

	return (
		<div className="container fade-in" style={{ paddingBottom: '80px' }}>
			{/* Page header */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
				<button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px' }}>
					<ArrowLeft size={22} />
				</button>
				<div>
					<h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Progression Report</h2>
					{routine && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{routine.name}</span>}
				</div>
			</div>

			{/* Panel toggle — only when there's a past report */}
			{hasSavedReport && (
				<div style={{ display: 'flex', marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
					{(['past', 'new'] as const).map(p => (
						<button
							key={p}
							onClick={() => { setPanel(p); if (p === 'new' && !generated) setError(null); }}
							style={{
								flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
								background: panel === p ? 'var(--primary)' : 'var(--bg-secondary)',
								color: panel === p ? '#000' : 'var(--text-secondary)',
								display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
							}}
						>
							{p === 'past' ? (
								<><Clock size={14} /> Past Report {reportAge && <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.8 }}>· {reportAge}</span>}</>
							) : (
								<><Sparkles size={14} /> New Report</>
							)}
						</button>
					))}
				</div>
			)}

			{/* ── Past panel ── */}
			{panel === 'past' && savedReport && (
				<div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
					{renderReportView({
						report: savedReport,
						appliedSet: appliedPast,
						setApplied: setAppliedPast,
					})}
				</div>
			)}

			{/* ── New panel: generate form ── */}
			{hasSavedReport && panel === 'new' && !generated && (
				<div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
					{renderGenerateForm()}
				</div>
			)}

			{/* ── New panel: generated results ── */}
			{panel === 'new' && generated && currentReport && (
				<div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
					{renderReportView({
						report: currentReport,
						appliedSet: appliedNew,
						setApplied: setAppliedNew,
						showBack: true
					})}
				</div>
			)}

			{/* No past report + no panel toggle → just show generate form */}
			{!hasSavedReport && (
				<div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
					{renderGenerateForm()}
				</div>
			)}
		</div>
	);
}
