from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.quest import Quest, UserQuest
from app.models.user import User
from app.gamification import assign_quests

engine = create_engine('postgresql://postgres:postgres@localhost:5432/gym_tracker')
Session = sessionmaker(bind=engine)
db = Session()

user = db.query(User).filter(User.username == 'testuser').first()
if not user:
    print("No testuser!")
else:
    print(f"Assigning quests to user {user.id}")
    try:
        assign_quests(db, user.id)
        uqs = db.query(UserQuest).filter(UserQuest.user_id == user.id).all()
        print(f"Quests assigned: {len(uqs)}")
    except Exception as e:
        print(f"Error: {e}")

