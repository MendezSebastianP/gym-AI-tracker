from sqlalchemy import Column, Integer, String, Boolean, JSON, Float, DateTime
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

    # Refresh token
    refresh_token_hash = Column(String, nullable=True)
    refresh_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Gamification
    level = Column(Integer, default=1, server_default="1")
    experience = Column(Integer, default=0, server_default="0")
    currency = Column(Integer, default=100, server_default="100")
    streak_reward_week = Column(String, nullable=True)  # ISO week e.g. "2026-W13"
    joker_tokens = Column(Integer, default=0, server_default="0")
    onboarding_progress = Column(JSON, default={}, server_default="{}")

    @property
    def is_admin(self) -> bool:
        return self.email == "admon0208"
