from sqlalchemy import Column, Integer, String, Boolean, JSON, Float
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=False, server_default="false")  # blocks login
    settings = Column(JSON, default={})  # rpe_enabled, language, theme, etc.
    
    # Profile details
    weight = Column(Integer, nullable=True) # kg
    height = Column(Integer, nullable=True) # cm
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # "male", "female", or null
    priorities = Column(JSON, default={}) # e.g. ["strength", "hypertrophy"]

    # Gamification
    level = Column(Integer, default=1, server_default="1")
    experience = Column(Integer, default=0, server_default="0")
    currency = Column(Integer, default=0, server_default="0")

