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

import tempfile


def _make_engine():
    """Create a fresh SQLite engine backed by a unique temp file."""
    db_file = os.path.join(tempfile.gettempdir(), f"test_{uuid.uuid4().hex}.db")
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

    # Disable rate limiting during tests
    from app.limiter import limiter
    limiter.enabled = False

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    limiter.enabled = True


# ── Helper: register + login a user and return auth headers ─────────────────
def register_and_login(client: TestClient, email: str = "test@example.com", password: str = "password123", initial_coins: int = 0):
    """Register a user and return {'Authorization': 'Bearer <token>'} headers."""
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, f"Register failed: {r.text}"
    token = r.json()["access_token"]
    if initial_coins > 0:
        from app.database import get_db
        from app.models.user import User
        from app.main import app
        db = next(app.dependency_overrides[get_db]())
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.currency = initial_coins
            db.commit()
        db.close()
    return {"Authorization": f"Bearer {token}"}
