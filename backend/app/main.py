from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter

app = FastAPI(title="Gym AI Tracker API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS — explicit origins and methods only (SEC-07)
origins = [
    "http://localhost",
    "http://localhost:5173",        # Vite dev server
    "http://127.0.0.1",
    "http://192.168.1.45:5173",    # Local network access via mini PC
    "http://192.168.1.45:8080",    # Local network access via nginx
    "https://gym-ai-tracker.duckdns.org",  # Production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

from app.routers import auth, exercises, routines, sessions, sets, stats, sync

app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(sessions.router)
app.include_router(sets.router)
app.include_router(stats.router)
app.include_router(sync.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Gym AI Tracker API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
