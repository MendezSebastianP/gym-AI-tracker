import os
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from app.database import SessionLocal, engine
from app.models.user import User
from app.auth import get_password_hash

def seed_admin():
    db = SessionLocal()
    try:
        email = "admon0208"
        password = "COLegio123$"
        
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Admin user '{email}' already exists. Updating password...")
            user.password_hash = get_password_hash(password)
        else:
            print(f"Creating admin user '{email}'...")
            user = User(
                email=email,
                password_hash=get_password_hash(password),
                is_active=True
            )
            db.add(user)
            
        db.commit()
        print("Admin user seeded successfully.")
    except Exception as e:
        print(f"Error seeding admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
