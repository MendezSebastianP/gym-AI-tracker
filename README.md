<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/platform-PWA-blueviolet?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/AI-GPT--4o-orange?style=flat-square" alt="AI Powered" />
  <img src="https://img.shields.io/badge/offline-first-blue?style=flat-square" alt="Offline First" />
</p>

<h1 align="center">Gym AI Tracker</h1>

<p align="center">
  <strong>Your AI-powered personal trainer that lives in your pocket.</strong><br/>
  Track workouts, crush PRs, level up — even without internet.
</p>

---

## What is this?

Gym AI Tracker is a **Progressive Web App** that turns your phone into a smart training journal. It works offline, syncs when you're back online, and uses AI to build routines tailored to your goals, equipment, and experience.

No subscription. No ads. Just you and the iron.

---

## Features

### **Train Smart**
- **AI Routine Builder** — Tell the AI your goals, available equipment, and experience level. Get a complete program in seconds, powered by GPT-4o.
- **Exercise Library** — 200+ exercises with muscle group targeting, difficulty ratings, and bodyweight progression chains.
- **Session Logging** — Track sets, reps, weight, RPE, distance, and pace. Built-in rest timer and session stopwatch keep you on track.

### **Track Everything**
- **Weekly & Daily Stats** — Charts for volume, frequency, streaks, and personal records.
- **Body Weight Tracking** — Log your weight over time and see the trend.
- **Cardio Stats** — Distance, pace, and incline tracking for runs, walks, and cycling.
- **Personal Records** — Automatic PR detection for weight and rep milestones.

### **Stay Motivated**
- **Gamification** — Earn XP for every session. Hit PRs for bonus points. Level up and earn currency.
- **Quests** — Weekly rotating challenges that keep training fresh. Complete them for rewards.
- **Streaks** — See your consistency at a glance. Don't break the chain.

### **Works Everywhere**
- **Offline First** — Log your entire workout without a signal. Data syncs automatically when you reconnect.
- **Install as App** — Add to home screen on any device. Looks and feels native.
- **Multi-language** — Interface available in multiple languages.

---

## How It Works

```
1. Create an account
2. Set your training context (goals, equipment, experience)
3. Generate a routine with AI — or build your own
4. Start a session, log your sets, hit PRs
5. Check your stats, level up, repeat
```

---

## Live Demo

<p align="center">
  <a href="https://gym-ai-tracker.duckdns.org">
    <img src="https://img.shields.io/badge/🔗 Live App-gym--ai--tracker.duckdns.org-brightgreen?style=for-the-badge&logoColor=white" alt="Live App" />
  </a>
</p>

Self-hosted on a mini PC running 24/7 on my network — no cloud providers, no monthly bills. The full stack (FastAPI, PostgreSQL, React) runs in Docker containers behind Caddy with automatic HTTPS. Pushes to `main` trigger a GitHub webhook that pulls, rebuilds, migrates, and redeploys automatically in under 60 seconds.

---

## Tooling

| Layer | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Dexie.js (IndexedDB) |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Alembic |
| AI | GPT-4o (routine generation, coach chat, progression reports) |
| Infra | Docker Compose, Caddy, GitHub Webhooks |
| AI Orchestration | Claude Code — config in [`CLAUDE.md`](CLAUDE.md) |

---

<p align="center">
  <sub>Built with FastAPI, React, TypeScript, and too much caffeine.</sub>
</p>
