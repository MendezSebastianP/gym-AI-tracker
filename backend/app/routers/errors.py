"""Self-hosted error log endpoint.

POST /api/_errors  — unauthenticated (rate-limited) reporting from the
                     frontend. If a valid bearer is attached, the row is
                     associated with the user.
GET  /api/_errors  — admin-only listing.
DELETE /api/_errors — admin-only retention (?older_than_days=30).
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models.error_log import ErrorLog
from app.models.user import User

router = APIRouter(prefix="/api/_errors", tags=["errors"])


class ErrorReportIn(BaseModel):
    source: str = Field(default="frontend", max_length=20)
    level: Optional[str] = Field(default="error", max_length=20)
    message: str = Field(..., max_length=4000)
    stack: Optional[str] = Field(default=None, max_length=20000)
    url: Optional[str] = Field(default=None, max_length=2000)
    user_agent: Optional[str] = Field(default=None, max_length=500)
    context: Optional[dict] = None


class ErrorReportOut(BaseModel):
    id: int
    created_at: datetime
    user_id: Optional[int]
    source: str
    level: str
    message: str
    stack: Optional[str]
    url: Optional[str]
    user_agent: Optional[str]
    context: Optional[dict]

    class Config:
        from_attributes = True


def _try_current_user(request: Request, db: Session) -> Optional[User]:
    """Best-effort: pull user from Authorization header without 401-ing."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        from jose import jwt
        from app.auth import SECRET_KEY, ALGORITHM
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None


@router.post("", status_code=201)
@limiter.limit("60/hour")
def report_error(
    request: Request,
    body: ErrorReportIn,
    db: Session = Depends(get_db),
):
    user = _try_current_user(request, db)
    row = ErrorLog(
        user_id=user.id if user else None,
        source=body.source or "frontend",
        level=(body.level or "error")[:20],
        message=body.message[:4000],
        stack=body.stack,
        url=body.url,
        user_agent=body.user_agent,
        context=body.context,
    )
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


@router.get("", response_model=List[ErrorReportOut])
def list_errors(
    limit: int = 100,
    offset: int = 0,
    source: Optional[str] = None,
    level: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    q = db.query(ErrorLog).order_by(ErrorLog.created_at.desc())
    if source:
        q = q.filter(ErrorLog.source == source)
    if level:
        q = q.filter(ErrorLog.level == level)
    if user_id is not None:
        q = q.filter(ErrorLog.user_id == user_id)
    return q.offset(max(0, offset)).limit(max(1, min(limit, 500))).all()


@router.delete("")
def purge_errors(
    older_than_days: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, older_than_days))
    deleted = db.query(ErrorLog).filter(ErrorLog.created_at < cutoff).delete()
    db.commit()
    return {"deleted": deleted, "cutoff": cutoff.isoformat()}
