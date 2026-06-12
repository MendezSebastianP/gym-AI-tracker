import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Target, Trophy, Rocket, Medal, Crown, Repeat, Zap, Mountain, Sparkles, Lock, User as UserIcon, ArrowLeft, Star, Check } from 'lucide-react';
import { Coin, SecLabel } from '../components/kit';

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

	// completed+unclaimed (claimable) always first
	const activeQuests = quests
		.filter(q => !q.claimed)
		.sort((a, b) => (b.completed ? 1 : 0) - (a.completed ? 1 : 0));
	const completedQuests = quests.filter(q => q.claimed);

	if (loading) {
		return (
			<div className="container">
				<div className="mono" style={{ padding: '80px 0', textAlign: 'center', fontSize: 10.5, color: 'var(--text-4)' }}>
					{t('Loading...')}
				</div>
			</div>
		);
	}

	return (
		<div className="container">
			<header className="page-hdr" style={{ alignItems: 'center' }}>
				<button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('Back')}>
					<ArrowLeft size={20} />
				</button>
				<div className="page-title sm" style={{ flex: 1 }}>{t('Quests')}</div>
				<button
					className="icon-btn sm"
					onClick={() => setIsDemo(!isDemo)}
					aria-label={t('Toggle Demo Mode')}
					style={isDemo ? {
						color: 'var(--reward)',
						borderColor: 'color-mix(in oklab, var(--reward) 40%, transparent)',
						background: 'color-mix(in oklab, var(--reward) 12%, transparent)',
					} : undefined}
				>
					<UserIcon size={18} />
				</button>
			</header>

			{/* Active Quests */}
			<SecLabel>{t('Active')} · {activeQuests.length}</SecLabel>

			{activeQuests.length === 0 ? (
				<div className="topmark" style={{ padding: '26px 0' }}>
					{t('All quests completed!')}
				</div>
			) : (
				activeQuests.map(quest => {
					const IconComponent = ICON_MAP[quest.icon] || Target;
					const progress = Math.min(quest.progress, quest.req_value);
					const pct = Math.round((progress / quest.req_value) * 100);

					return (
						<div key={quest.id} className="card" style={{ marginBottom: 10 }}>
							<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
								<div
									className="ex-thumb"
									style={quest.completed ? { background: 'var(--green-deep)', color: 'var(--lime)', borderColor: 'color-mix(in oklab, var(--lime) 26%, transparent)' } : undefined}
								>
									<IconComponent size={19} />
								</div>

								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
											<span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
												{quest.name}
											</span>
											{quest.is_weekly && <span className="tag">{t('Weekly')}</span>}
										</div>
										<span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
											{progress}/{quest.req_value}
										</span>
									</div>
									<p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 9px', lineHeight: 1.4 }}>
										{quest.description}
									</p>

									<div className="meter">
										<span style={{ width: `${pct}%` }} />
									</div>

									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 }}>
										<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
											<span className="mono num" style={{ fontSize: 9.5, color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 4 }}>
												<Star size={11} fill="currentColor" />{quest.exp_reward} XP
											</span>
											<span className="mono num" style={{ fontSize: 9.5, color: 'var(--reward)', display: 'flex', alignItems: 'center', gap: 4 }}>
												<Coin size={12} />{quest.currency_reward}
											</span>
										</div>

										{quest.completed && !quest.claimed && (
											<button
												className="apply-btn"
												onClick={() => !isDemo && claimReward(quest.id)}
												disabled={!!isDemo || claiming === quest.id}
												style={{ height: 34, padding: '0 15px', opacity: claiming === quest.id ? 0.6 : 1 }}
											>
												{isDemo ? 'Demo' : (claiming === quest.id ? '…' : t('Claim'))}
											</button>
										)}
									</div>
								</div>
							</div>
						</div>
					);
				})
			)}

			{/* Completed (claimed) quests */}
			{completedQuests.length > 0 && (
				<>
					<SecLabel>{t('Completed')} · {completedQuests.length}</SecLabel>
					{completedQuests.map(quest => {
						const IconComponent = ICON_MAP[quest.icon] || Target;
						return (
							<div
								key={quest.id}
								className="card"
								style={{ marginBottom: 8, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}
							>
								<IconComponent size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
										<span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)' }}>{quest.name}</span>
										{quest.is_weekly && <span className="tag" style={{ fontSize: 8 }}>{t('Weekly')}</span>}
									</div>
									<span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{quest.description}</span>
								</div>
								<span className="log-chk"><Check size={15} /></span>
							</div>
						);
					})}
				</>
			)}

			{/* Coming soon */}
			<div className="hero-card" style={{ marginTop: 22 }}>
				<div className="grain" />
				<div className="hero-body" style={{ textAlign: 'center', padding: '22px 18px' }}>
					<Lock size={20} style={{ color: 'var(--green-mid)' }} />
					<div style={{ fontWeight: 800, fontSize: 15.5, marginTop: 8, letterSpacing: '-0.01em' }}>{t('Coming Soon')}</div>
					<p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
						{t('Spend your coins to unlock advanced data insights and premium stats charts')}
					</p>
				</div>
			</div>
		</div>
	);
}
