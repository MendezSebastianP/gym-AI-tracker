from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas import UserCreate, UserLogin, Token, UserResponse, UserUpdate
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS,
    generate_refresh_token, hash_refresh_token,
)
from app.dependencies import get_current_user
from app.limiter import limiter

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"]
)

# Dummy hash used in login to keep response time constant regardless of whether
# the email exists — prevents timing-based email enumeration (SEC-05)
_DUMMY_HASH = "$2b$12$fuDzP9mAD1GLGh5ZLU0g0uMH3/UtUNT95LJgs8k02GhpapoYN1Lge"


def _issue_tokens(db_user: User, db: Session) -> dict:
    """Create access + refresh tokens and persist the refresh hash."""
    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = generate_refresh_token()
    db_user.refresh_token_hash = hash_refresh_token(refresh_token)
    db_user.refresh_token_expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/register", response_model=Token)
@limiter.limit("3/day")  # SEC-03: max 3 registrations per IP per day
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return _issue_tokens(new_user, db)

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # SEC-03: prevent brute force
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    # Always run bcrypt — even for unknown emails — so response time is identical
    # regardless of whether the account exists (prevents timing-based enumeration)
    hash_to_check = db_user.password_hash if db_user else _DUMMY_HASH
    password_ok = verify_password(user.password, hash_to_check)
    if not db_user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Block demo account from real login
    if db_user.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not available for login",
        )

    return _issue_tokens(db_user, db)


class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")
def refresh(request: Request, body: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token (refresh token stays the same)."""
    token_hash = hash_refresh_token(body.refresh_token)
    db_user = db.query(User).filter(User.refresh_token_hash == token_hash).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if db_user.refresh_token_expires_at is None or db_user.refresh_token_expires_at < datetime.now(timezone.utc):
        # Expired — clear it
        db_user.refresh_token_hash = None
        db_user.refresh_token_expires_at = None
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    access_token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "refresh_token": body.refresh_token,  # same refresh token
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Revoke the refresh token on logout."""
    current_user.refresh_token_hash = None
    current_user.refresh_token_expires_at = None
    db.commit()
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
def update_user_me(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_update.weight is not None:
        current_user.weight = user_update.weight
    if user_update.height is not None:
        current_user.height = user_update.height
    if user_update.age is not None:
        current_user.age = user_update.age
    if user_update.gender is not None:
        current_user.gender = user_update.gender
    if user_update.priorities is not None:
        current_user.priorities = user_update.priorities
    if user_update.settings is not None:
        current_user.settings = user_update.settings

    db.commit()
    db.refresh(current_user)
    return current_user
