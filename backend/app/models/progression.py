from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ProgressionReport(Base):
    __tablename__ = "progression_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    day_index = Column(Integer, nullable=True)
    report_data = Column(JSON, nullable=False)
    ai_usage_log_id = Column(Integer, ForeignKey("ai_usage_logs.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    routine = relationship("Routine")
    ai_usage_log = relationship("AIUsageLog")


class ProgressionFeedback(Base):
    __tablename__ = "progression_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    report_id = Column(Integer, ForeignKey("progression_reports.id"), nullable=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    suggestion_type = Column(String, nullable=False)  # weight_increase, rep_increase, deload, exercise_swap, bw_progression, cardio_increase
    suggested_value = Column(JSON, nullable=False)  # {weight, reps, sets, new_exercise_id}
    action = Column(String, nullable=False, default="ignored")  # accepted, rejected, modified, ignored
    applied_value = Column(JSON, nullable=True)  # what they actually used
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    report = relationship("ProgressionReport")
    exercise = relationship("Exercise")


class ExerciseProgression(Base):
    __tablename__ = "exercise_progressions"

    id = Column(Integer, primary_key=True, index=True)
    chain_name = Column(String, nullable=False, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    position = Column(Integer, nullable=False)
    target_reps_to_advance = Column(Integer, nullable=False, default=10)
    target_sets_to_advance = Column(Integer, nullable=False, default=3)
    sessions_to_advance = Column(Integer, nullable=False, default=3)
    suggested_starting_sets = Column(Integer, nullable=False, default=3)
    suggested_starting_reps = Column(String, nullable=False, default="4-6")

    exercise = relationship("Exercise")
