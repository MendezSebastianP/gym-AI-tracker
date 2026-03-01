---
description: How to deploy to production on the mini PC with auto-deploy from GitHub
---

# Production Deployment Guide

## Prerequisites
- Mini PC running Linux (Ubuntu/Debian recommended)
- Docker & Docker Compose installed on the mini PC
- A DDNS domain pointing to your mini PC's public IP (e.g. DuckDNS, No-IP)
- Port 80, 443, 9000 forwarded on your router to the mini PC

## One-Time Setup on the Mini PC

### 1. Clone the repo
```bash
cd /opt
sudo git clone https://github.com/YOUR_USER/gym-AI-tracker.git
cd gym-AI-tracker
```

### 2. Configure environment
```bash
# Create .env file with production secrets
cp .env.example .env  # or create manually
# Edit .env to set:
#   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gym_tracker
#   SECRET_KEY=<random-long-string>
#   OPENAI_API_KEY=<your-key-if-needed>
```

### 3. Configure your DDNS domain
Edit `deploy/Caddyfile` and replace `YOUR_DOMAIN.duckdns.org` with your actual DDNS domain.

### 4. Configure the webhook secret
Generate a random secret:
```bash
openssl rand -hex 32
```
Then:
- Edit `deploy/hooks.json` and replace `CHANGE_ME_TO_A_RANDOM_SECRET` with this value
- Save this secret — you'll need it for the GitHub webhook setup

### 5. Install git for the webhook container
The webhook container needs git. We mount the host's git repo, so git must be available on the host.

### 6. Start production
```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d
```

Wait for all services to be healthy:
```bash
# Check logs
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs -f
```

### 7. Configure GitHub Webhook
1. Go to your GitHub repo → **Settings** → **Webhooks** → **Add webhook**
2. Set:
   - **Payload URL:** `http://YOUR_DOMAIN.duckdns.org:9000/hooks/redeploy`
   - **Content type:** `application/json`
   - **Secret:** The secret you generated in step 4
   - **Events:** Just the `push` event
3. Click **Add webhook**
4. GitHub will send a test ping — check the webhook service logs to verify

## How It Works

```
You push to main → GitHub sends webhook → Mini PC receives it →
  → git pull → docker compose build → docker compose up -d →
  → alembic upgrade head → ✅ Live in ~60 seconds
```

## Router Port Forwarding

Forward these ports to your mini PC's local IP:

| External Port | Internal Port | Service                       |
| ------------- | ------------- | ----------------------------- |
| 80            | 80            | Caddy (HTTP → HTTPS redirect) |
| 443           | 443           | Caddy (HTTPS, serves the app) |
| 9000          | 9000          | Webhook listener              |

## DDNS Provider Setup

### DuckDNS (free, recommended)
1. Go to https://www.duckdns.org
2. Sign in with GitHub/Google
3. Create a subdomain (e.g. `mygym.duckdns.org`)
4. On the mini PC, set up auto-update:
```bash
# Add to crontab (crontab -e):
*/5 * * * * echo url="https://www.duckdns.org/update?domains=mygym&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns.log -K -
```

### Alternative: No-IP, Dynu, or Cloudflare DDNS
Any provider works — just make sure the DNS record auto-updates when your IP changes.

## SSL/HTTPS

Caddy handles this **automatically**. When you first start with a valid domain:
1. Caddy requests a certificate from Let's Encrypt
2. It auto-renews before expiry
3. HTTP is automatically redirected to HTTPS

**Note:** For this to work, ports 80 and 443 must be reachable from the internet.

## Troubleshooting

### Webhook not triggering
- Check: `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml logs webhook`
- Verify the secret matches between `hooks.json` and GitHub
- Test manually: `curl -X POST http://localhost:9000/hooks/redeploy`

### SSL certificate errors
- Make sure ports 80/443 are forwarded
- Make sure your DDNS domain resolves to your public IP
- Check Caddy logs: `docker compose logs caddy`

### Mini PC IP changed
- Your DDNS provider should auto-update (cron job)
- If not, update manually in DDNS dashboard

## Manual Deploy (if webhook fails)
```bash
cd /opt/gym-AI-tracker
git pull origin main
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```
