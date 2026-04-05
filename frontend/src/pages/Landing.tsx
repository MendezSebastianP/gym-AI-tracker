import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	Activity,
	ArrowRight,
	Check,
	ChevronDown,
	Clock3,
	Coins,
	Dumbbell,
	Flame,
	LineChart as LineChartIcon,
	Sparkles,
	TimerReset,
	TrendingUp,
	Wand2,
	Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PublicLegalLinks from '../components/PublicLegalLinks';
import { LiveStreakRow } from '../components/StreakFlames';
import type { WeekSlot } from '../components/StreakFlames';
import CoinIcon from '../components/icons/CoinIcon';
import StarIcon from '../components/icons/StarIcon';
import './Landing.css';

type HeroPanelId = 'log' | 'progress' | 'rewards';
type Translate = (key: string) => string;

interface RevealState {
	ref: React.RefObject<HTMLDivElement>;
	visible: boolean;
}

interface HeroPanelDefinition {
	id: HeroPanelId;
	label: string;
	title: string;
	summary: string;
	render: () => JSX.Element;
}

interface ProofFact {
	icon: typeof Activity;
	label: string;
	detail: string;
	value?: number;
	suffix?: string;
}

interface FeatureSection {
	eyebrow: string;
	title: string;
	description: string;
	bullets: string[];
	icon: typeof Activity;
	preview: JSX.Element;
}

function useReveal(threshold = 0.18): RevealState {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ threshold }
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [threshold]);

	return { ref, visible };
}

function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;

		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
		onChange();

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', onChange);
			return () => mediaQuery.removeEventListener('change', onChange);
		}

		mediaQuery.addListener(onChange);
		return () => mediaQuery.removeListener(onChange);
	}, []);

	return prefersReducedMotion;
}

