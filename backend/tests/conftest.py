"""
Shared pytest fixtures for Gym AI Tracker backend tests.

Uses a unique file-based SQLite database for each test so tests are
fully isolated and need no running Postgres instance.
"""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- Import ALL models so SQLAlchemy registers them before create_all ---
from app.database import Base, get_db
import app.models  # noqa: F401  – registers User, Exercise, Routine, Session, Set, SyncEvent

from app.main import app


def _make_engine():
    """Create a fresh SQLite engine backed by a unique temp file inside /app."""
    db_file = f"/app/test_{uuid.uuid4().hex}.db"
    url = f"sqlite:///{db_file}"
    eng = create_engine(url, connect_args={"check_same_thread": False})
    return eng, db_file


@pytest.fixture(scope="function")
def db_engine():
    """Engine + schema for a single test; cleaned up afterwards."""
    eng, db_file = _make_engine()
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()
    try:
        os.remove(db_file)
    except OSError:
        pass


@pytest.fixture(scope="function")
def client(db_engine):
    """FastAPI TestClient that uses the per-test SQLite database."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper: register + login a user and return auth headers ─────────────────
def register_and_login(client: TestClient, email: str = "test@example.com", password: str = "password123"):
    """Register a user and return {'Authorization': 'Bearer <token>'} headers."""
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, f"Register failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
