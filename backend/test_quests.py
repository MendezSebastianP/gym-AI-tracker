import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append("/app")
from app.database import get_db
from app.models.quest import Quest, UserQuest
from app.models.user import User
from app.gamification import assign_quests

db_gen = get_db()
db = next(db_gen)

users = db.query(User).all()
if not users:
    print("No users!")
else:
    for user in users:
        print(f"Assigning quests to user {user.id} ({user.username})")
        try:
            assign_quests(db, user.id)
            uqs = db.query(UserQuest).filter(UserQuest.user_id == user.id).all()
            print(f"Quests assigned: {len(uqs)}")
        except Exception as e:
            print(f"Error: {e}")
