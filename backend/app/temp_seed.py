import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import engine, Base
from app.seed_data import seed_exercises

def reset_database():
    print("Seeding...")
    seed_exercises()
    print("Done.")

if __name__ == "__main__":
    reset_database()
