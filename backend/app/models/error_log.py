from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from app.database import Base


class ErrorLog(Base):
    """Self-hosted error log row.

    Frontend pushes uncaught render errors / window.onerror / unhandled
    rejections to POST /api/_errors; the backend middleware writes a row
    here for any unhandled exception. Admin-only GET surfaces them in
    /admin/errors.
    """
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    source = Column(String, nullable=False)  # 'frontend' | 'backend'
    level = Column(String, nullable=False, default="error")  # 'error' | 'warn' | 'info'
    message = Column(Text, nullable=False)
    stack = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    context = Column(JSON, nullable=True)
