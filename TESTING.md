# Testing Guide

## 1. Viewing Logs

Similar to Django's `runserver`, you can view real-time logs:

```bash
# All services (like Django runserver)
make logs

# Individual services
docker compose logs -f api        # Backend API (FastAPI)
docker compose logs -f frontend   # Frontend (Vite dev server)
docker compose logs -f nginx      # Reverse proxy access logs

# Last 50 lines without following
docker compose logs api --tail=50
```

## 2. Testing on Your Phone (Same WiFi Network)

### Step 1: Find your computer's local IP

```bash
hostname -I | awk '{print $1}'
# Example output: 192.168.1.100
```

### Step 2: Update CORS settings

The backend needs to allow requests from your phone's browser. Your local IP will be shown below.

Edit `backend/app/main.py` and add your IP to the `origins` list:

```python
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1",
    "http://192.168.1.100:8080",  # Add your IP here
]
```

### Step 3: Restart the API

```bash
docker compose restart api
```

### Step 4: Access from your phone

Open your phone's browser and navigate to:
```
http://192.168.1.100:8080
```
(Replace with your actual IP address)

### Troubleshooting

- Make sure your phone and computer are on the **same WiFi network**
- If it doesn't work, check your firewall: `sudo ufw allow 8080` (Linux) or disable firewall temporarily
- Check that containers are running: `docker compose ps`

## 3. Common Commands

```bash
# Start/stop
make up          # Start all containers
make down        # Stop containers
make restart     # Restart all containers

# Development
make logs        # View all logs
make shell-backend   # Access backend shell
make shell-db        # Access PostgreSQL

# Rebuild after code changes
make quick-build     # Build with cache (fast)
make build          # Full rebuild (slow, clean)

# Database
docker compose exec api python -m app.seed_data  # Re-seed exercises
```

## 4. Checking if Services are Running

```bash
docker compose ps

# Should show:
# api-1       Running
# frontend-1  Running
# nginx-1     Running
# postgres-1  Running
# scheduler-1 Running
```

## 5. Accessing the Database

```bash
make shell-db

# Then run SQL:
\dt              # List tables
SELECT * FROM users;
SELECT * FROM exercises LIMIT 5;
\q               # Quit
```
