from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class RoutineCompletion(Base):
    __tablename__ = "routine_completions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id"), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
