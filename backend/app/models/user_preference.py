from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    primary_goal = Column(String, nullable=True)
    split_preference = Column(String, nullable=True)
    strength_logic = Column(String, nullable=True)
    cardio_preference = Column(String, nullable=True)
    experience_level = Column(String, nullable=True)
    available_equipment = Column(JSON, default=[])
    training_days = Column(Integer, nullable=True)
    session_duration = Column(String, nullable=True)
    sleep_quality = Column(String, nullable=True)
    active_job = Column(String, nullable=True)
    progression_pace = Column(String, nullable=True)
    has_injuries = Column(String, nullable=True)
    injured_areas = Column(JSON, default=[])
    other_information = Column(String, nullable=True)
    context_level = Column(Integer, nullable=True)  # 1=Quick, 2=Standard, 3=Full

    user = relationship("User", backref="preferences")
