import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    BarChart2, Flame, Dumbbell, Calendar, TrendingUp,
    ChevronRight, Star, HelpCircle, X, User as UserIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Area, AreaChart
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────
interface ProgressPoint {
    session_number: number;
    date: string;
    nss: number;
}

type FilterLevel = 'total' | 'muscle_group' | 'muscle' | 'exercise';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const [progressData, setProgressData] = useState<ProgressPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [demoMode, setDemoMode] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

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
        const sets = await db.sets.where('session_id').anyOf(ids).toArray();
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

    const lineColor = demoMode ? '#FFB347' : 'var(--primary)';
    const hasData = progressData.length > 0;

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload as ProgressPoint;
        return (
            <div style={{
                background: '#1E1E1E', border: '1px solid #333', borderRadius: '8px',
                padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    {fmtDate(d.date)}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: lineColor }}>
                    {fmtKg(d.nss)} pts
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Session #{d.session_number}
                </div>
            </div>
        );
    };

    return (
        <div className="container" style={{ paddingBottom: '90px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChart2 size={26} color="var(--primary)" />
                    <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Stats</h1>
                    <button onClick={() => setShowHelp(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <HelpCircle size={22} color="var(--text-tertiary)" />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setDemoMode(!demoMode)}
                        style={{
                            background: demoMode ? 'rgba(255,179,71,0.15)' : 'none',
                            border: demoMode ? '1px solid #FFB347' : '1px solid transparent',
                            borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                    >
                        <UserIcon size={18} color={demoMode ? '#FFB347' : 'var(--text-tertiary)'} />
                        {demoMode && <span style={{ fontSize: '11px', color: '#FFB347', fontWeight: 600 }}>Demo</span>}
                    </button>
                </div>
            </div>

            {/* Demo banner */}
            {demoMode && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255,179,71,0.12), rgba(255,179,71,0.05))',
                    border: '1px solid rgba(255,179,71,0.3)',
                    borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                    display: 'flex', gap: '8px', alignItems: 'center'
                }}>
                    <Star size={16} color="#FFB347" />
                    <span style={{ fontSize: '12px', color: '#FFB347' }}>
                        Viewing demo profile — 16 months of training data
                    </span>
                </div>
            )}

            {/* Overview Cards */}
            {!demoMode && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    <div className="card text-center" style={{ marginBottom: 0, padding: '12px 6px' }}>
                        <Calendar size={16} color="var(--accent)" style={{ margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
                            {overview?.totalSessions ?? 0}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Sessions</div>
                    </div>
                    <div className="card text-center" style={{ marginBottom: 0, padding: '12px 6px' }}>
                        <Dumbbell size={16} color="var(--primary)" style={{ margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                            {fmtKg(overview?.totalVolume ?? 0)}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Total Volume</div>
                    </div>
                    <div className="card text-center" style={{ marginBottom: 0, padding: '12px 6px' }}>
                        <Flame size={16} color="#FF6B6B" style={{ margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#FF6B6B' }}>
                            {overview?.streakWeeks ?? 0}<span style={{ fontSize: '11px', fontWeight: 400 }}>w</span>
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Streak</div>
                    </div>
                </div>
            )}

            {/* Progress Chart */}
            <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <TrendingUp size={18} color="var(--primary)" />
                    <h3 style={{ fontWeight: 600, fontSize: '15px' }}>Strength Progress</h3>
                </div>

                {/* Filter Level 1 */}
                <div style={{
                    display: 'flex', gap: 0, marginBottom: '10px',
                    background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px',
                    overflowX: 'auto'
                }}>
                    {([['total', 'Total'], ['muscle_group', 'Group'], ['muscle', 'Muscle'], ['exercise', 'Exercise']] as [FilterLevel, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => { setFilterLevel(key); }}
                            style={{
                                flex: 1, padding: '6px 4px', fontSize: '11px', whiteSpace: 'nowrap',
                                fontWeight: filterLevel === key ? 700 : 400,
                                borderRadius: '6px', border: 'none', cursor: 'pointer',
                                background: filterLevel === key ? 'var(--bg-secondary)' : 'transparent',
                                color: filterLevel === key ? 'var(--primary)' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                                boxShadow: filterLevel === key ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Filter Level 2 — sub-filter blocks */}
                {filterLevel === 'muscle_group' && (
                    <select
                        value={selectedGroup ?? ''}
                        onChange={e => setSelectedGroup(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                            border: '1px solid #444', fontSize: '14px', marginBottom: '16px',
                            outline: 'none'
                        }}
                    >
                        <option value="">Select muscle group...</option>
                        {MUSCLE_GROUPS.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                )}

                {filterLevel === 'muscle' && (
                    <select
                        value={selectedMuscle ?? ''}
                        onChange={e => setSelectedMuscle(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                            border: '1px solid #444', fontSize: '14px', marginBottom: '16px',
                            outline: 'none'
                        }}
                    >
                        <option value="">Select muscle...</option>
                        {muscles.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                )}

                {filterLevel === 'exercise' && (
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <input
                            type="text"
                            placeholder="Search exercises..."
                            value={exerciseSearchTerm}
                            onChange={(e) => {
                                setExerciseSearchTerm(e.target.value);
                                if (!e.target.value) {
                                    setSelectedExerciseId(null);
                                }
                            }}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                border: '1px solid #444', fontSize: '14px', outline: 'none'
                            }}
                        />
                        {exerciseSearchTerm && !selectedExerciseId && searchExercises.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                                background: 'var(--bg-secondary)', border: '1px solid #333',
                                borderRadius: '8px', marginTop: '4px', overflow: 'hidden'
                            }}>
                                {searchExercises.map((e: any) => (
                                    <button
                                        key={e.id}
                                        onClick={() => {
                                            setSelectedExerciseId(e.id);
                                            setExerciseSearchTerm(e.name);
                                        }}
                                        style={{
                                            width: '100%', padding: '10px 12px', textAlign: 'left',
                                            background: 'none', border: 'none', color: 'var(--text-primary)',
                                            borderBottom: '1px solid #333', cursor: 'pointer', fontSize: '13px'
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
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                        Loading…
                    </div>
                ) : !hasData ? (
                    <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <BarChart2 size={40} color="var(--text-tertiary)" style={{ opacity: 0.3 }} />
                        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                            {demoMode ? 'No demo data found' : 'Complete a session to see your progress'}
                        </p>
                        {!demoMode && (
                            <button onClick={() => setDemoMode(true)} style={{
                                fontSize: '12px', color: '#FFB347', background: 'none', border: '1px solid #FFB347',
                                borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', marginTop: '4px'
                            }}>
                                View demo profile →
                            </button>
                        )}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={progressData}>
                            <defs>
                                <linearGradient id="nssGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="session_number"
                                tick={{ fill: '#757575', fontSize: 10 }}
                                axisLine={{ stroke: '#333' }}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={(v: number) => fmtKg(v)}
                                tick={{ fill: '#757575', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={45}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="nss"
                                stroke={lineColor}
                                strokeWidth={2}
                                fill="url(#nssGrad)"
                                dot={false}
                                activeDot={{
                                    r: 5,
                                    stroke: lineColor,
                                    strokeWidth: 2,
                                    fill: '#1E1E1E'
                                }}
                                animationDuration={800}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Custom layout ended here, links removed */}

            {/* Help modal */}
            {showHelp && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }} onClick={() => setShowHelp(false)}>
                    <div style={{
                        background: 'var(--bg-secondary)', borderRadius: '16px', padding: '24px',
                        maxWidth: '380px', width: '100%', border: '1px solid #333'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '16px' }}>How Scoring Works</h3>
                            <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} color="var(--text-tertiary)" />
                            </button>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                            <p style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--primary)' }}>What we measure:</strong> Estimated 1 Rep Max strength
                                per session, normalised across all exercises.
                            </p>
                            <p style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--primary)' }}>What we don't measure:</strong> Stamina, endurance, or
                                cardio output. This is a <em>strength</em> progression tracker.
                            </p>
                            <p style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--primary)' }}>Why normalised?</strong> So you can compare a session
                                of bench press with a session of calisthenics. Each exercise has a difficulty factor.
                            </p>
                            <p style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--primary)' }}>Bodyweight exercises:</strong> Scaled by your bodyweight
                                and exercise difficulty (pull-up = 1.0, planche = 4.5).
                            </p>
                            <p style={{ marginBottom: '12px' }}>
                                <strong style={{ color: 'var(--primary)' }}>Switching exercises:</strong> Expect a small dip — mastering
                                a harder move takes time, but score recovers as you improve.
                            </p>
                            <div style={{ padding: '12px', background: 'rgba(255, 179, 71, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 179, 71, 0.3)' }}>
                                <strong style={{ color: '#FFB347', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <Star size={14} /> Demo Mode
                                </strong>
                                Toggle the user icon 👤 at the top to view a perfectly simulated 16-month strength progression from our mock user dataset.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
