from sqlalchemy import Column, Integer, String, Boolean, JSON
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default={})  # rpe_enabled, language, theme, etc.
    
    # Profile details
    weight = Column(Integer, nullable=True) # kg
    height = Column(Integer, nullable=True) # cm
    age = Column(Integer, nullable=True)
    priorities = Column(JSON, default={}) # e.g. ["strength", "hypertrophy"]
