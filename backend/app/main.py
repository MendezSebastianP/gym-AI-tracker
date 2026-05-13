import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

from app.routers import auth, exercises, routines, sessions, sets, stats, sync, gamification, user_preferences, ai, admin, weight, progression, errors as errors_router

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
app.include_router(errors_router.router)


@app.middleware("http")
async def log_unhandled_exceptions(request: Request, call_next):
    """Catch-all middleware: any unhandled exception lands in error_logs.

    Always returns the standard 500 to the client so existing behaviour
    is preserved. Logging is best-effort — if the DB write fails (e.g. DB
    is the thing that's broken), we swallow that secondary error.
    """
    try:
        return await call_next(request)
    except Exception as exc:
        try:
            from app.database import SessionLocal
            from app.models.error_log import ErrorLog
            db = SessionLocal()
            try:
                row = ErrorLog(
                    source="backend",
                    level="error",
                    message=f"{type(exc).__name__}: {exc}"[:4000],
                    stack=traceback.format_exc(),
                    url=str(request.url),
                    user_agent=request.headers.get("user-agent"),
                    context={"method": request.method, "path": request.url.path},
                )
                db.add(row)
                db.commit()
            finally:
                db.close()
        except Exception:
            pass
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

@app.get("/")
def read_root():
    return {"message": "Welcome to Kairos lift API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
