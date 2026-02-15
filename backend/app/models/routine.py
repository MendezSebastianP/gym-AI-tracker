from sqlalchemy import Column, Integer, String, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Routine(Base):
    __tablename__ = "routines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_favorite = Column(Boolean, default=False)
    
    # JSON structure:
    # [
    #   {
    #     "day_name": "Push",
    #     "exercises": [
    #       {"exercise_id": 1, "sets": 3, "reps": "8-12", "rest": 90, "weight_kg": 0, "locked": false, "notes": "..."}
    #     ]
    #   }
    # ]
    days = Column(JSON, default=[])

    user = relationship("User")
