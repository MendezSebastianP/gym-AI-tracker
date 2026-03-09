from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Quest(Base):
    __tablename__ = "quests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    req_type = Column(String(50), nullable=False)    # 'sessions', 'sets', 'weight_pr', 'rep_pr', 'volume'
    req_value = Column(Integer, nullable=False)       # target count/amount
    exp_reward = Column(Integer, nullable=False, default=0)
    currency_reward = Column(Integer, nullable=False, default=0)
    icon = Column(String(50), nullable=True, default="target")  # lucide icon name
    is_repeatable = Column(Boolean, default=False)


class UserQuest(Base):
    __tablename__ = "user_quests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quest_id = Column(Integer, ForeignKey("quests.id"), nullable=False)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    claimed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    quest = relationship("Quest")
