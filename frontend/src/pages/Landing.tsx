import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dumbbell, Brain, Wifi, WifiOff, Trophy, TrendingUp,
  Zap, BarChart3, Target, Shield, ChevronRight, Sparkles,
  Timer, Award, ArrowDown
} from 'lucide-react';
import './Landing.css';

/* ── Scroll‑reveal hook ─────────────────────────────────────────── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ── Animated counter ───────────────────────────────────────────── */

function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useReveal(0.3);

  useEffect(() => {
    if (!visible) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCount(Math.round(eased * end));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, end]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Main component ─────────────────────────────────────────────── */

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal refs for feature cards
  const f1 = useReveal(); const f2 = useReveal(); const f3 = useReveal();
  const f4 = useReveal(); const f5 = useReveal(); const f6 = useReveal();

  // Reveal refs for steps
  const s1 = useReveal(); const s2 = useReveal();
  const s3 = useReveal(); const s4 = useReveal();

  return (
    <div className="landing">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-logo">
          Gym <span>AI</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-nav-link">Log in</Link>
          <Link to="/register" className="landing-nav-cta">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-orb" />
          <div className="landing-hero-orb" />
          <div className="landing-hero-orb" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            AI-Powered Fitness Tracker
          </div>

          <h1>
            Train smarter.<br />
            <span className="highlight">Level up.</span>
          </h1>

          <p className="landing-hero-sub">
            Your personal AI coach that builds routines, tracks every rep,
            and keeps you motivated — even offline.
          </p>

          <div className="landing-hero-ctas">
            <Link to="/register" className="landing-btn-big primary">
              Start Training <ChevronRight size={18} />
            </Link>
            <a href="#features" className="landing-btn-big secondary">
              See Features
            </a>
          </div>
        </div>

        <div className="landing-scroll-hint">
          <ArrowDown size={14} />
          <div className="landing-scroll-line" />
        </div>
      </section>

      {/* ── Phone mockup ──────────────────────────────────────── */}
      <section className="landing-phone-section">
        <div className="landing-phone-wrapper">
          {/* Floating badges */}
          <div className="landing-float">
            <Zap size={14} className="landing-float-icon" /> +150 XP
          </div>
          <div className="landing-float">
            <Trophy size={14} className="landing-float-icon" /> New PR!
          </div>
          <div className="landing-float">
            <WifiOff size={14} className="landing-float-icon" style={{ color: 'var(--text-secondary)' }} />
            Works offline
          </div>

          {/* Phone */}
          <div className="landing-phone">
            <div className="landing-phone-notch" />
            <div className="landing-phone-screen">
              <div className="landing-phone-header">
                <span className="landing-phone-header-title">Active Session</span>
                <span className="landing-phone-header-badge">12:34</span>
              </div>
              <div className="landing-phone-body">
                <div className="landing-phone-card">
                  <div className="landing-phone-card-name">Bench Press</div>
                  <div className="landing-phone-card-meta">Chest &bull; Barbell</div>
                  <div className="landing-phone-card-sets">
                    <span className="landing-phone-set done">80kg &times; 10</span>
                    <span className="landing-phone-set done">80kg &times; 8</span>
                    <span className="landing-phone-set">80kg &times; ?</span>
                  </div>
                </div>
                <div className="landing-phone-card">
                  <div className="landing-phone-card-name">Incline Dumbbell Press</div>
                  <div className="landing-phone-card-meta">Upper Chest &bull; Dumbbell</div>
                  <div className="landing-phone-card-sets">
                    <span className="landing-phone-set">30kg &times; 12</span>
                    <span className="landing-phone-set">30kg &times; 12</span>
                    <span className="landing-phone-set">30kg &times; 12</span>
                  </div>
                </div>
                <div className="landing-phone-card">
                  <div className="landing-phone-card-name">Cable Fly</div>
                  <div className="landing-phone-card-meta">Chest &bull; Cable</div>
                  <div className="landing-phone-card-sets">
                    <span className="landing-phone-set">15kg &times; 15</span>
                    <span className="landing-phone-set">15kg &times; 15</span>
                  </div>
                </div>

                <div className="landing-phone-xp">
                  <span className="landing-phone-xp-label">Level 12 — 720 XP</span>
                  <div className="landing-phone-xp-bar">
                    <div className="landing-phone-xp-fill" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-section-label">
          <Sparkles size={14} /> Features
        </div>
        <h2>Everything you need<br />to crush your goals</h2>
        <p className="landing-section-desc">
          From AI-generated programs to offline tracking and gamification — built for lifters who take training seriously.
        </p>

        <div className="landing-features-grid">
          <div ref={f1.ref} className={`landing-feature-card ${f1.visible ? 'visible' : ''}`}>
            <div className="landing-feature-icon green"><Brain size={22} /></div>
            <h3>AI Routine Builder</h3>
            <p>Tell the AI your goals, equipment, and experience. Get a complete training program in seconds — powered by GPT-4o.</p>
          </div>

          <div ref={f2.ref} className={`landing-feature-card ${f2.visible ? 'visible' : ''}`} style={{ animationDelay: '0.1s' }}>
            <div className="landing-feature-icon cyan"><Wifi size={22} /></div>
            <h3>Offline First</h3>
            <p>Log your entire workout with zero signal. Everything syncs automatically when you're back online. No data lost, ever.</p>
          </div>

          <div ref={f3.ref} className={`landing-feature-card ${f3.visible ? 'visible' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="landing-feature-icon gold"><Trophy size={22} /></div>
            <h3>Gamification</h3>
            <p>Earn XP for every session. Get bonus points for PRs. Level up, complete weekly quests, and stay motivated.</p>
          </div>

          <div ref={f4.ref} className={`landing-feature-card ${f4.visible ? 'visible' : ''}`} style={{ animationDelay: '0.1s' }}>
            <div className="landing-feature-icon green"><BarChart3 size={22} /></div>
            <h3>Detailed Stats</h3>
            <p>Weekly volume, muscle group breakdown, strength trends, consistency streaks — see your progress in every dimension.</p>
          </div>

          <div ref={f5.ref} className={`landing-feature-card ${f5.visible ? 'visible' : ''}`} style={{ animationDelay: '0.2s' }}>
            <div className="landing-feature-icon cyan"><Timer size={22} /></div>
            <h3>Session Tools</h3>
            <p>Built-in rest timer, session stopwatch, RPE tracking, and auto-filled sets from your last workout. Just lift.</p>
          </div>

          <div ref={f6.ref} className={`landing-feature-card ${f6.visible ? 'visible' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="landing-feature-icon gold"><Shield size={22} /></div>
            <h3>Self-Hosted</h3>
            <p>Your data stays on your own server. No cloud, no subscriptions, no third parties. Full control.</p>
          </div>
        </div>
      </section>

      {/* ── Stats banner ──────────────────────────────────────── */}
      <div className="landing-stats-banner">
        <div className="landing-stats-inner">
          <div>
            <div className="landing-stat-number"><Counter end={200} suffix="+" /></div>
            <div className="landing-stat-label">Exercises</div>
          </div>
          <div>
            <div className="landing-stat-number"><Counter end={100} suffix="%" /></div>
            <div className="landing-stat-label">Offline capable</div>
          </div>
          <div>
            <div className="landing-stat-number"><Counter end={3} /></div>
            <div className="landing-stat-label">Themes</div>
          </div>
          <div>
            <div className="landing-stat-number"><Counter end={0} suffix="" /></div>
            <div className="landing-stat-label">Subscriptions</div>
          </div>
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="landing-section">
        <div className="landing-section-label">
          <Target size={14} /> How it works
        </div>
        <h2>Up and running<br />in minutes</h2>
        <p className="landing-section-desc">
          No complicated setup. No learning curve. Just sign up and start lifting.
        </p>

        <div className="landing-steps">
          <div ref={s1.ref} className={`landing-step ${s1.visible ? 'visible' : ''}`}>
            <div className="landing-step-dot"><div className="landing-step-dot-inner" /></div>
            <h3>Create your profile</h3>
            <p>Sign up and tell us about your goals, available equipment, injuries, and experience level.</p>
          </div>
          <div ref={s2.ref} className={`landing-step ${s2.visible ? 'visible' : ''}`} style={{ animationDelay: '0.15s' }}>
            <div className="landing-step-dot"><div className="landing-step-dot-inner" /></div>
            <h3>Generate a routine</h3>
            <p>Let the AI build a personalized program — or create your own from our 200+ exercise library.</p>
          </div>
          <div ref={s3.ref} className={`landing-step ${s3.visible ? 'visible' : ''}`} style={{ animationDelay: '0.3s' }}>
            <div className="landing-step-dot"><div className="landing-step-dot-inner" /></div>
            <h3>Train and log</h3>
            <p>Start a session, log sets with weight and reps, track RPE, use the rest timer. All offline-ready.</p>
          </div>
          <div ref={s4.ref} className={`landing-step ${s4.visible ? 'visible' : ''}`} style={{ animationDelay: '0.45s' }}>
            <div className="landing-step-dot"><div className="landing-step-dot-inner" /></div>
            <h3>Level up</h3>
            <p>Earn XP, hit PRs, complete quests, and watch your stats climb. Your training journal, gamified.</p>
          </div>
        </div>
      </section>

      {/* ── Quote / Highlight ─────────────────────────────────── */}
      <section className="landing-highlight">
        <div className="landing-highlight-inner">
          <Award size={40} style={{ color: 'var(--primary)', marginBottom: 24 }} />
          <p className="landing-highlight-quote">
            "The best workout tracker is the one you <span>actually use</span>."
          </p>
          <p className="landing-highlight-sub">
            Built by lifters, for lifters. No bloat, no ads, no paywalls.
            Just a clean tool that works — in the gym, on the plane, in your garage.
          </p>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="landing-cta-bg">
          <div className="landing-hero-orb" />
          <div className="landing-hero-orb" />
        </div>
        <div className="landing-cta-content">
          <h2>Ready to train?</h2>
          <p>Create your free account and start your first session today.</p>
          <Link to="/register" className="landing-btn-big primary">
            <Dumbbell size={18} /> Get Started — It's Free
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Gym AI Tracker &mdash; Self-hosted fitness tracking with AI.
      </footer>
    </div>
  );
}