function Counter({
	end,
	suffix = '',
	start,
	reducedMotion,
	duration = 1200,
}: {
	end: number;
	suffix?: string;
	start: boolean;
	reducedMotion: boolean;
	duration?: number;
}) {
	const [count, setCount] = useState(reducedMotion ? end : 0);

	useEffect(() => {
		if (!start) return;
		if (reducedMotion) {
			setCount(end);
			return;
		}

		let frame = 0;
		const startAt = performance.now();

		const tick = (now: number) => {
			const elapsed = Math.min((now - startAt) / duration, 1);
			const eased = 1 - Math.pow(1 - elapsed, 3);
			setCount(Math.round(end * eased));
			if (elapsed < 1) frame = requestAnimationFrame(tick);
		};

		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [duration, end, reducedMotion, start]);

	return <>{count}{suffix}</>;
}

function MiniTrendChart({
	id,
	data,
	color,
	fill = true,
	className = '',
}: {
	id: string;
	data: number[];
	color: string;
	fill?: boolean;
	className?: string;
}) {
	const width = 320;
	const height = 138;
	const paddingX = 16;
	const paddingY = 18;
	const max = Math.max(...data);
	const min = Math.min(...data);
	const range = max - min || 1;
	const chartWidth = width - paddingX * 2;
	const chartHeight = height - paddingY * 2;

	const points = data.map((value, index) => {
		const x = paddingX + (index / Math.max(data.length - 1, 1)) * chartWidth;
		const y = height - paddingY - ((value - min) / range) * chartHeight;
		return { x, y, value };
	});

	const lastPoint = points[points.length - 1];
	const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
	const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
	const gradientId = `${id}-gradient`;

	return (
		<div className={`landing-mini-chart ${className}`.trim()}>
			<svg viewBox={`0 0 ${width} ${height}`} className="landing-mini-chart-svg" aria-hidden="true">
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={color} stopOpacity="0.26" />
						<stop offset="100%" stopColor={color} stopOpacity="0" />
					</linearGradient>
				</defs>
				{[0.25, 0.5, 0.75].map((ratio) => (
					<line
						key={ratio}
						x1={paddingX}
						x2={width - paddingX}
						y1={paddingY + chartHeight * ratio}
						y2={paddingY + chartHeight * ratio}
						className="landing-mini-chart-gridline"
					/>
				))}
				{fill && <path d={areaPath} fill={`url(#${gradientId})`} className="landing-mini-chart-area" />}
				<path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="landing-mini-chart-path" />
				<path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="landing-mini-chart-path-glow" />
				<circle r="10" fill="none" stroke={color} className="landing-mini-chart-tracer-halo">
					<animateMotion dur="4.2s" begin="1.05s" repeatCount="indefinite" path={linePath} />
				</circle>
				<circle r="4.5" fill={color} className="landing-mini-chart-tracer">
					<animateMotion dur="4.2s" begin="1.05s" repeatCount="indefinite" path={linePath} />
				</circle>
				{points.map((point, index) => (
					<circle
						key={`${id}-${index}`}
						cx={point.x}
						cy={point.y}
						r="4"
						fill={color}
						className={`landing-mini-chart-dot ${index === points.length - 1 ? 'is-last' : ''}`.trim()}
						style={{ animationDelay: `${0.24 + index * 0.06}s, ${1.05 + index * 0.1}s` }}
					/>
				))}
				<circle
					cx={lastPoint.x}
					cy={lastPoint.y}
					r="9"
					fill="none"
					stroke={color}
					className="landing-mini-chart-focus-ring"
				/>
			</svg>
		</div>
	);
}

function WorkoutPreviewCard({
	t,
	interactive = false,
	title = 'Advanced Tuck Front Lever',
}: {
	t: Translate;
	interactive?: boolean;
	title?: string;
}) {
	const [doneSets, setDoneSets] = useState<Set<number>>(new Set([1, 2]));
	const rows = [
		{ id: 1, weight: '0', reps: '10' },
		{ id: 2, weight: '0', reps: '10' },
		{ id: 3, weight: '0', reps: '8', current: true },
	];

	const toggleSet = (id: number) => {
		if (!interactive) return;
		setDoneSets((previous) => {
			const next = new Set(previous);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="landing-workout-shell">
			<div className="landing-workout-toolbar">
				<span className="landing-workout-toolbar-chip">{t('Rest')}</span>
				<span className="landing-workout-toolbar-chip">{t('Stopwatch')}</span>
				<span className="landing-workout-toolbar-chip is-highlight">{t('Suggestions')}</span>
			</div>

			<div className="landing-workout-card">
				<div className="landing-workout-head">
					<div className="landing-workout-title-wrap">
						<strong>{title}</strong>
						<span className="landing-workout-meta">{t('Bodyweight')} · {t('Shoulders')}</span>
					</div>
					<div className="landing-workout-pill">{t('All done')}</div>
				</div>

				{interactive && <div className="landing-workout-note">{t('Tap the set badge to mark it done')}</div>}

				<div className="landing-workout-grid-header">
					<span>{t('SET')}</span>
					<span>+KG</span>
					<span>{t('REPS')}</span>
				</div>

				<div className="landing-workout-rows">
					{rows.map((row) => {
						const isDone = doneSets.has(row.id);
						return (
							<div key={row.id} className={`landing-workout-row ${isDone ? 'is-done' : ''} ${row.current ? 'is-current' : ''}`.trim()}>
								<button type="button" className={`landing-workout-index ${isDone ? 'is-done' : ''}`.trim()} onClick={() => toggleSet(row.id)}>
									{isDone ? <Check size={12} /> : row.id}
								</button>
								<div className="landing-workout-value">{row.weight}</div>
								<div className="landing-workout-value">{row.reps}</div>
							</div>
						);
					})}
				</div>

				<div className="landing-workout-footer">
					<button type="button" className="landing-workout-footer-btn">+ {t('Add Set')}</button>
					<button type="button" className="landing-workout-footer-btn is-drop">+ {t('Add Drop Set')}</button>
				</div>
			</div>
		</div>
	);
}

function HeroSessionPanel({ t }: { t: Translate }) {
	return (
		<div className="landing-preview-panel-shell">
			<div className="landing-preview-header">
				<div>
					<div className="landing-preview-kicker">{t('Active workout')}</div>
					<h3>{t('Push day')}</h3>
				</div>
				<div className="landing-preview-chip is-primary">
					<Clock3 size={14} />
					12:34
				</div>
			</div>

			<WorkoutPreviewCard t={t} title="Archer Push Up" />

			<div className="landing-preview-footer-grid">
				<div className="landing-preview-info-card">
					<div className="landing-preview-info-label">{t('Session tools')}</div>
					<div className="landing-preview-inline-stat">
						<TimerReset size={14} />
						{t('Rest + stopwatch ready')}
					</div>
				</div>
				<div className="landing-preview-info-card">
					<div className="landing-preview-info-label">{t('AI routines')}</div>
					<div className="landing-preview-inline-stat">
						<Wand2 size={14} />
						{t('Suggestions when progress stalls')}
					</div>
				</div>
			</div>
		</div>
	);
}

function HeroStatsPanel({ t }: { t: Translate }) {
	return (
		<div className="landing-preview-panel-shell">
			<div className="landing-preview-header">
				<div>
					<div className="landing-preview-kicker">{t('Progress view')}</div>
					<h3>{t('Review what changed')}</h3>
				</div>
				<div className="landing-preview-chip is-accent">
					<LineChartIcon size={14} />
					+18%
				</div>
			</div>

			<div className="landing-preview-stat-grid">
				<div className="landing-preview-stat-card">
					<span>{t('Volume')}</span>
					<strong>14,280 kg</strong>
				</div>
				<div className="landing-preview-stat-card">
					<span>{t('Best lift')}</span>
					<strong>102.5 kg</strong>
				</div>
				<div className="landing-preview-stat-card">
					<span>{t('Effort tracking')}</span>
					<strong>72 / 100</strong>
				</div>
			</div>

			<div className="landing-preview-chart-card">
				<div className="landing-preview-chart-header">
					<span>{t('Strength trend')}</span>
					<span>{t('Last 8 sessions')}</span>
				</div>
				<MiniTrendChart id="hero-strength" data={[62, 65, 67, 70, 73, 76, 80, 84]} color="var(--primary)" fill />
			</div>

			<div className="landing-preview-stat-tags">
				<span>{t('Strength trend')}</span>
				<span>{t('Effort tracking')}</span>
				<span>{t('Body weight')}</span>
			</div>
		</div>
	);
}

function HeroRewardsPanel({ t, weeks }: { t: Translate; weeks: WeekSlot[] }) {
	return (
		<div className="landing-preview-panel-shell">
			<div className="landing-preview-header">
				<div>
					<div className="landing-preview-kicker">{t('Consistency')}</div>
					<h3>{t('Show the streak, not just the form')}</h3>
				</div>
				<div className="landing-preview-chip is-gold">
					<Coins size={14} />
					42
				</div>
			</div>

			<div className="landing-preview-streak-card">
				<div className="landing-preview-streak-head">
					<span>{t('Weekly streak')}</span>
					<span>{t('2 claimable weeks')}</span>
				</div>
				<LiveStreakRow skinId="skin_a" weeks={weeks} />
			</div>

			<div className="landing-preview-reward-grid">
				<div className="landing-preview-quest-card">
					<div className="landing-preview-quest-top">
						<Flame size={16} />
						<strong>{t('Weekly quest')}</strong>
					</div>
					<p>{t('Complete 3 sessions')}</p>
					<div className="landing-preview-progress-track">
						<div className="landing-preview-progress-fill" style={{ width: '100%' }} />
					</div>
				</div>
				<div className="landing-preview-reward-card">
					<div className="landing-preview-reward-pill">
						<StarIcon size={13} style={{ color: 'var(--primary)' }} /> 120 XP
					</div>
					<div className="landing-preview-reward-pill">
						<CoinIcon size={13} style={{ color: 'var(--gold)' }} /> 21
					</div>
				</div>
			</div>
		</div>
	);
}

function FeaturePreviewLogger({ t }: { t: Translate }) {
	return (
		<div className="landing-feature-preview-surface landing-feature-preview-surface--log">
			<WorkoutPreviewCard t={t} interactive title="One Arm Push Up" />
		</div>
	);
}

function FeaturePreviewCharts({ t }: { t: Translate }) {
	return (
		<div className="landing-feature-preview-surface">
			<div className="landing-chart-showcase">
				<div className="landing-chart-card is-wide">
					<div className="landing-chart-card-head">
						<div>
							<div className="landing-chart-label">{t('Strength Progress')}</div>
							<strong>{t('Strength trend')}</strong>
						</div>
						<span className="landing-chart-caption">+18%</span>
					</div>
					<MiniTrendChart id="feature-strength" data={[58, 60, 63, 66, 70, 73, 77, 82]} color="var(--primary)" fill />
				</div>
				<div className="landing-chart-card">
					<div className="landing-chart-card-head">
						<div>
							<div className="landing-chart-label">{t('Statistics')}</div>
							<strong>{t('Effort tracking')}</strong>
						</div>
						<span className="landing-chart-caption">72</span>
					</div>
					<MiniTrendChart id="feature-effort" data={[58, 61, 60, 67, 72, 76, 71, 79]} color="#FFB347" fill={false} />
				</div>
				<div className="landing-chart-card">
					<div className="landing-chart-card-head">
						<div>
							<div className="landing-chart-label">{t('Statistics')}</div>
							<strong>{t('Body weight')}</strong>
						</div>
						<span className="landing-chart-caption">77.4 kg</span>
					</div>
					<MiniTrendChart id="feature-weight" data={[79.2, 78.9, 78.5, 78.3, 78.1, 77.9, 77.6, 77.4]} color="var(--accent)" fill={false} />
				</div>
			</div>
		</div>
	);
}

function FeaturePreviewAI({ t }: { t: Translate }) {
	return (
		<div className="landing-feature-preview-surface">
			<div className="landing-ai-showcase">
				<div className="landing-ai-builder-card">
					<div className="landing-ai-builder-head">
						<div className="landing-ai-builder-icon"><Wand2 size={18} /></div>
						<div>
							<div className="landing-chart-label">{t('AI routine builder')}</div>
							<strong>{t('Build the routine')}</strong>
						</div>
					</div>
					<p>{t('Generate a routine from your goals, equipment, and training level.')}</p>
					<div className="landing-ai-chip-row">
						<span>{t('strength')}</span>
						<span>4 {t('Days').toLowerCase()}</span>
						<span>{t('Bodyweight')} + {t('Dumbbell')}</span>
					</div>
					<div className="landing-ai-generate-btn">
						<Wand2 size={15} /> {t('Generate with AI')}
						<span className="landing-ai-coin-pill"><CoinIcon size={12} style={{ color: 'var(--gold)' }} /> 50</span>
					</div>
				</div>

				<div className="landing-ai-note-card">
					<div className="landing-ai-note-kicker">{t('AI Coach Note')}</div>
					<strong>{t('Progress suggestions help when a lift stalls.')}</strong>
					<p>{t('You have been stuck at this pattern for a few sessions. Try a slightly easier variation and build back up.')}</p>
				</div>
			</div>
		</div>
	);
}

function FeaturePreviewEconomy({ t, weeks }: { t: Translate; weeks: WeekSlot[] }) {
	return (
		<div className="landing-feature-preview-surface">
			<div className="landing-economy-top">
				<div>
					<div className="landing-chart-label">{t('Active Streak')}</div>
					<strong>7 {t('weeks')}</strong>
				</div>
				<div className="landing-mini-coin-stack">
					<CoinIcon size={14} style={{ color: 'var(--gold)' }} /> 21 + 21
				</div>
			</div>
			<div className="landing-mini-streak-wrap">
				<LiveStreakRow skinId="skin_a" weeks={weeks} />
			</div>
			<div className="landing-economy-grid">
				<div className="landing-preview-quest-card">
					<div className="landing-preview-quest-top">
						<Flame size={16} />
						<strong>{t('Quests')}</strong>
					</div>
					<p>{t('Claim weekly streak rewards and quest progress.')}</p>
					<div className="landing-preview-progress-track">
						<div className="landing-preview-progress-fill" style={{ width: '78%' }} />
					</div>
				</div>
				<div className="landing-economy-shop-card">
					<div className="landing-chart-label">{t('Shop')}</div>
					<strong>{t('Unlock cosmetics in the shop with what you earn.')}</strong>
					<div className="landing-preview-reward-pill">
						<StarIcon size={13} style={{ color: 'var(--primary)' }} /> Gold Theme
					</div>
				</div>
			</div>
		</div>
	);
}

export default function Landing() {
	const { t } = useTranslation();
	const prefersReducedMotion = usePrefersReducedMotion();
	const [scrolled, setScrolled] = useState(false);
	const [activePanel, setActivePanel] = useState(0);
	const [panelsPaused, setPanelsPaused] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 18);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const heroWeeks: WeekSlot[] = useMemo(() => ([
		{ week: 'W1', start_date: '2026-02-10', sessions: 2, claimed: true },
		{ week: 'W2', start_date: '2026-02-17', sessions: 3, claimed: true },
		{ week: 'W3', start_date: '2026-02-24', sessions: 2, claimed: true },
		{ week: 'W4', start_date: '2026-03-03', sessions: 1, claimed: true },
		{ week: 'W5', start_date: '2026-03-10', sessions: 2, claimed: true },
		{ week: 'W6', start_date: '2026-03-17', sessions: 3, claimed: false },
		{ week: 'W7', start_date: '2026-03-24', sessions: 2, claimed: false },
	]), []);

	const heroPanels: HeroPanelDefinition[] = useMemo(() => ([
		{
			id: 'log',
			label: t('Log'),
			title: t('Track the session while you lift'),
			summary: t('Sets, timers, and suggestions stay next to the workout.'),
			render: () => <HeroSessionPanel t={t} />,
		},
		{
			id: 'progress',
			label: t('Progress'),
			title: t('Review useful progress, not noise'),
			summary: t('Stats stay focused on volume, strength, and what changed.'),
			render: () => <HeroStatsPanel t={t} />,
		},
		{
			id: 'rewards',
			label: t('Rewards'),
			title: t('Keep consistency visible'),
			summary: t('Streaks, quests, XP, and coins support the training loop.'),
			render: () => <HeroRewardsPanel t={t} weeks={heroWeeks} />,
		},
	]), [heroWeeks, t]);

	useEffect(() => {
		if (prefersReducedMotion || panelsPaused) return;

		const intervalId = window.setInterval(() => {
			setActivePanel((current) => (current + 1) % heroPanels.length);
		}, 3800);

		return () => window.clearInterval(intervalId);
	}, [heroPanels.length, panelsPaused, prefersReducedMotion]);

	const proofReveal = useReveal(0.2);
	const sectionOneReveal = useReveal(0.18);
	const sectionTwoReveal = useReveal(0.18);
	const sectionThreeReveal = useReveal(0.18);
	const sectionFourReveal = useReveal(0.18);
	const stepsReveal = useReveal(0.2);
	const ctaReveal = useReveal(0.2);

	const proofFacts: ProofFact[] = useMemo(() => ([
		{ icon: Wand2, label: t('AI routines'), detail: t('Generate from goals and equipment') },
		{ icon: LineChartIcon, label: t('Readable charts'), detail: t('Strength, effort, and body weight') },
		{ icon: Coins, label: t('XP, coins, and weekly quests'), detail: t('Rewards tied to real training') },
		{ icon: Dumbbell, value: 200, suffix: '+', label: t('Exercises'), detail: t('Bodyweight, weights, and cardio') },
	]), [t]);

	const featureSections: FeatureSection[] = useMemo(() => ([
		{
			eyebrow: t('See your training clearly'),
			title: t('Good charts make progress easier to read'),
			description: t('Strength, effort, and body weight become more useful when the visuals stay clean.'),
			bullets: [
				t('See the trend instead of guessing from one workout.'),
				t('The same charts work well on phone and desktop.'),
			],
			icon: TrendingUp,
			preview: <FeaturePreviewCharts t={t} />,
		},
		{
			eyebrow: t('Use AI where it helps'),
			title: t('Build routines and adjust them faster'),
			description: t('Generate a plan from your goals, then refine it with suggestions instead of rebuilding everything by hand.'),
			bullets: [
				t('AI wizard uses your goals and equipment.'),
				t('Progress suggestions help when a lift stalls.'),
			],
			icon: Sparkles,
			preview: <FeaturePreviewAI t={t} />,
		},
		{
			eyebrow: t('Log fast'),
			title: t('Tap through a session without losing focus'),
			description: t('The logger keeps sets, timers, and progression help close to the lift so you can move quickly.'),
			bullets: [
				t('Tap sets done as you go.'),
				t('Rest, stopwatch, and suggestions stay in reach.'),
			],
			icon: Activity,
			preview: <FeaturePreviewLogger t={t} />,
		},
		{
			eyebrow: t('Stay consistent'),
			title: t('XP, coins, quests, and streaks keep the loop alive'),
			description: t('Rewards stay attached to real training activity, so they support the habit instead of distracting from it.'),
			bullets: [
				t('Claim weekly streak rewards and quest progress.'),
				t('Unlock cosmetics in the shop with what you earn.'),
			],
			icon: Flame,
			preview: <FeaturePreviewEconomy t={t} weeks={heroWeeks} />,
		},
	]), [heroWeeks, t]);

	const steps = useMemo(() => ([
		{
			number: '01',
			title: t('Create the account'),
			description: t('Sign up, set your language, and keep the app ready on phone or desktop.'),
		},
		{
			number: '02',
			title: t('Build the routine'),
			description: t('Use the AI builder or create the split yourself from the exercise library.'),
		},
		{
			number: '03',
			title: t('Log and review'),
			description: t('Track sessions, compare progress, and keep the streak moving.'),
		},
	]), [t]);

	const sectionReveals = [sectionOneReveal, sectionTwoReveal, sectionThreeReveal, sectionFourReveal];

	return (
		<div className="landing">
			<nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
				<Link to="/" className="landing-nav-logo" aria-label="Kairos lift home">
					KAIROS <span>lift</span>
				</Link>
				<div className="landing-nav-actions">
					<LanguageSwitcher compact />
					<Link to="/login" className="landing-nav-link motion-btn motion-btn--cta motion-btn--soft motion-btn--public">{t('Login')}</Link>
					<Link to="/register" className="landing-nav-cta motion-btn motion-btn--cta motion-btn--public">{t('Register')}</Link>
				</div>
			</nav>

			<section className="landing-hero">
				<div className="landing-hero-bg" aria-hidden="true">
					<div className="landing-hero-grid" />
					<div className="landing-hero-spotlight is-left" />
					<div className="landing-hero-spotlight is-right" />
				</div>

				<div className="landing-hero-layout">
					<div className="landing-hero-copy">
						<div className="landing-hero-badge">
							<Zap size={14} />
							{t('Training log with AI, charts, and rewards')}
						</div>
						<h1>{t('Log sessions fast. Review progress clearly.')}</h1>
						<p className="landing-hero-subtitle">
							{t('Track sets, follow routines, compare progress, and keep the data on your own setup.')}
						</p>
						<div className="landing-hero-ctas">
							<Link to="/register" className="landing-btn-big primary motion-btn motion-btn--cta motion-btn--public">
								{t('Create account')} <ArrowRight size={18} className="motion-btn__icon" />
							</Link>
							<a href="#landing-product" className="landing-btn-big secondary motion-btn motion-btn--cta motion-btn--soft motion-btn--public">
								{t('See the product')}
							</a>
						</div>
						<div className="landing-hero-microcopy">
							<span><Wand2 size={14} /> {t('AI routine builder')}</span>
							<span><Coins size={14} /> {t('Charts + rewards')}</span>
						</div>
					</div>

					<div
						className="landing-panel-stage"
						onMouseEnter={() => setPanelsPaused(true)}
						onMouseLeave={() => setPanelsPaused(false)}
						onTouchStart={() => setPanelsPaused(true)}
					>
						<div className="landing-panel-topbar">
							<div className="landing-panel-selector" role="tablist" aria-label={t('Landing preview tabs')}>
								{heroPanels.map((panel, index) => (
									<button
										key={panel.id}
										className={`landing-panel-selector-btn ${index === activePanel ? 'active' : ''}`}
										role="tab"
										aria-selected={index === activePanel}
										onClick={() => {
											setActivePanel(index);
											setPanelsPaused(true);
										}}
									>
										{panel.label}
									</button>
								))}
							</div>
							<div className="landing-panel-pagination" aria-label={t('Landing preview tabs')}>
								{heroPanels.map((panel, index) => (
									<button
										key={`${panel.id}-dot`}
										type="button"
										className={`landing-panel-page-dot ${index === activePanel ? 'active' : ''}`.trim()}
										aria-label={panel.label}
										aria-pressed={index === activePanel}
										onClick={() => {
											setActivePanel(index);
											setPanelsPaused(true);
										}}
									/>
								))}
							</div>
						</div>

						<div className="landing-panel-copy">
							<h2>{heroPanels[activePanel].title}</h2>
							<p>{heroPanels[activePanel].summary}</p>
						</div>

						<div className="landing-panel-stack">
							{heroPanels.map((panel, index) => {
								const relative = (index - activePanel + heroPanels.length) % heroPanels.length;
								const panelState = relative === 0 ? 'is-active' : relative === 1 ? 'is-next' : 'is-prev';
								return (
									<div key={panel.id} className={`landing-panel-card ${panelState}`} aria-hidden={relative !== 0}>
										{panel.render()}
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<a href="#landing-product" className="landing-scroll-hint">
					<span>{t('Scroll to see more')}</span>
					<div className="landing-scroll-chevron-wrap" aria-hidden="true">
						<ChevronDown size={16} />
						<ChevronDown size={16} />
					</div>
				</a>
			</section>

			<section id="landing-product" className="landing-proof-strip" ref={proofReveal.ref}>
				<div className={`landing-proof-grid ${proofReveal.visible ? 'visible' : ''}`}>
					{proofFacts.map((fact) => {
						const Icon = fact.icon;
						return (
							<div key={fact.label} className="landing-proof-card">
								<div className="landing-proof-icon"><Icon size={18} /></div>
								<div className="landing-proof-copy">
									{typeof fact.value === 'number' ? (
										<div className="landing-proof-metric-line">
											<div className="landing-proof-value">
												<Counter end={fact.value} suffix={fact.suffix} start={proofReveal.visible} reducedMotion={prefersReducedMotion} />
											</div>
											<div className="landing-proof-metric-label">{fact.label}</div>
										</div>
									) : (
										<div className="landing-proof-value">{fact.label}</div>
									)}
									<div className="landing-proof-label">{fact.detail}</div>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			<section className="landing-section">
				<div className="landing-section-heading">
					<span className="landing-section-kicker">{t("What you'll actually use")}</span>
					<h2>{t('Fast logging, clear charts, AI help, and rewards that make training easier to stick with.')}</h2>
				</div>

				<div className="landing-feature-stack">
					{featureSections.map((section, index) => {
						const Icon = section.icon;
						const reveal = sectionReveals[index];
						return (
							<div
								key={section.title}
								ref={reveal.ref}
								className={`landing-feature-split ${index % 2 === 1 ? 'reverse' : ''} ${reveal.visible ? 'visible' : ''}`}
							>
								<div className="landing-feature-copy-block">
									<div className="landing-feature-eyebrow">
										<Icon size={14} /> {section.eyebrow}
									</div>
									<h3>{section.title}</h3>
									<p>{section.description}</p>
									<ul>
										{section.bullets.map((bullet) => (
											<li key={bullet}><Check size={14} /> {bullet}</li>
										))}
									</ul>
								</div>
								<div className="landing-feature-preview-wrap">{section.preview}</div>
							</div>
						);
					})}
				</div>
			</section>

			<section className="landing-section landing-steps-section" ref={stepsReveal.ref}>
				<div className="landing-section-heading compact">
					<span className="landing-section-kicker">{t('Start quickly')}</span>
					<h2>{t('Set it up once. Then just train.')}</h2>
				</div>
				<div className={`landing-steps-grid ${stepsReveal.visible ? 'visible' : ''}`}>
					{steps.map((step) => (
						<div key={step.number} className="landing-step-card">
							<span className="landing-step-number">{step.number}</span>
							<h3>{step.title}</h3>
							<p>{step.description}</p>
						</div>
					))}
				</div>
			</section>

			<section className="landing-final-cta" ref={ctaReveal.ref}>
				<div className={`landing-final-cta-card ${ctaReveal.visible ? 'visible' : ''}`}>
					<div>
						<span className="landing-section-kicker">{t('Ready when you are')}</span>
						<h2>{t('Create the account. Build the routine. Start logging.')}</h2>
						<p>{t('If you want a workout tracker that stays useful after the first week, start here.')}</p>
					</div>
					<div className="landing-final-cta-actions">
						<Link to="/register" className="landing-btn-big primary motion-btn motion-btn--cta motion-btn--public">{t('Register')}</Link>
						<Link to="/login" className="landing-btn-big secondary motion-btn motion-btn--cta motion-btn--soft motion-btn--public">{t('Login')}</Link>
					</div>
				</div>
			</section>

			<footer className="landing-footer">
				<div>Kairos lift · {t('Offline-first training journal')}</div>
				<PublicLegalLinks centered compact />
			</footer>
		</div>
	);
}
