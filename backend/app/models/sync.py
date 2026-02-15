from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class SyncEvent(Base):
    __tablename__ = "sync_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_type = Column(String, nullable=False) # create_session, update_set, etc.
    payload = Column(JSON, nullable=False) # data needed to replay event
    client_timestamp = Column(DateTime(timezone=True), nullable=False) # when it happened on device
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
