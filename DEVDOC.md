# Developer Documentation

## Architecture Overview

```
gym-AI-tracker/
├── backend/          # FastAPI Python API
├── frontend/         # React + Vite PWA
├── scheduler/        # Background job runner (Python)
├── deploy/           # Production-only config (Caddy, webhook, hooks)
├── docker-compose.yml            # Base compose (dev + prod shared)
└── deploy/docker-compose.prod.yml # Production overlay (Caddy, webhook)
```

---

## 1. Setting Up the Server (Mini PC — One Time)

### Prerequisites
- Linux (Debian/Ubuntu)
- Docker + Docker Compose installed
- Git installed

### Steps

```bash
# 1. Clone the repo
cd /opt
sudo git clone https://github.com/MendezSebastianP/gym-AI-tracker.git
cd gym-AI-tracker

# 2. Create the .env file (never committed to git)
cp .env.example .env   # or create manually
# Edit .env and set at minimum:
#   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gym_tracker
#   SECRET_KEY=<random-long-string>
#   WEBHOOK_SECRET=<same-secret-as-in-hooks.json>
#   OPENAI_API_KEY=<your-key-if-needed>

# 3. Add your user to the docker group (no more sudo for make commands)
sudo usermod -aG docker $USER
# Then log out and back in, or run: newgrp docker

# 4. Start production
make prod-up

# 5. Run DB migrations (first time only)
make prod-migrate

# 6. Seed exercises (first time only)
make prod-seed
```

### DDNS Auto-Update (Duck DNS)
Add this to the crontab on the mini PC (`crontab -e`):
```bash
# Replace YOUR_TOKEN and YOUR_DOMAIN
*/5 * * * * echo url="https://www.duckdns.org/update?domains=gym-ai-tracker&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns.log -K -
```

### Router Port Forwarding
Forward these ports to the mini PC's local IP (`192.168.1.45`):

| External Port | Internal Port | Service |
|---|---|---|
| 80 | 80 | Caddy (HTTP→HTTPS redirect) |
| 443 | 443 | Caddy (HTTPS, serves the app) |

> **Note:** Port 9000 (webhook) is now proxied through Caddy at `/hooks/*` and does NOT need to be opened on the router.

---

## 2. Dev Workflow on Your Laptop

### First-time setup
```bash
git clone https://github.com/MendezSebastianP/gym-AI-tracker.git
cd gym-AI-tracker

# Create a local .env file (optional — defaults will work for local dev)
# The base docker-compose.yml already has safe defaults for local use

# If you don't have docker permissions:
sudo usermod -aG docker $USER
newgrp docker
```

### Daily dev workflow
```bash
# Start all dev containers (frontend on :5173, API on :8000, nginx on :8080)
make up

# Visit your app at:
# http://localhost:5173  (Vite dev server with HMR)
# http://localhost:8080  (nginx — mirrors production routing more closely)

# Watch all logs
make logs

# Run DB migrations after pulling new code
make shell-backend
# then inside: alembic upgrade head

# Stop everything
make down
```

### Testing from other devices on local WiFi
While running `make up` on the **mini PC**, other devices can reach the app at:
```
http://192.168.1.45:5173
```
No additional config needed — all data saved goes to the mini PC's database.

---

## 3. Makefile Command Reference

### Dev Commands (Laptop & Mini PC local testing)

| Command | Description |
|---|---|
| `make up` | Start all containers in background |
| `make build` | Full rebuild (no cache) |
| `make quick-build` | Rebuild using cache |
| `make restart` | Restart all containers |
| `make down` | Stop and remove containers |
| `make logs` | Follow all logs live |
| `make test` | Run backend tests + frontend type check |
| `make lint` | Run linting |
| `make shell-backend` | Open shell inside the API container |
| `make shell-db` | Open psql shell in the database |
| `make ready` | Wait and confirm API is ready |
| `make clean` | ⚠️ Stop containers AND delete the database volume |

### Production Commands (Run on Mini PC only)

| Command | Description |
|---|---|
| `make prod-up` | Start all production containers |
| `make prod-build` | Rebuild and restart everything |
| `make prod-restart` | Restart without rebuilding |
| `make prod-down` | Stop production containers |
| `make prod-logs` | Follow all production logs live |
| `make prod-logs-api` | Follow API logs only |
| `make prod-logs-caddy` | Follow Caddy logs only |
| `make prod-ps` | Show status of all containers |
| `make prod-migrate` | Run Alembic DB migrations |
| `make prod-seed` | Seed exercise library into the database |

---

## 4. Pushing Changes (Auto-Deploy to Production)

Once the GitHub Webhook is configured, the flow is:

```
You push to main →
  GitHub sends POST to https://gym-ai-tracker.duckdns.org/hooks/redeploy →
  Mini PC receives it →
  git pull →
  docker compose build →
  docker compose up -d →
  alembic upgrade head →
  ✅ Live in ~60 seconds
```

### GitHub Webhook Setup
- **Payload URL:** `https://gym-ai-tracker.duckdns.org/hooks/redeploy`
- **Content type:** `application/json`
- **Secret:** value of `WEBHOOK_SECRET` in your mini PC's `.env`
- **Events:** Just the `push` event

### Manual Deploy (if webhook fails)
```bash
# SSH into the mini PC then:
cd /home/trota/Documents/gym-AI-tracker
git pull origin main
make prod-build
make prod-migrate
```

---

## 5. Environment Files

| File | Location | Committed? | Purpose |
|---|---|---|---|
| `.env` | Project root | ❌ No (gitignored) | Production secrets on the mini PC |
| `.env` (local) | Project root | ❌ No | Dev overrides on your laptop (optional) |

Minimal `.env` for the mini PC:
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gym_tracker
SECRET_KEY=<random-64-char-hex>
WEBHOOK_SECRET=<must-match-GitHub-webhook-secret>
# OPENAI_API_KEY=sk-...   (uncomment if AI features are used)
```

---

## 6. Note on Vite in Production

Currently the production stack runs the **Vite dev server** (`npm run dev -- --host`) exposed via Caddy. This works and is simple, but has these trade-offs:

| | Vite Dev Server (current) | Built Static Files (ideal) |
|---|---|---|
| HMR / hot reload | ✅ Yes | ❌ No |
| Startup speed | Slower | Instant |
| CPU/RAM in prod | Higher | Much lower |
| Security | Slightly weaker | Better |
| Complexity | Simple | Needs build step in CI |

For a personal/small team deployment this is acceptable. If the app grows or performance becomes an issue, the plan is to:
1. `npm run build` inside the frontend container
2. Serve the `dist/` folder via Caddy's `file_server` directive
3. Remove the Node/Vite container entirely from production
