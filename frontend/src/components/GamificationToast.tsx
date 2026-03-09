import { useState, useEffect } from 'react';
import { Star, TrendingUp, Zap, X, Trophy } from 'lucide-react';

interface GamificationReward {
    xp_gained: number;
    rep_prs: number;
    weight_prs: number;
    leveled_up: boolean;
    new_level: number;
    old_level: number;
    experience: number;
    exp_to_next: number;
    currency: number;
}

export default function GamificationToast() {
    const [reward, setReward] = useState<GamificationReward | null>(null);
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as GamificationReward;
            setReward(detail);
            setVisible(true);
            setClosing(false);
        };
        window.addEventListener('gamification-reward', handler);
        return () => window.removeEventListener('gamification-reward', handler);
    }, []);

    useEffect(() => {
        if (visible && !closing) {
            const timer = setTimeout(() => {
                setClosing(true);
                setTimeout(() => {
                    setVisible(false);
                    setClosing(false);
                    setReward(null);
                }, 400);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [visible, closing]);

    if (!visible || !reward) return null;

    const dismiss = () => {
        setClosing(true);
        setTimeout(() => {
            setVisible(false);
            setClosing(false);
            setReward(null);
        }, 400);
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: '16px',
                left: '50%',
                transform: `translateX(-50%) ${closing ? 'translateY(-120%)' : 'translateY(0)'}`,
                zIndex: 9999,
                width: '90%',
                maxWidth: '380px',
                background: reward.leveled_up
                    ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1))'
                    : 'linear-gradient(135deg, rgba(204, 255, 0, 0.12), rgba(99, 102, 241, 0.08))',
                border: reward.leveled_up
                    ? '1px solid rgba(255, 215, 0, 0.4)'
                    : '1px solid rgba(204, 255, 0, 0.3)',
                borderRadius: '16px',
                padding: '16px 20px',
                backdropFilter: 'blur(20px)',
                boxShadow: reward.leveled_up
                    ? '0 8px 32px rgba(255, 215, 0, 0.2)'
                    : '0 8px 32px rgba(0, 0, 0, 0.4)',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s',
                opacity: closing ? 0 : 1,
                animation: !closing ? 'slideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
            }}
        >
            <style>{`
				@keyframes slideDown {
					from { transform: translateX(-50%) translateY(-120%); opacity: 0; }
					to { transform: translateX(-50%) translateY(0); opacity: 1; }
				}
				@keyframes shimmer {
					0% { background-position: -200% 0; }
					100% { background-position: 200% 0; }
				}
			`}</style>

            {/* Close button */}
            <button
                onClick={dismiss}
                style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', padding: '4px'
                }}
            >
                <X size={16} />
            </button>

            {/* Level up header */}
            {reward.leveled_up && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '12px', padding: '8px 12px',
                    background: 'linear-gradient(90deg, rgba(255,215,0,0.2), rgba(255,165,0,0.1), rgba(255,215,0,0.2))',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s ease-in-out infinite',
                    borderRadius: '10px'
                }}>
                    <Trophy size={22} color="#FFD700" />
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#FFD700' }}>
                            Level Up!
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 215, 0, 0.8)' }}>
                            Level {reward.old_level} → Level {reward.new_level}
                        </div>
                    </div>
                </div>
            )}

            {/* XP earned */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(204, 255, 0, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                }}>
                    <Star size={20} color="#CCFF00" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                        +{reward.xp_gained} XP
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {reward.experience} / {reward.exp_to_next} to next level
                    </div>
                </div>
            </div>

            {/* PR badges */}
            {(reward.rep_prs > 0 || reward.weight_prs > 0) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {reward.rep_prs > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '8px', padding: '4px 10px',
                            fontSize: '12px', color: '#818cf8'
                        }}>
                            <TrendingUp size={14} />
                            {reward.rep_prs} Rep PR{reward.rep_prs > 1 ? 's' : ''}
                        </div>
                    )}
                    {reward.weight_prs > 0 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(255, 107, 107, 0.15)',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            borderRadius: '8px', padding: '4px 10px',
                            fontSize: '12px', color: '#FF6B6B'
                        }}>
                            <Zap size={14} />
                            {reward.weight_prs} Weight PR{reward.weight_prs > 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            )}

            {/* Currency earned on level up */}
            {reward.leveled_up && (
                <div style={{
                    marginTop: '8px', fontSize: '12px', color: '#FFD700',
                    display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                    🪙 +10 coins earned!
                </div>
            )}
        </div>
    );
}
