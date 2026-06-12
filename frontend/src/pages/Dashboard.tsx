import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '../store/authStore';
import {
    BarChart2, Flame, Calendar, HelpCircle, X, User as UserIcon, Scale, Shield, Star,
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Area, AreaChart
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { K, SecLabel } from '../components/kit';

// ── Types ────────────────────────────────────────────────────────────────────
interface ProgressPoint {
    session_number: number;
    date: string;
    nss: number;
}

type FilterLevel = 'total' | 'muscle_group' | 'muscle' | 'exercise';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatPace(secondsPerKm: number): string {
    if (!secondsPerKm || !isFinite(secondsPerKm)) return '--:--';
    const m = Math.floor(secondsPerKm / 60);
    const s = Math.round(secondsPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtKg(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return `${Math.round(v)}`;
}

function fmtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
}

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body', 'Cardio'];

const tickStyle = { fill: 'var(--text-4)', fontSize: 10, fontFamily: 'var(--font-mono)' } as const;
const tooltipStyle = {
    background: 'var(--card-solid)',
    border: '1px solid var(--line-strong)',
    borderRadius: 12,
    fontSize: 12,
    fontFamily: 'var(--font-disp)',
} as const;

// ── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const { user } = useAuthStore();
    const { t } = useTranslation();
    const [progressData, setProgressData] = useState<ProgressPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [demoMode, setDemoMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [weightData, setWeightData] = useState<{ date: string; kg: number }[]>([]);
    const [weightCurrent, setWeightCurrent] = useState<number | null>(null);
    const [weightChange30d, setWeightChange30d] = useState<number | null>(null);
    const [cardioExercises, setCardioExercises] = useState<{exercise_id: number; name: string; session_count: number}[]>([]);
    const [activeCardioTab, setActiveCardioTab] = useState<number | 'other' | null>(null);
    const [otherExerciseId, setOtherExerciseId] = useState<number | null>(null);
    const [cardioByExercise, setCardioByExercise] = useState<Record<number, any>>({});
    const [effortTrend, setEffortTrend] = useState<Array<{ index: number; effort: number; date?: string }>>([]);

    // Joker / streak-at-risk state
    const [jokerTokens, setJokerTokens] = useState(0);
    const [streakAtRisk, setStreakAtRisk] = useState(false);
    const [jokerUsing, setJokerUsing] = useState(false);
    const [jokerMsg, setJokerMsg] = useState<string | null>(null);

    // Filters
    const [filterLevel, setFilterLevel] = useState<FilterLevel>('total');
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [muscles, setMuscles] = useState<string[]>([]);
    const [selectedMuscle, setSelectedMuscle] = useState<string>('');
    const [exercises, setExercises] = useState<any[]>([]);
    const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);

    // Filter exercises based on search term
    const searchExercises = exercises.filter(e =>
        e.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase())
    ).slice(0, 5);

    // Overview stats from local DB
    const overview = useLiveQuery(async () => {
        const sessions = await db.sessions.filter((s: any) => !!s.completed_at).toArray();
        const ids = sessions.map((s: any) => s.id!).filter(Boolean);
        const allSets = await db.sets.where('session_id').anyOf(ids).toArray();
        const sets = allSets.filter((s: any) => (s.set_type || 'normal') === 'normal');
        const exAll = await db.exercises.toArray();
        const exMap = new Map(exAll.map((e: any) => [e.id, e]));

        const totalVolume = sets.reduce((sum: number, set: any) => {
            if (!set.reps || set.reps === 0) return sum;
            const w = set.weight_kg && set.weight_kg > 0
                ? set.weight_kg
                : ((exMap.get(set.exercise_id) as any)?.default_weight_kg ?? 0);
            return sum + w * set.reps;
        }, 0);

        // Streak
        const now = new Date();
        const cDay = now.getDay();
        const diff = cDay === 0 ? 6 : cDay - 1;
        const sow = new Date(now); sow.setHours(0, 0, 0, 0); sow.setDate(now.getDate() - diff);
        const wc = Array.from({ length: 8 }, (_, i) => {
            const wk = 7 - i;
            const ws = new Date(sow); ws.setDate(sow.getDate() - wk * 7);
            const we = new Date(ws); we.setDate(ws.getDate() + 6);
            return sessions.filter((s: any) => { const d = new Date(s.completed_at!); return d >= ws && d <= we; }).length;
        });
        let streak = 0, ci = 7;
        if (wc[7] === 0) ci = wc[6] > 0 ? 6 : -1;
        if (ci !== -1) { for (let i = ci; i >= 0; i--) { if (wc[i] > 0) streak++; else break; } }

        return { totalSessions: sessions.length, totalVolume, streakWeeks: streak };
    }, []);

    const effortTrackingEnabled = !!user?.settings?.effort_tracking_enabled;

    // Fetch joker tokens + detect streak-at-risk (Thursday+, no sessions this week, streak > 0)
    useEffect(() => {
        api.get('/gamification/stats').then(res => {
            setJokerTokens(res.data.joker_tokens || 0);
        }).catch(() => {});

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 4=Thu ...
        const isThuOrLater = dayOfWeek === 0 || dayOfWeek >= 4; // Thu=4, Fri=5, Sat=6, Sun=0
        if (!isThuOrLater) return;

        db.sessions.filter((s: any) => {
            if (!s.completed_at) return false;
            const d = new Date(s.completed_at);
            const cDay = now.getDay();
            const diff = cDay === 0 ? 6 : cDay - 1;
            const sow = new Date(now); sow.setHours(0,0,0,0); sow.setDate(now.getDate() - diff);
            const eow = new Date(sow); eow.setDate(sow.getDate() + 6); eow.setHours(23,59,59,999);
            return d >= sow && d <= eow;
        }).count().then(count => {
            if (count === 0) {
                // Check if streak > 0
                db.sessions.filter((s: any) => !!s.completed_at).count().then(total => {
                    if (total > 0) setStreakAtRisk(true);
                });
            }
        });
    }, []);

    const useJokerForStreak = async () => {
        if (jokerUsing || jokerTokens <= 0) return;
        setJokerUsing(true);
        try {
            const res = await api.post('/gamification/joker-streak');
            setJokerTokens(res.data.joker_tokens);
            setStreakAtRisk(false);
            setJokerMsg(`${t('Streak saved!')} +${res.data.streak_coins} ${t('coins')}`);
            setTimeout(() => setJokerMsg(null), 4000);
        } catch (e: any) {
            setJokerMsg(e?.response?.data?.detail || 'Failed to use joker');
            setTimeout(() => setJokerMsg(null), 4000);
        } finally {
            setJokerUsing(false);
        }
    };

    // Load exercise/muscle lists for filters
    useEffect(() => {
        db.exercises.toArray().then((exs: any[]) => {
            const mSet = new Set(exs.map((e: any) => e.muscle).filter(Boolean));
            setMuscles(Array.from(mSet).sort());
            setExercises(exs.sort((a: any, b: any) => a.name.localeCompare(b.name)));
        });
    }, []);

    // Fetch progress data
    useEffect(() => {
        setLoading(true);
        // API client base URL is typically /api so we just need /stats/...
        const base = demoMode ? '/stats/progress/demo' : '/stats/progress';
        const params = new URLSearchParams();
        if (filterLevel === 'muscle_group' && selectedGroup) params.set('muscle_group', selectedGroup);
        if (filterLevel === 'muscle' && selectedMuscle) params.set('muscle', selectedMuscle);
        if (filterLevel === 'exercise' && selectedExerciseId) params.set('exercise_id', String(selectedExerciseId));

        const url = params.toString() ? `${base}?${params}` : base;
        api.get<ProgressPoint[]>(url)
            .then(r => { setProgressData(r.data); setLoading(false); })
            .catch((err) => {
                console.error("Failed to fetch progress", err);
                setProgressData([]); setLoading(false);
            });
    }, [demoMode, filterLevel, selectedGroup, selectedMuscle, selectedExerciseId]);

    // Fetch weight data
    useEffect(() => {
        const weightUrl = demoMode ? '/weight/demo?days=90' : '/weight?days=90';
        const weightStatsUrl = demoMode ? '/weight/stats/demo' : '/weight/stats';
        api.get(weightUrl).then(res => {
            const sorted = [...res.data].sort((a: any, b: any) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
            // One point per calendar day — latest reading wins
            const byDay = new Map<string, number>();
            for (const l of sorted) {
                const dateKey = new Date(l.measured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                byDay.set(dateKey, l.weight_kg);
            }
            setWeightData(Array.from(byDay.entries()).map(([date, kg]) => ({ date, kg })));
        }).catch(() => {});
        api.get(weightStatsUrl).then(res => {
            setWeightCurrent(res.data.current ?? null);
            setWeightChange30d(res.data.change_30d ?? null);
        }).catch(() => {});
    }, [demoMode]);

    // Fetch cardio exercise list
    useEffect(() => {
        const endpoint = demoMode ? '/stats/cardio/exercises/demo?days=100' : '/stats/cardio/exercises?days=100';
        api.get(endpoint).then(res => {
            const list: {exercise_id: number; name: string; session_count: number}[] = res.data || [];
            setCardioExercises(list);
            setCardioByExercise({});
            if (list.length > 0) {
                setActiveCardioTab(list[0].exercise_id);
                if (list.length >= 4) setOtherExerciseId(list[3].exercise_id);
            } else {
                setActiveCardioTab(null);
            }
        }).catch(() => {});
    }, [demoMode]);

    // Fetch cardio stats per active tab
    useEffect(() => {
        if (activeCardioTab === null) return;
        const exId = activeCardioTab === 'other' ? otherExerciseId : activeCardioTab;
        if (exId === null) return;
        if (cardioByExercise[exId]) return;
        const base = demoMode ? '/stats/cardio/demo' : '/stats/cardio';
        api.get(`${base}?days=90&exercise_id=${exId}`).then(res => {
            setCardioByExercise(prev => ({ ...prev, [exId]: res.data }));
        }).catch(() => {});
    }, [activeCardioTab, otherExerciseId, demoMode]);

    // Effort trend (demo uses backend sample; normal mode uses local sessions)
    useEffect(() => {
        let cancelled = false;

        const loadEffortTrend = async () => {
            if (!effortTrackingEnabled) {
                if (!cancelled) setEffortTrend([]);
                return;
            }

            if (demoMode) {
                try {
                    const res = await api.get('/stats/effort/demo?limit=12');
                    const fromApi = Array.isArray(res.data) ? res.data : [];
                    const demoFallback = [
                        { index: 1, effort: 54, date: '2025-10-12' },
                        { index: 2, effort: 61, date: '2025-10-19' },
                        { index: 3, effort: 58, date: '2025-10-27' },
                        { index: 4, effort: 66, date: '2025-11-03' },
                        { index: 5, effort: 72, date: '2025-11-10' },
                        { index: 6, effort: 69, date: '2025-11-18' },
                        { index: 7, effort: 76, date: '2025-11-25' },
                        { index: 8, effort: 81, date: '2025-12-02' },
                    ];
                    if (!cancelled) setEffortTrend(fromApi.length > 0 ? fromApi : demoFallback);
                } catch {
                    if (!cancelled) {
                        setEffortTrend([
                            { index: 1, effort: 54, date: '2025-10-12' },
                            { index: 2, effort: 61, date: '2025-10-19' },
                            { index: 3, effort: 58, date: '2025-10-27' },
                            { index: 4, effort: 66, date: '2025-11-03' },
                            { index: 5, effort: 72, date: '2025-11-10' },
                            { index: 6, effort: 69, date: '2025-11-18' },
                            { index: 7, effort: 76, date: '2025-11-25' },
                            { index: 8, effort: 81, date: '2025-12-02' },
                        ]);
                    }
                }
                return;
            }

            const completedSessions = await db.sessions
                .filter((s: any) => !!s.completed_at && typeof (s as any).effort_score === 'number')
                .toArray();

            const mapped = completedSessions
                .sort((a: any, b: any) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
                .slice(-12)
                .map((s: any, i: number) => ({
                    index: i + 1,
                    effort: Math.round((s.effort_score || 0) * 10) / 10,
                }));

            if (!cancelled) setEffortTrend(mapped);
        };

        loadEffortTrend();
        return () => { cancelled = true; };
    }, [demoMode, effortTrackingEnabled]);

    const lineColor = demoMode ? 'var(--amber)' : 'var(--lime)';
    const hasData = progressData.length > 0;

    // Headline numbers for the strength card
    const firstPts = hasData ? progressData[0].nss : 0;
    const lastPts = hasData ? progressData[progressData.length - 1].nss : 0;
    const trendPct = (hasData && progressData.length > 1 && firstPts > 0)
        ? Math.round(((lastPts - firstPts) / firstPts) * 100)
        : null;
    const avgEffort = effortTrend.length > 0
        ? Math.round(effortTrend.reduce((a, e) => a + e.effort, 0) / effortTrend.length)
        : null;

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload as ProgressPoint;
        return (
            <div style={{ ...tooltipStyle, padding: '10px 14px' }}>
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 4 }}>
                    {fmtDate(d.date)}
                </div>
                <div className="num" style={{ fontSize: 16, fontWeight: 800, color: lineColor }}>
                    {fmtKg(d.nss)} pts
                </div>
                <div className="mono num" style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 2 }}>
                    Session #{d.session_number}
                </div>
            </div>
        );
    };

    return (
        <div className="container">

            {/* Header */}
            <header className="page-hdr" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="page-title" style={{ flex: 'none' }}>{t('Stats')}</span>
                    <button className="icon-btn sm" onClick={() => setShowHelp(true)} aria-label={t('Help')} style={{ width: 32, height: 32, borderRadius: 9 }}>
                        <HelpCircle size={17} />
                    </button>
                </div>
                <button
                    className="icon-btn sm"
                    onClick={() => setDemoMode(!demoMode)}
                    aria-label={t('Toggle Demo Mode')}
                    style={demoMode ? {
                        color: 'var(--reward)',
                        borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
                        background: 'color-mix(in oklab, var(--reward) 12%, transparent)',
                    } : undefined}
                >
                    <UserIcon size={18} />
                </button>
            </header>

            {/* Demo banner */}
            {demoMode && (
                <div
                    className="coach"
                    style={{
                        marginTop: 10,
                        borderColor: 'color-mix(in oklab, var(--reward) 30%, transparent)',
                        background: 'color-mix(in oklab, var(--reward) 7%, var(--card-solid))',
                    }}
                >
                    <span className="badge" style={{ background: 'color-mix(in oklab, var(--reward) 16%, transparent)', color: 'var(--reward)' }}>
                        <Star size={14} />
                    </span>
                    <div>
                        <b style={{ color: 'var(--reward)' }}>{t('Demo mode')}</b>
                        <p>{t('Viewing demo profile — 16 months of training data')}</p>
                    </div>
                </div>
            )}

            {/* Overview cards */}
            {!demoMode && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginTop: 14 }}>
                    <div className="card" style={{ marginBottom: 0, padding: '13px 8px', textAlign: 'center' }}>
                        <Calendar size={15} style={{ color: 'var(--green-mid)', margin: '0 auto 5px', display: 'block' }} />
                        <div className="num" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {overview?.totalSessions ?? 0}
                        </div>
                        <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 3 }}>{t('Sessions')}</div>
                    </div>
                    <div className="card" style={{ marginBottom: 0, padding: '13px 8px', textAlign: 'center' }}>
                        <K.dumbbell width={16} height={16} style={{ color: 'var(--lime)', margin: '0 auto 5px', display: 'block' }} />
                        <div className="num" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {fmtKg(overview?.totalVolume ?? 0)}
                        </div>
                        <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 3 }}>{t('Total Volume')}</div>
                    </div>
                    <div className="card" style={{ marginBottom: 0, padding: '13px 8px', textAlign: 'center' }}>
                        <Flame size={15} style={{ color: 'var(--reward)', margin: '0 auto 5px', display: 'block' }} />
                        <div className="num" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>
                            {overview?.streakWeeks ?? 0}<span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>w</span>
                        </div>
                        <div className="mono" style={{ fontSize: 8.5, color: 'var(--text-3)', marginTop: 3 }}>{t('Streak')}</div>
                    </div>
                </div>
            )}

            {/* Streak-at-risk banner */}
            {streakAtRisk && (overview?.streakWeeks ?? 0) > 0 && (
                <div
                    className="coach"
                    style={{
                        marginTop: 12,
                        borderColor: 'color-mix(in oklab, var(--reward) 38%, transparent)',
                        background: 'color-mix(in oklab, var(--reward) 8%, var(--card-solid))',
                        alignItems: 'center',
                    }}
                >
                    <span className="badge" style={{ background: 'color-mix(in oklab, var(--reward) 16%, transparent)', color: 'var(--reward)' }}>
                        <Flame size={14} />
                    </span>
                    <div style={{ flex: 1 }}>
                        <b style={{ color: 'var(--reward)' }}>{overview?.streakWeeks}w {t('streak at risk!')}</b>
                        <p>{t('No sessions this week. Train or use a Joker.')}</p>
                    </div>
                    {jokerTokens > 0 && (
                        <button
                            className="tool-chip"
                            onClick={useJokerForStreak}
                            disabled={jokerUsing}
                            style={{ flexShrink: 0 }}
                        >
                            <Shield size={13} />
                            {t('Joker')} ({jokerTokens})
                        </button>
                    )}
                </div>
            )}
            {jokerMsg && (
                <div className="topmark" style={{ marginTop: 10, color: 'var(--lime)' }}>{jokerMsg}</div>
            )}

            {/* ── Strength progress ── */}
            <SecLabel>{t('Strength Progress')}</SecLabel>
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('Strength trend')}</span>
                    {hasData && (
                        <span className="mono num" style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: lineColor, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <K.spark width={13} height={13} />{t('Last')} {progressData.length} {t('sessions')}
                        </span>
                    )}
                </div>
                <div className="seg" style={{ display: 'flex', width: '100%' }}>
                    {([['total', t('Total')], ['muscle_group', t('Group')], ['muscle', t('Muscle')], ['exercise', t('Exercise')]] as [FilterLevel, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            className={filterLevel === key ? 'on' : ''}
                            onClick={() => { setFilterLevel(key); }}
                            style={{ flex: 1, justifyContent: 'center', padding: '7px 4px', whiteSpace: 'nowrap' }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Sub-filters */}
                {filterLevel === 'muscle_group' && (
                    <div className="field" style={{ marginTop: 12 }}>
                        <select value={selectedGroup ?? ''} onChange={e => setSelectedGroup(e.target.value)} style={{ marginTop: 0 }}>
                            <option value="">{t('Select muscle group...')}</option>
                            {MUSCLE_GROUPS.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                )}

                {filterLevel === 'muscle' && (
                    <div className="field" style={{ marginTop: 12 }}>
                        <select value={selectedMuscle ?? ''} onChange={e => setSelectedMuscle(e.target.value)} style={{ marginTop: 0 }}>
                            <option value="">{t('Select muscle...')}</option>
                            {muscles.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                )}

                {filterLevel === 'exercise' && (
                    <div style={{ position: 'relative', marginTop: 12 }}>
                        <div className="field" style={{ marginTop: 0 }}>
                            <input
                                type="text"
                                placeholder={t('Search exercises...')}
                                value={exerciseSearchTerm}
                                onChange={(e) => {
                                    setExerciseSearchTerm(e.target.value);
                                    if (!e.target.value) {
                                        setSelectedExerciseId(null);
                                    }
                                }}
                                style={{ marginTop: 0 }}
                            />
                        </div>
                        {exerciseSearchTerm && !selectedExerciseId && searchExercises.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                                background: 'var(--card-solid)', border: '1px solid var(--line-strong)',
                                borderRadius: 13, marginTop: 4, overflow: 'hidden',
                                boxShadow: '0 14px 34px -14px rgba(0,0,0,0.6)',
                            }}>
                                {searchExercises.map((e: any) => (
                                    <button
                                        key={e.id}
                                        onClick={() => {
                                            setSelectedExerciseId(e.id);
                                            setExerciseSearchTerm(e.name);
                                        }}
                                        style={{
                                            width: '100%', padding: '11px 14px', textAlign: 'left',
                                            background: 'none', border: 'none', color: 'var(--text)',
                                            borderBottom: '1px solid var(--line)', cursor: 'pointer',
                                            fontFamily: 'var(--font-disp)', fontWeight: 600, fontSize: 13.5,
                                        }}
                                    >
                                        {e.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Chart */}
                {loading ? (
                    <div className="mono" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-4)' }}>
                        {t('Loading...')}
                    </div>
                ) : !hasData ? (
                    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <BarChart2 size={36} style={{ color: 'var(--text-4)', opacity: 0.4 }} />
                        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                            {demoMode ? t('No demo data found') : t('Complete a session to see your progress')}
                        </p>
                        {!demoMode && (
                            <button className="tool-chip" onClick={() => setDemoMode(true)}>
                                {t('View demo profile')} →
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ marginTop: 16 }}>
                        <div className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                            {trendPct !== null
                                ? <span style={{ color: trendPct >= 0 ? lineColor : 'var(--danger)' }}>{trendPct >= 0 ? '+' : ''}{trendPct}%</span>
                                : <span>{fmtKg(lastPts)} <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>pts</span></span>}
                        </div>
                        <div style={{ marginTop: 5, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
                            {trendPct !== null ? (
                                <>
                                    {t('Score')} <b className="num" style={{ color: lineColor }}>{fmtKg(firstPts)} → {fmtKg(lastPts)} pts</b>
                                    {' · '}
                                    {trendPct > 2 ? t('trending up') : trendPct < -2 ? t('trending down') : t('holding steady')}
                                </>
                            ) : t('Normalised strength score per session')}
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={progressData}>
                                <defs>
                                    <linearGradient id="nssGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={lineColor} stopOpacity={0.22} />
                                        <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="session_number"
                                    tick={tickStyle}
                                    axisLine={{ stroke: 'var(--line)' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(v: number) => fmtKg(v)}
                                    tick={tickStyle}
                                    axisLine={false}
                                    tickLine={false}
                                    width={45}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="nss"
                                    stroke={lineColor}
                                    strokeWidth={2.4}
                                    fill="url(#nssGrad)"
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        stroke: lineColor,
                                        strokeWidth: 2,
                                        fill: 'var(--card-solid)'
                                    }}
                                    animationDuration={800}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {effortTrackingEnabled && effortTrend && effortTrend.length > 0 && (
                <>
                    <SecLabel>{t('Effort Trend')}</SecLabel>
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10 }}>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('Average effort')}</span>
                            <span className="mono num" style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-4)' }}>
                                {demoMode ? t('Demo') : `${t('Last')} ${effortTrend.length} ${t('sessions')}`} · 0-100
                            </span>
                        </div>
                        {avgEffort !== null && (
                            <div style={{ marginBottom: 12 }}>
                                <span className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{avgEffort}</span>
                                <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 6 }}>
                                    {avgEffort >= 78 ? t('All out') : avgEffort >= 55 ? t('Hard') : avgEffort >= 30 ? t('Moderate') : t('Easy')}
                                </span>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height={170}>
                            <LineChart data={effortTrend}>
                                <XAxis dataKey="index" tick={tickStyle} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={tickStyle} axisLine={false} tickLine={false} width={30} />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(v: any) => [`${v}`, t('Effort')]}
                                />
                                <Line type="monotone" dataKey="effort" stroke="var(--green-mid)" strokeWidth={2.4} dot={{ r: 2, fill: 'var(--green-mid)' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}

            {/* Body Weight Chart */}
            <SecLabel>{t('Body Weight')}</SecLabel>
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('Body weight')}</span>
                    <span className="mono num" style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-4)' }}>{t('Last 90 days')}</span>
                </div>
                {(weightCurrent || weightChange30d !== null) && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                        {weightCurrent && (
                            <span className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {weightCurrent}<span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>kg</span>
                            </span>
                        )}
                        {weightChange30d !== null && (
                            <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: weightChange30d < 0 ? 'var(--lime)' : weightChange30d > 0 ? 'var(--danger)' : 'var(--text-2)' }}>
                                {weightChange30d > 0 ? '+' : ''}{weightChange30d} kg / 30d
                            </span>
                        )}
                    </div>
                )}
                {weightData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={weightData}>
                            <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                            <YAxis domain={['auto', 'auto']} tick={tickStyle} axisLine={false} tickLine={false} width={35} />
                            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-2)' }} />
                            <Line type="stepAfter" dataKey="kg" stroke="var(--lime)" strokeWidth={2.2} dot={{ r: 3, fill: 'var(--lime)' }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Scale size={15} style={{ color: 'var(--text-4)' }} />
                        {t('Log your body weight during workouts to track your progress here.')}
                    </p>
                )}
            </div>

            {/* Cardio Stats */}
            {cardioExercises.length > 0 && (() => {
                const tabExercises = cardioExercises.slice(0, 3);
                const otherExercises = cardioExercises.slice(3);
                const hasOther = otherExercises.length > 0;
                const activeExId = activeCardioTab === 'other' ? otherExerciseId : activeCardioTab;
                const activeData = activeExId ? cardioByExercise[activeExId] : null;

                return (
                    <>
                        <SecLabel>{t('Cardio')}</SecLabel>
                        <div className="card">
                            {/* Tab bar */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {tabExercises.map(ex => (
                                    <button
                                        key={ex.exercise_id}
                                        className={`tool-chip ${activeCardioTab === ex.exercise_id ? 'on' : ''}`}
                                        onClick={() => setActiveCardioTab(ex.exercise_id)}
                                        style={{ height: 34 }}
                                    >
                                        {ex.name}
                                    </button>
                                ))}
                                {hasOther && (
                                    <button
                                        className={`tool-chip ${activeCardioTab === 'other' ? 'on' : ''}`}
                                        onClick={() => setActiveCardioTab('other')}
                                        style={{ height: 34 }}
                                    >
                                        {t('Other')} ▾
                                    </button>
                                )}
                            </div>

                            {/* Other tab: exercise picker */}
                            {activeCardioTab === 'other' && (
                                <div className="field" style={{ marginTop: 12 }}>
                                    <select
                                        style={{ marginTop: 0, height: 44 }}
                                        value={otherExerciseId ?? ''}
                                        onChange={e => {
                                            const id = parseInt(e.target.value);
                                            setOtherExerciseId(id);
                                            if (!cardioByExercise[id]) {
                                                const base = demoMode ? '/stats/cardio/demo' : '/stats/cardio';
                                                api.get(`${base}?days=90&exercise_id=${id}`).then(res => {
                                                    setCardioByExercise(prev => ({ ...prev, [id]: res.data }));
                                                }).catch(() => {});
                                            }
                                        }}
                                    >
                                        {otherExercises.map(ex => (
                                            <option key={ex.exercise_id} value={ex.exercise_id}>{ex.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Charts for active tab */}
                            {activeData && activeData.distance_trend.length > 0 && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16 }}>
                                        <span className="num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                            {activeData.total_distance_km}<span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>km</span>
                                        </span>
                                        <span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-3)' }}>
                                            {activeData.avg_pace ? `${formatPace(activeData.avg_pace)} /km ${t('avg')} · ` : ''}{activeData.total_sessions} {t('sessions')}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 12 }}>
                                        <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-3)', marginBottom: 6 }}>{t('Distance')} (km)</div>
                                        <ResponsiveContainer width="100%" height={140}>
                                            <LineChart data={activeData.distance_trend}>
                                                <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                                                <YAxis domain={['auto', 'auto']} tick={tickStyle} axisLine={false} tickLine={false} width={35} />
                                                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-2)' }} />
                                                <Line type="monotone" dataKey="distance_km" stroke="var(--green-mid)" strokeWidth={2.2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {activeData.pace_trend.length > 0 && (
                                        <div style={{ marginTop: 12 }}>
                                            <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-3)', marginBottom: 6 }}>{t('Pace')} (min/km)</div>
                                            <ResponsiveContainer width="100%" height={140}>
                                                <LineChart data={activeData.pace_trend}>
                                                    <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                                                    <YAxis reversed domain={['auto', 'auto']} tick={tickStyle} axisLine={false} tickLine={false} width={35} />
                                                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-2)' }} formatter={(value: number) => [formatPace(value), t('Pace')]} />
                                                    <Line type="monotone" dataKey="avg_pace" stroke="var(--amber)" strokeWidth={2.2} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                </>
                            )}
                        </div>
                    </>
                );
            })()}

            {/* Help sheet */}
            {showHelp && createPortal(
                <div className="sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
                    <div className="sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                        <div className="sheet-grab" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h3 style={{ flex: 1 }}>{t('How Scoring Works')}</h3>
                            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }} aria-label={t('Close')}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)', marginTop: 12 }}>
                            <p style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--lime)' }}>{t('What we measure:')}</strong> Estimated 1 Rep Max strength
                                per session, normalised across all exercises.
                            </p>
                            <p style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--lime)' }}>{t('What we don\'t measure:')}</strong> Stamina, endurance, or
                                cardio output. This is a <em>strength</em> progression tracker.
                            </p>
                            <p style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--lime)' }}>{t('Why normalised?')}</strong> So you can compare a session
                                of bench press with a session of calisthenics. Each exercise has a difficulty factor.
                            </p>
                            <p style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--lime)' }}>{t('Bodyweight exercises:')}</strong> Scaled by your bodyweight
                                and exercise difficulty (pull-up = 1.0, planche = 4.5).
                            </p>
                            <p style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--lime)' }}>{t('Switching exercises:')}</strong> Expect a small dip — mastering
                                a harder move takes time, but score recovers as you improve.
                            </p>
                            <div className="coach">
                                <span className="badge" style={{ background: 'color-mix(in oklab, var(--reward) 16%, transparent)', color: 'var(--reward)' }}>
                                    <Star size={14} />
                                </span>
                                <div>
                                    <b style={{ color: 'var(--reward)' }}>{t('Demo Mode')}</b>
                                    <p>Toggle the user icon at the top to view a simulated 16-month strength progression from our mock dataset.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
