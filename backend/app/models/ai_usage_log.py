from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Cost Tracking
    model = Column(String, nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)
    
    # Payload Storage
    suggested_routine = Column(JSON, nullable=True)
    
    # Conversion Tracking
    status = Column(String, nullable=False, default="generated") # generated, saved, error
    saved_routine_id = Column(Integer, ForeignKey("routines.id"), nullable=True)
    retention_percentage = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    saved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    saved_routine = relationship("Routine")
