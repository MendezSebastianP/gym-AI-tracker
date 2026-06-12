import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { ArrowLeft, ArrowRight, TrendingUp, Minus, TrendingDown, Check, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { useTranslation } from 'react-i18next';
import GenLoader from '../components/GenLoader';
import { K, Coin } from '../components/kit';
import { useAuthStore } from '../store/authStore';
import { getCoinRecoveryTarget } from '../utils/coinRecovery';

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

/** up = progress, swap = change/warning (amber), hold = neutral */
function recKind(type: string): 'up' | 'swap' | 'hold' {
	if (['weight_increase', 'rep_increase', 'bw_progression', 'cardio_increase'].includes(type)) return 'up';
	if (['exercise_swap', 'deload', 'plateau_warning'].includes(type)) return 'swap';
	return 'hold';
}

export default function ProgressionReport() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const location = useLocation();
	const { user } = useAuthStore();

	// ── Core state ──────────────────────────────────────────────────────────────
	const [panel, setPanel] = useState<'past' | 'new'>('new');
	const [generated, setGenerated] = useState(false);
	const [assessmentOpen, setAssessmentOpen] = useState(true);

	const [savedReport, setSavedReport] = useState<ReportData | null>(null);
	const [currentReport, setCurrentReport] = useState<ReportData | null>(null); // what's shown in new panel
	const [reportAge, setReportAge] = useState<string | null>(null);

	const [loading, setLoading] = useState(false);
	const [genPhase, setGenPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
	const genRun = useRef(0);
	const pendingReport = useRef<ReportData | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [appliedPast, setAppliedPast] = useState(new Set<string>());
	const [appliedNew, setAppliedNew] = useState(new Set<string>());

	const [exerciseNames, setExerciseNames] = useState<Map<number, string>>(new Map());

	const [userContext, setUserContext] = useState((location.state as any)?.userContext || '');
	const [coinBalance, setCoinBalance] = useState<number | null>(null);
	const coinRecoveryTarget = getCoinRecoveryTarget(user?.onboarding_progress);

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
						if (mins < 60) setReportAge(`${mins}m`);
						else if (mins < 1440) setReportAge(`${Math.round(mins / 60)}h`);
						else setReportAge(`${Math.round(mins / 1440)}d`);
					}
				}
			})
			.catch(() => { })
			.finally(() => setLoading(false));
	}, [id]);

	// ── Generate ─────────────────────────────────────────────────────────────
	const canAfford = coinBalance === null || coinBalance >= 50;

	const generateReport = () => {
		if (!id || genPhase === 'loading' || !canGenerate || !canAfford) return;
		const run = ++genRun.current;
		setGenPhase('loading');
		setError(null);
		api.post(`/progression/report/${id}`, { user_context: userContext.trim() || undefined })
			.then(res => {
				if (genRun.current !== run) return;
				const r = res.data as ReportData;
				if (res.data.currency !== undefined) setCoinBalance(res.data.currency);
				pendingReport.current = r;
				setGenPhase('done');
			})
			.catch(e => {
				if (genRun.current !== run) return;
				if (e?.response?.status === 402) {
					setError(t('Not enough coins.'));
				} else {
					setError(e?.response?.data?.detail || t('Failed to generate report'));
				}
				setGenPhase('error');
			});
	};

	const applyPendingReport = () => {
		const r = pendingReport.current;
		setGenPhase('idle');
		if (!r) return;
		pendingReport.current = null;
		setCurrentReport(r);
		setSavedReport(r);
		setReportAge(t('now'));
		setGenerated(true);
		setAppliedNew(new Set());
		setAssessmentOpen(true);
	};

	// ── Apply a single change to a days array (mutates in place) ────────────
	const applyOneSuggestion = (days: any[], dayName: string, exId: number, suggestion: ReportSuggestion) => {
		for (const day of days) {
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
	};

	// ── Persist updated days + optional session sync ────────────────────────
	const persistRoutineDays = async (routineId: number, updatedDays: any[]) => {
		await api.put(`/routines/${routineId}`, { days: updatedDays });
		await db.routines.update(routineId, { days: updatedDays, syncStatus: 'updated' as any });
	};

	// ── Apply single suggestion ────────────────────────────────────────────
	const applySuggestion = async (
		dayName: string, exIdStr: string,
		suggestion: ReportSuggestion,
		reportData: ReportData,
		appliedSet: Set<string>,
		setApplied: (fn: (prev: Set<string>) => Set<string>) => void,
	) => {
		const key = `${dayName}-${exIdStr}`;
		if (appliedSet.has(key) || !routine) return;

		// Read fresh from Dexie to avoid stale-closure races
		const freshRoutine = await db.routines.get(routine.id!);
		if (!freshRoutine) return;

		const updatedDays = JSON.parse(JSON.stringify(freshRoutine.days));
		const exId = Number(exIdStr);

		applyOneSuggestion(updatedDays, dayName, exId, suggestion);

		try {
			await persistRoutineDays(routine.id!, updatedDays);

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

	// ── Apply ALL suggestions in one batch PUT ─────────────────────────────
	const applyAllSuggestions = async (
		report: ReportData,
		appliedSet: Set<string>,
		setApplied: (fn: (prev: Set<string>) => Set<string>) => void,
	) => {
		if (!routine) return;

		// Read fresh from Dexie
		const freshRoutine = await db.routines.get(routine.id!);
		if (!freshRoutine) return;

		const updatedDays = JSON.parse(JSON.stringify(freshRoutine.days));
		const newKeys: string[] = [];

		for (const [dayName, exs] of Object.entries(report.days)) {
			for (const [exIdStr, sug] of Object.entries(exs)) {
				const key = `${dayName}-${exIdStr}`;
				if (appliedSet.has(key)) continue;
				applyOneSuggestion(updatedDays, dayName, Number(exIdStr), sug);
				newKeys.push(key);
			}
		}

		if (newKeys.length === 0) return;

		// Single PUT with all changes
		try {
			await persistRoutineDays(routine.id!, updatedDays);
		} catch { /* offline */ }

		// Record feedback for each suggestion (fire-and-forget)
		for (const [dayName, exs] of Object.entries(report.days)) {
			for (const [exIdStr, sug] of Object.entries(exs)) {
				const key = `${dayName}-${exIdStr}`;
				if (!newKeys.includes(key)) continue;
				api.post('/progression/feedback', {
					report_id: report.report_id,
					exercise_id: Number(exIdStr),
					suggestion_type: sug.type,
					suggested_value: sug.suggested,
					action: 'accepted',
					applied_value: sug.suggested,
				}).catch(() => { });
			}
		}

		setApplied(prev => {
			const next = new Set(prev);
			newKeys.forEach(k => next.add(k));
			return next;
		});
	};

	// ── Helpers ───────────────────────────────────────────────────────────────
	const typeLabel = (s: ReportSuggestion) => {
		if (s.type === 'bw_progression' && s.new_exercise_name) return t('Next Step');
		return ({
			weight_increase: '+Weight', rep_increase: '+Reps', deload: 'Deload',
			exercise_swap: 'Swap', bw_progression: '+Reps', cardio_increase: '+Cardio',
			plateau_warning: 'Plateau',
		}[s.type] || s.type);
	};

	const trendIcon = (kind: 'up' | 'swap' | 'hold', type: string) => {
		if (kind === 'up') return <TrendingUp size={15} />;
		if (type === 'deload' || type === 'plateau_warning') return <TrendingDown size={15} />;
		if (kind === 'swap') return <AlertTriangle size={15} />;
		return <Minus size={15} />;
	};

	const confidence = (c: number): { cls: string; label: string } =>
		c >= 0.85 ? { cls: 'high', label: t('High confidence') }
			: c >= 0.7 ? { cls: 'med', label: t('Medium confidence') }
				: { cls: 'low', label: t('Low confidence') };

	const formatChange = (s: ReportSuggestion) => {
		if (s.type === 'exercise_swap' && !s.new_exercise_name) return t('Consider replacement');
		const c = s.current; const g = s.suggested;
		const parts: string[] = [];
		if (c.weight !== undefined && g.weight !== undefined && c.weight !== g.weight) parts.push(`${c.weight} → ${g.weight} kg`);
		if (c.sets !== undefined && g.sets !== undefined && c.sets !== g.sets) parts.push(`${c.sets} → ${g.sets} sets`);
		if (c.reps !== undefined && g.reps !== undefined && c.reps !== g.reps) parts.push(`${c.reps} → ${g.reps} reps`);
		if (parts.length === 0 && s.new_exercise_name && g.sets && g.reps) parts.push(`${g.sets} × ${g.reps}`);
		return parts.join(' · ') || t('See details');
	};

	// ── Recommendation card (shared between past and new panels) ──────────────
	const RecCard = ({
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
		const kind = recKind(sug.type);
		const conf = confidence(sug.confidence);

		return (
			<div className={`rec ${kind} ${done ? 'applied' : ''}`}>
				<div className="rec-head">
					<span className={`rec-ic ${kind}`}>{trendIcon(kind, sug.type)}</span>
					<div className="rec-titlewrap">
						{sug.new_exercise_name ? (
							<span className="rec-name">
								<span className="rec-from">{getExerciseName(exId)}</span>{' '}
								<span className="rec-arrow">→</span>{' '}
								<span className="rec-to">{sug.new_exercise_name}</span>
							</span>
						) : (
							<span className="rec-name">{getExerciseName(exId)}</span>
						)}
					</div>
					<span className={`rec-tag ${kind}`}>{typeLabel(sug)}</span>
				</div>

				<div className="rec-change num">{formatChange(sug)}</div>
				<p className="rec-detail">{sug.reason}</p>
				{sug.ai_note && <p className="rec-quote">“{sug.ai_note}”</p>}

				<div className="rec-foot">
					<span className={`rel ${conf.cls}`}><span className="rel-dot" />{conf.label}</span>
					{done ? (
						<button className="apply-btn done" disabled>
							<Check size={14} />{t('Applied')}
						</button>
					) : (
						<button
							className="apply-btn"
							onClick={() => applySuggestion(dayName, exId, sug, reportData, appliedSet, setApplied)}
						>
							<Check size={14} />{t('Apply')}
						</button>
					)}
				</div>
			</div>
		);
	};

	// ── AI generating overlay ────────────────────────────────────────────────
	if (genPhase !== 'idle') {
		const total = pendingReport.current
			? Object.values(pendingReport.current.days).reduce((a, d) => a + Object.keys(d).length, 0)
			: 0;
		return (
			<GenLoader
				variant="report"
				status={genPhase === 'loading' ? 'loading' : genPhase === 'done' ? 'done' : 'error'}
				doneTitle={t('Report ready')}
				doneSub={`${total} ${t(total === 1 ? 'recommendation' : 'recommendations')}`}
				errorText={error}
				onDone={applyPendingReport}
				onRetry={generateReport}
				onCancel={() => { genRun.current++; setGenPhase('idle'); }}
			/>
		);
	}

	// ── Loading saved report ─────────────────────────────────────────────────
	if (loading) {
		return (
			<div className="container">
				<div className="mono" style={{ padding: '80px 0', textAlign: 'center', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading report...')}
				</div>
			</div>
		);
	}

	// ── Generate form (new panel, not yet generated) ──────────────────────────
	const renderGenerateForm = () => (
		<div className="rep-gen">
			<div className="rep-gen-title">{t('Generate New Report')}</div>
			<p className="rep-gen-desc">
				{t('AI analyses your full session history and tells you what to change for each exercise.')}
				{routine && <> · <b>{routine.name}</b></>}
			</p>
			<textarea
				className="ai-ta"
				style={{ marginTop: 14 }}
				value={userContext}
				onChange={e => setUserContext(e.target.value)}
				placeholder={t('e.g. "Check if I should deload" or "Focus on my bench press plateau"')}
				maxLength={400}
			/>
			{!canGenerate ? (
				<div className="rep-cost" style={{ color: 'var(--reward)' }}>
					{t('Complete at least {{count}} sessions first', { count: minSessionsRequired })} ({completedSessionsCount || 0}/{minSessionsRequired})
				</div>
			) : (
				<div className="rep-cost">
					{t('Cost')} <Coin size={18} /><span className="num">50</span>
				</div>
			)}

			{error && (
				<p style={{ fontSize: 12.5, color: 'var(--danger)', margin: '10px 0 0', textAlign: 'center' }}>{error}</p>
			)}

			{!canAfford && (
				<div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
					<div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
						<Coin size={15} />
						{t('Need 50 coins, you have')} <span className="num" style={{ color: 'var(--reward)' }}>{coinBalance}</span>
					</div>
					<p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
						{coinRecoveryTarget.helper}
					</p>
					<button
						type="button"
						className="tool-chip"
						style={{ margin: '12px auto 0' }}
						onClick={() => navigate(coinRecoveryTarget.to)}
					>
						{coinRecoveryTarget.label}
						<ArrowRight size={14} />
					</button>
				</div>
			)}

			<button
				className="btn-primary rep-gen-cta"
				onClick={generateReport}
				disabled={!canGenerate || !canAfford}
			>
				<K.spark />{t('Generate Report')} <span className="rep-dash">—</span> <Coin size={18} /><span className="num">50</span>
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
		const allSugs = Object.values(report.days).flatMap(d => Object.values(d));
		const upCount = allSugs.filter(s => recKind(s.type) === 'up').length;
		const swapCount = allSugs.filter(s => recKind(s.type) === 'swap').length;
		const appliedCount = Math.min(appliedSet.size, total);

		return (
			<div>
				{showBack && (
					<button className="expand-btn" onClick={() => { setGenerated(false); setCurrentReport(null); }} style={{ marginBottom: 4 }}>
						<ArrowLeft size={13} />{t('Back to generate')}
					</button>
				)}

				{total > 0 && (
					<div className="rep-summary">
						<div className="rep-sum-top">
							<span className="rep-sum-h">{total} {t(total === 1 ? 'recommendation' : 'recommendations')}</span>
							<span className="rep-sum-applied num">{appliedCount}/{total} {t('applied')}</span>
						</div>
						<div className="rep-sum-bar"><span style={{ width: `${total ? (appliedCount / total) * 100 : 0}%` }} /></div>
						<div className="rep-sum-chips">
							{upCount > 0 && <span className="rep-sum-chip up"><span className="sc-dot" /><span className="num">{upCount}</span> {t('progress')}</span>}
							{swapCount > 0 && <span className="rep-sum-chip swap"><span className="sc-dot" /><span className="num">{swapCount}</span> {t('change')}</span>}
						</div>
					</div>
				)}

				{/* Collapsible Assessment */}
				<div className="assess">
					<button className="assess-head" onClick={() => setAssessmentOpen(!assessmentOpen)}>
						<span className="assess-title">{t('AI Assessment')}</span>
						<span className={`assess-chev ${assessmentOpen ? 'open' : ''}`}><ChevronDown size={16} /></span>
					</button>
					{assessmentOpen && (
						<div className="assess-body">
							<p style={{ margin: 0 }}>{report.overall_assessment}</p>
							{report.periodization_note && (
								<p style={{ margin: '8px 0 0', color: 'var(--reward)' }}>{report.periodization_note}</p>
							)}
						</div>
					)}
				</div>

				{/* Recommendations per day */}
				{Object.entries(report.days).map(([dayName, exercises]) => (
					<div key={dayName}>
						<div className="rep-daymark">{dayName}</div>
						{Object.entries(exercises).map(([exId, sug]) => (
							<RecCard
								key={exId}
								dayName={dayName} exId={exId} sug={sug}
								appliedSet={appliedSet} setApplied={setApplied}
								reportData={report}
							/>
						))}
					</div>
				))}

				{total > 1 && appliedCount < total && (
					<button className="rep-applyall" onClick={() => applyAllSuggestions(report, appliedSet, setApplied)}>
						{t('Apply all {{count}} changes', { count: total })}
					</button>
				)}

				{total === 0 && (
					<div className="hero-card" style={{ marginTop: 8 }}>
						<div className="grain" />
						<div className="hero-body" style={{ textAlign: 'center', padding: '26px 18px' }}>
							<TrendingUp size={26} style={{ color: 'var(--lime)' }} />
							<div style={{ fontWeight: 800, fontSize: 17, marginTop: 8, letterSpacing: '-0.01em' }}>{t('Looking good!')}</div>
							<p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-2)' }}>
								{t('No progression changes needed. Keep training consistently!')}
							</p>
						</div>
					</div>
				)}
			</div>
		);
	};

	// ── Root render ───────────────────────────────────────────────────────────
	const hasSavedReport = savedReport !== null;

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('Back')}>
					<ArrowLeft size={20} />
				</button>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className="page-title sm">{t('Progression Report')}</div>
					{routine && <div className="rep-sub">{routine.name}</div>}
				</div>
			</header>

			{/* Panel toggle — only when there's a past report */}
			{hasSavedReport && (
				<div className="rep-tabs">
					<button
						className={`rep-tab ${panel === 'past' ? 'on' : ''}`}
						onClick={() => setPanel('past')}
					>
						<Clock size={14} />{t('Past Report')}
						{reportAge && <span className="rep-tab-meta num">· {reportAge}</span>}
					</button>
					<button
						className={`rep-tab ${panel === 'new' ? 'on' : ''}`}
						onClick={() => { setPanel('new'); if (!generated) setError(null); }}
					>
						<K.spark width={14} height={14} />{t('New Report')}
					</button>
				</div>
			)}

			{/* ── Past panel ── */}
			{panel === 'past' && savedReport && renderReportView({
				report: savedReport,
				appliedSet: appliedPast,
				setApplied: setAppliedPast,
			})}

			{/* ── New panel: generate form ── */}
			{hasSavedReport && panel === 'new' && !generated && renderGenerateForm()}

			{/* ── New panel: generated results ── */}
			{panel === 'new' && generated && currentReport && renderReportView({
				report: currentReport,
				appliedSet: appliedNew,
				setApplied: setAppliedNew,
				showBack: true,
			})}

			{/* No past report + no panel toggle → just show generate form */}
			{!hasSavedReport && renderGenerateForm()}
		</div>
	);
}
