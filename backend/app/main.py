from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter
from app.config import validate_production_environment

validate_production_environment()

app = FastAPI(title="Kairos lift API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# Configure CORS — explicit origins and methods only (SEC-07)
origins = [
    "http://localhost",
    "http://localhost:5173",        # Vite dev server
    "http://127.0.0.1",
    "http://192.168.1.45:5173",    # Local network access via mini PC
    "http://192.168.1.45:8080",    # Local network access via nginx
    "https://gym-ai-tracker.duckdns.org",  # Production domain
    "https://kairos.sebmendez.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

from app.routers import auth, exercises, routines, sessions, sets, stats, sync, gamification, user_preferences, ai, admin, weight, progression

app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(sessions.router)
app.include_router(sets.router)
app.include_router(stats.router)
app.include_router(sync.router)
app.include_router(gamification.router)
app.include_router(user_preferences.router)
app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(weight.router)
app.include_router(progression.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Kairos lift API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
