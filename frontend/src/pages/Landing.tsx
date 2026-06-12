import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BarChart3, Check } from 'lucide-react';
import KairosLogo from '../components/KairosLogo';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PublicLegalLinks from '../components/PublicLegalLinks';
import { K } from '../components/kit';
import './Landing.css';
import '../components/PublicAuthShell.css';

/* ── tiny scroll-reveal ───────────────────────────────────────────── */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [on, setOn] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } },
			{ threshold: 0.18 }
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);
	return (
		<div ref={ref} className={`ld-rev ${on ? 'is-in' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
			{children}
		</div>
	);
}

/* ── count-up number ──────────────────────────────────────────────── */
function CountUp({ end, suffix }: { end: number; suffix?: string }) {
	const ref = useRef<HTMLElement>(null);
	const [val, setVal] = useState(0);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(end); return; }
		const io = new IntersectionObserver(([e]) => {
			if (!e.isIntersecting) return;
			io.disconnect();
			const t0 = performance.now();
			const dur = 900;
			const tick = (now: number) => {
				const p = Math.min(1, (now - t0) / dur);
				setVal(Math.round(end * (1 - Math.pow(1 - p, 3))));
				if (p < 1) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}, { threshold: 0.4 });
		io.observe(el);
		return () => io.disconnect();
	}, [end]);
	return <b ref={ref}>{val}{suffix && <small>{suffix}</small>}</b>;
}

/* ── interactive set-logging demo ─────────────────────────────────── */
const DEMO_SETS = [
	{ n: 1, kg: 60, reps: 8 },
	{ n: 2, kg: 60, reps: 8 },
	{ n: 3, kg: 62.5, reps: 6 },
];

function HeroDemo({ t }: { t: (k: string) => string }) {
	const [done, setDone] = useState<Set<number>>(new Set());
	const allDone = done.size === DEMO_SETS.length;
	const toggle = (n: number) => {
		setDone(prev => {
			const next = new Set(prev);
			if (next.has(n)) next.delete(n);
			else {
				next.add(n);
				if (navigator.vibrate) navigator.vibrate(8);
			}
			return next;
		});
	};

	return (
		<div className="ld-demo">
			<div className="ld-demo-tag">
				<span className="dot" />
				<span className="mono">{t('Try it')}</span>
				<span className="hint-tx">{t('Tap the circles')}</span>
			</div>

			<div className="ld-demo-card">
				{allDone && (
					<div className="ld-demo-stamp">
						<span className="stamp">{t('LOGGED')}</span>
						<span className="xp">+50 XP · {t('That fast. Every set.')}</span>
						<button className="again" onClick={() => setDone(new Set())}>{t('Run it back')}</button>
					</div>
				)}

				<div className="ex-head" style={{ paddingBottom: 8 }}>
					<div className="ex-thumb" style={{ width: 40, height: 40 }}><K.dumbbell width={20} height={20} /></div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<span className="ex-name" style={{ fontSize: 15.5 }}>Bench Press</span>
						<div className="ex-meta">
							<span className="tag">Barbell</span>
							<span className="tag">Chest</span>
						</div>
					</div>
					<span className="mono num" style={{ fontSize: 9.5, color: 'var(--text-3)', flexShrink: 0 }}>
						{done.size}/{DEMO_SETS.length}
					</span>
				</div>

				<div className="set-tablehdr" style={{ gridTemplateColumns: '40px 1fr 1fr 40px' }}>
					<span>{t('Set')}</span>
					<span>kg</span>
					<span>{t('Reps')}</span>
					<span></span>
				</div>

				{DEMO_SETS.map((s, i) => {
					const isDone = done.has(s.n);
					const isArmed = !isDone && done.size === i;
					return (
						<div key={s.n} className={`set-row ${isArmed ? 'armed' : ''}`} style={{ gridTemplateColumns: '40px 1fr 1fr 40px', cursor: 'pointer' }} onClick={() => toggle(s.n)}>
							<button
								className={`set-circle ${isDone ? 'done flash' : ''}`}
								onClick={(e) => { e.stopPropagation(); toggle(s.n); }}
								aria-label={`Set ${s.n}`}
							>
								{isDone ? <Check size={15} /> : s.n}
							</button>
							<div className="nf num" style={{ cursor: 'pointer' }}><span className="nf-val">{s.kg}</span></div>
							<div className="nf num" style={{ cursor: 'pointer' }}><span className="nf-val">{s.reps}</span></div>
							<span style={{ display: 'flex', justifyContent: 'center', color: isDone ? 'var(--lime)' : 'var(--text-4)' }}>
								{isDone && <Check size={15} />}
							</span>
						</div>
					);
				})}

				<div style={{ padding: '11px 14px 13px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
					<div className="meter"><span style={{ width: `${(done.size / DEMO_SETS.length) * 100}%` }} /></div>
					<span className="mono num" style={{ fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
						{Math.round((done.size / DEMO_SETS.length) * 100)}%
					</span>
				</div>
			</div>
		</div>
	);
}

/* ── the receipt — last 10 weeks as a till print ──────────────────── */
const RECEIPT = [
	{ wk: 'W01', kg: 12 }, { wk: 'W02', kg: 18 }, { wk: 'W04', kg: 24 },
	{ wk: 'W06', kg: 30 }, { wk: 'W08', kg: 46 }, { wk: 'W10', kg: 60 },
];
const RC_MAX = 60;

export default function Landing() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const marqueeWords = ['Train', 'Log', 'Repeat', 'No excuses', 'Every set counts', 'Offline-first'];

	const features = [
		{ no: '01', key: true, ic: <K.spark width={19} height={19} />, title: t('AI routines'), desc: t('Generate a split from your goals and equipment. Swap what you don\'t like.') },
		{ no: '02', ic: <BarChart3 size={19} />, title: t('Readable charts'), desc: t('Strength, effort and body weight — at a glance.') },
		{ no: '03', ic: <K.flame width={19} height={19} />, title: t('Momentum'), desc: t('Streaks, quests and milestones that keep the loop going.') },
		{ no: '04', ic: <K.dumbbell width={19} height={19} />, title: t('200+ exercises'), desc: t('Bodyweight, weights and cardio in the library.') },
	];

	const steps = [
		{ no: 'STEP 01', title: t('Create the account'), desc: t('Pick your language and keep the app offline-first.') },
		{ no: 'STEP 02', title: t('Build the routine'), desc: t('Use the AI builder or pick from the exercise library.') },
		{ no: 'STEP 03', title: t('Log and review'), desc: t('Track each set, then watch the numbers move.') },
	];

	return (
		<div className="ld-page">
			<div className="ld-col">
				{/* top bar */}
				<div className="ld-topbar">
					<KairosLogo size="sm" />
					<span className="spacer" />
					<LanguageSwitcher />
					<Link to="/login" className="ld-login-link">{t('Login')}</Link>
				</div>

				{/* hero */}
				<section className="ld-hero">
					<span className="ld-eyebrow"><span className="ey-line" />{t('Offline-first training log')}</span>
					<h1 className="ld-h1">
						{t('Log fast.')}<br />
						{t('Lift')} <span className="outline">{t('heavy.')}</span><br />
						<span className="accent">{t('See it move.')}</span>
					</h1>
					<p className="ld-lede">
						{t('A no-nonsense lifting tracker. Plan routines, log every set, and watch the numbers move — no fluff.')}
					</p>
				</section>

				{/* marquee */}
				<div className="ld-marquee" aria-hidden="true">
					<div className="ld-marquee-track">
						{[0, 1].map(copy => (
							marqueeWords.map((w, i) => (
								<span key={`${copy}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 26 }}>
									<span className={i % 3 === 1 ? 'lit' : ''}>{t(w)}</span>
									<i />
								</span>
							))
						))}
					</div>
				</div>

				{/* live demo */}
				<Reveal>
					<HeroDemo t={t} />
				</Reveal>

				{/* CTAs */}
				<div className="ld-cta-stack">
					<button className="btn-primary" onClick={() => navigate('/register')}>
						{t('Create account')}
					</button>
					<button className="btn-quiet" style={{ height: 56, borderRadius: 15, fontSize: 16 }} onClick={() => navigate('/login')}>
						{t('I already have one')}<ArrowRight size={17} />
					</button>
				</div>
				<div className="ld-cta-note">
					<b>{t('Free to use.')}</b> {t('Your data stays in your own training journal.')}
				</div>

				{/* stat strip */}
				<Reveal>
					<div className="ld-stats">
						<div className="ld-stat">
							<CountUp end={200} suffix="+" />
							<span>{t('Exercises')}</span>
						</div>
						<div className="ld-stat">
							<CountUp end={12} />
							<span>{t('Progression chains')}</span>
						</div>
						<div className="ld-stat">
							<CountUp end={100} suffix="%" />
							<span>{t('Offline-ready')}</span>
						</div>
					</div>
				</Reveal>

				{/* features */}
				<div className="ld-sec-tag"><span className="st-label">{t('What you get')}</span><span className="st-line" /></div>
				<div className="ld-feat-list">
					{features.map((f, i) => (
						<Reveal key={f.no} delay={i * 60}>
							<div className={`ld-feat ${f.key ? 'is-key' : ''}`}>
								<span className="ld-feat-no num">{f.no}</span>
								<div className="ld-feat-tx">
									<b>{f.title}</b>
									<p>{f.desc}</p>
								</div>
								<span className="ld-feat-ic">{f.ic}</span>
							</div>
						</Reveal>
					))}
				</div>

				{/* the receipt */}
				<div className="ld-sec-tag"><span className="st-label">{t('Clear progress')}</span><span className="st-line" /></div>
				<Reveal>
					<div className="ld-receipt">
						<div className="ld-rc-head">Kairos — {t('Training log')}</div>
						<div className="ld-rc-sub">{t('Bench press · top set · 10 weeks')}</div>
						<hr className="ld-rc-sep" />
						{RECEIPT.map(r => (
							<div className="ld-rc-row" key={r.wk}>
								<span>{r.wk}</span>
								<span className="kg">{r.kg} kg</span>
								<span className="ld-rc-bar" style={{ width: `${(r.kg / RC_MAX) * 100}%` }} />
							</div>
						))}
						<hr className="ld-rc-sep" />
						<div className="ld-rc-total">
							<span>{t('Total')}</span>
							<span className="val">+38% {t('strength')}</span>
						</div>
						<div className="ld-rc-barcode" />
						<div className="ld-rc-code">no·fluff·just·numbers</div>
					</div>
				</Reveal>

				{/* how it works */}
				<div className="ld-sec-tag"><span className="st-label">{t('Set it up once. Then just train.')}</span><span className="st-line" /></div>
				<div className="ld-steps">
					{steps.map((s, i) => (
						<Reveal key={s.no} delay={i * 60}>
							<div className="ld-step">
								<span className="ld-step-no">{s.no}</span>
								<b>{s.title}</b>
								<p>{s.desc}</p>
							</div>
						</Reveal>
					))}
				</div>

				{/* poster closer */}
				<Reveal>
					<div className="ld-poster">
						<div className="hatch" />
						<div className="ghost" aria-hidden="true">KAIROS</div>
						<div className="grain" />
						<span className="kicker">Est. 2026 · {t('Built for the rack, not the feed')}</span>
						<div className="big">NO<br /><span className="lime">EXCUSES.</span></div>
						<div className="ld-cta-stack">
							<button className="btn-primary" onClick={() => navigate('/register')}>
								{t('Create account')}
							</button>
							<button className="btn-quiet" style={{ height: 52, borderRadius: 14, fontSize: 15 }} onClick={() => navigate('/login')}>
								{t('I already have one')}
							</button>
						</div>
						<div className="slash" />
					</div>
				</Reveal>

				{/* legal foot */}
				<div className="legalfoot">
					<span className="lf-brand mono">Kairos lift · {t('Offline-first training log')}</span>
					<div className="lf-links">
						<PublicLegalLinks centered compact showSupport />
					</div>
				</div>
			</div>
		</div>
	);
}
