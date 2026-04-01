from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.auth import SECRET_KEY, ALGORITHM
from app.schemas import TokenData
from app.config import get_csv_env

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def _sync_admin_membership(db: Session, user: User) -> User:
    admin_emails = get_csv_env("ADMIN_EMAILS")
    if not admin_emails:
        return user

    should_be_admin = user.email.strip().lower() in admin_emails
    if user.is_admin != should_be_admin:
        user.is_admin = should_be_admin
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return _sync_admin_membership(db, user)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
