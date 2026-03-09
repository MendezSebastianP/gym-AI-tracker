from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from app.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    muscle = Column(String, nullable=True) # Primary muscle
    secondary_muscle = Column(String, nullable=True) # Secondary muscle
    muscle_group = Column(String, nullable=True) # Broader group (Chest, Back, etc)
    equipment = Column(String, nullable=True)
    type = Column(String, nullable=True) # Strength, cardio, etc
    is_bodyweight = Column(Boolean, default=False)
    default_weight_kg = Column(Float, nullable=True)
    source = Column(String, default="custom") # wger or custom
    
    # Multilingual names: {"en": "Bench Press", "es": "Press de Banca", "fr": "Développé couché"}
    name_translations = Column(JSON, nullable=True, default={})
    
    # Difficulty scoring for NSS (Normalised Strength Score)
    # For weighted exercises: NSS = est_1rm × difficulty_factor
    # Anchored at Bench Press = 1.0; factor ≈ typical_bench_max / typical_exercise_max
    difficulty_factor = Column(Float, default=1.0, nullable=False, server_default="1.0")
    # For bodyweight exercises: fraction of bodyweight engaged per rep
    # Anchored at Pull-up = 1.0
    bw_ratio = Column(Float, nullable=True)
    
    # User ownership for custom exercises (if null, it's a system exercise)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    user = relationship("User")

