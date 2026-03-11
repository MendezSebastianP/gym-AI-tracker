import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scroll, Target, Trophy, Rocket, Medal, Crown, Repeat, Zap, Mountain, Sparkles, CheckCircle, Lock, User as UserIcon, ArrowLeft } from 'lucide-react';

interface QuestData {
    id: number;
    quest_id: number;
    name: string;
    description: string;
    icon: string;
    req_type: string;
    req_value: number;
    exp_reward: number;
    currency_reward: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
    completed_at: string | null;
    is_weekly?: boolean;
}

const ICON_MAP: Record<string, any> = {
    target: Target,
    footprints: Target,
    rocket: Rocket,
    trophy: Trophy,
    medal: Medal,
    crown: Crown,
    repeat: Repeat,
    zap: Zap,
    weight: Target,
    mountain: Mountain,
    sparkles: Sparkles,
};

export default function Quests() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [quests, setQuests] = useState<QuestData[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState<number | null>(null);
    const [isDemo, setIsDemo] = useState(false);

    useEffect(() => {
        loadQuests();
    }, [isDemo]);

    const loadQuests = async () => {
        try {
            const endpoint = isDemo ? '/gamification/quests/demo' : '/gamification/quests';
            const res = await api.get(endpoint);
            setQuests(res.data);
        } catch (e) {
            console.error('Failed to load quests', e);
        } finally {
            setLoading(false);
        }
    };

    const claimReward = async (userQuestId: number) => {
        setClaiming(userQuestId);
        try {
            const res = await api.post(`/gamification/quests/${userQuestId}/claim`);
            // Emit gamification event for the toast
            if (res.data && !res.data.error) {
                window.dispatchEvent(new CustomEvent('gamification-reward', {
                    detail: {
                        xp_gained: res.data.exp_reward,
                        rep_prs: 0,
                        weight_prs: 0,
                        leveled_up: res.data.leveled_up,
                        new_level: res.data.new_level,
                        old_level: res.data.new_level - (res.data.leveled_up ? 1 : 0),
                        experience: res.data.experience,
                        exp_to_next: res.data.exp_to_next,
                        currency: res.data.currency,
                    }
                }));
            }
            await loadQuests();
        } catch (e) {
            console.error('Failed to claim quest', e);
        } finally {
            setClaiming(null);
        }
    };

    const activeQuests = quests.filter(q => !q.claimed);
    const completedQuests = quests.filter(q => q.claimed);

    if (loading) {
        return <div className="container flex-center fade-in">{t('Loading...')}</div>;
    }

    return (
        <div className="container" style={{ paddingBottom: '90px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => navigate(-1)} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--text-secondary)'
                    }}>
                        <ArrowLeft size={24} />
                    </button>
                    <Scroll size={28} color="var(--primary)" />
                    <h1 className="text-2xl font-bold">{t('Quests')}</h1>
                </div>
                <button
                    onClick={() => setIsDemo(!isDemo)}
                    style={{
                        background: isDemo ? 'rgba(255,179,71,0.15)' : 'none',
                        border: isDemo ? '1px solid #FFB347' : '1px solid transparent',
                        borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                >
                    <UserIcon size={18} color={isDemo ? '#FFB347' : 'var(--text-tertiary)'} />
                    {isDemo && <span style={{ fontSize: '11px', color: '#FFB347', fontWeight: 600 }}>Demo</span>}
                </button>
            </div>

            {/* Active Quests */}
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('Active')}
                </h2>

                {activeQuests.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                        <Trophy size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                        <p>{t('All quests completed!')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {activeQuests.map(quest => {
                            const IconComponent = ICON_MAP[quest.icon] || Target;
                            const progress = Math.min(quest.progress, quest.req_value);
                            const pct = Math.round((progress / quest.req_value) * 100);

                            return (
                                <div key={quest.id} className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        {/* Icon */}
                                        <div style={{
                                            width: '42px', height: '42px', borderRadius: '12px',
                                            background: quest.completed
                                                ? 'linear-gradient(135deg, rgba(204, 255, 0, 0.2), rgba(99, 102, 241, 0.1))'
                                                : 'rgba(255, 255, 255, 0.05)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                            border: quest.completed ? '1px solid rgba(204, 255, 0, 0.3)' : '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            <IconComponent size={20} color={quest.completed ? 'var(--primary)' : 'var(--text-tertiary)'} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{quest.name}</h3>
                                                    {quest.is_weekly && (
                                                        <span style={{
                                                            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                                                            background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1',
                                                            padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px'
                                                        }}>Weekly</span>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                    {progress}/{quest.req_value}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                                                {quest.description}
                                            </p>

                                            {/* Progress bar */}
                                            <div style={{
                                                height: '6px', borderRadius: '3px',
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                overflow: 'hidden', marginBottom: '8px'
                                            }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '3px',
                                                    width: `${pct}%`,
                                                    background: quest.completed
                                                        ? 'linear-gradient(90deg, var(--primary), #6366f1)'
                                                        : 'var(--primary)',
                                                    transition: 'width 0.5s ease'
                                                }} />
                                            </div>

                                            {/* Rewards + Claim */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                                                        ⭐ {quest.exp_reward} XP
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#FFD700', fontWeight: 600 }}>
                                                        🪙 {quest.currency_reward}
                                                    </span>
                                                </div>

                                                {quest.completed && !quest.claimed && (
                                                    <button
                                                        onClick={() => !isDemo && claimReward(quest.id)}
                                                        disabled={!!isDemo || claiming === quest.id}
                                                        style={{
                                                            padding: '6px 16px', fontSize: '12px',
                                                            fontWeight: 700, borderRadius: '8px',
                                                            background: isDemo ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, var(--primary), var(--primary-dim))',
                                                            color: isDemo ? 'var(--text-tertiary)' : '#000',
                                                            border: 'none',
                                                            cursor: isDemo ? 'not-allowed' : 'pointer',
                                                            opacity: claiming === quest.id ? 0.6 : 1,
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isDemo ? 'Demo' : (claiming === quest.id ? '...' : t('Claim'))}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Completed (claimed) quests */}
            {completedQuests.length > 0 && (
                <div>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('Completed')}
                    </h2>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {completedQuests.map(quest => {
                            const IconComponent = ICON_MAP[quest.icon] || Target;
                            return (
                                <div key={quest.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    opacity: 0.6
                                }}>
                                    <IconComponent size={18} color="var(--text-tertiary)" style={{ marginTop: '2px' }} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{quest.name}</span>
                                            {quest.is_weekly && (
                                                <span style={{
                                                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                                                    background: 'rgba(99, 102, 241, 0.1)', color: 'var(--text-tertiary)',
                                                    padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px'
                                                }}>Weekly</span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{quest.description}</span>
                                    </div>
                                    <CheckCircle size={16} color="var(--success)" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Coming soon: Data Insights */}
            <div style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                textAlign: 'center'
            }}>
                <Lock size={24} color="rgba(99, 102, 241, 0.5)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {t('Coming Soon')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {t('Spend your coins to unlock advanced data insights and premium stats charts')}
                </div>
            </div>
        </div>
    );
}
