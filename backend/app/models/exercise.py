from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from app.database import Base

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    muscle = Column(String, nullable=True) # Primary muscle
    muscle_group = Column(String, nullable=True) # Broader group (Chest, Back, etc)
    equipment = Column(String, nullable=True)
    type = Column(String, nullable=True) # Strength, cardio, etc
    is_bodyweight = Column(Boolean, default=False)
    default_weight_kg = Column(Float, nullable=True)
    source = Column(String, default="custom") # wger or custom
    
    # Multilingual names: {"en": "Bench Press", "es": "Press de Banca", "fr": "Développé couché"}
    name_translations = Column(JSON, nullable=True, default={})
    
    # User ownership for custom exercises (if null, it's a system exercise)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    user = relationship("User")
