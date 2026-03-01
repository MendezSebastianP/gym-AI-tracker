from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=True)
    day_index = Column(Integer, nullable=True) # Which day of the routine (0-based)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    locked_exercises = Column(JSON, default=[])

    user = relationship("User")
    routine = relationship("Routine")
    sets = relationship("Set", back_populates="session", cascade="all, delete-orphan")

class Set(Base):
    __tablename__ = "sets"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    set_number = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=True)
    reps = Column(Integer, nullable=True)
    duration_sec = Column(Integer, nullable=True)
    rpe = Column(Float, nullable=True) # 1-10
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("Session", back_populates="sets")
    exercise = relationship("Exercise")
