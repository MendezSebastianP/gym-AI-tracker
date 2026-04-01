from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_env

DATABASE_URL = get_env(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/gym_tracker",
    required_in_production=True,
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
