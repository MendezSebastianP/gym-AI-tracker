from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Gym AI Tracker API")

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:5173", # Vite dev server
    "http://127.0.0.1",
    "http://192.168.1.35:8080",  # Local network for phone testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
