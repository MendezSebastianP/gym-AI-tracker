"""
Database Export / Import utility for Gym AI Tracker.

Usage:
  # Export all user data to a JSON file:
  docker compose exec api python -m app.db_export_import export /app/backup.json

  # Import user data from a JSON file (skips existing records by PK):
  docker compose exec api python -m app.db_export_import import /app/backup.json

This exports ONLY user-generated data (users, routines, sessions, sets).
System exercises are NOT exported — they are re-created by seed_data.py.
"""
import sys
import json
from datetime import datetime
from app.database import SessionLocal
from app.models.user import User
from app.models.routine import Routine
from app.models.session import Session, Set


def export_data(filepath: str):
    db = SessionLocal()
    try:
        users = db.query(User).all()
        routines = db.query(Routine).all()
        sessions = db.query(Session).all()
        sets = db.query(Set).all()

        data = {
            "exported_at": datetime.utcnow().isoformat(),
            "users": [],
            "routines": [],
            "sessions": [],
            "sets": [],
        }

        for u in users:
            data["users"].append({
                "id": u.id,
                "email": u.email,
                "hashed_password": u.hashed_password,
                "is_active": u.is_active,
                "weight": u.weight,
                "height": u.height,
                "age": u.age,
                "priorities": u.priorities,
                "settings": u.settings,
            })

        for r in routines:
            data["routines"].append({
                "id": r.id,
                "user_id": r.user_id,
                "name": r.name,
                "description": r.description,
                "is_favorite": r.is_favorite,
                "days": r.days,
            })

        for s in sessions:
            data["sessions"].append({
                "id": s.id,
                "user_id": s.user_id,
                "routine_id": s.routine_id,
                "day_index": s.day_index,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "notes": s.notes,
                "locked_exercises": s.locked_exercises,
            })

        for st in sets:
            data["sets"].append({
                "id": st.id,
                "session_id": st.session_id,
                "exercise_id": st.exercise_id,
                "set_number": st.set_number,
                "weight_kg": st.weight_kg,
                "reps": st.reps,
                "duration_sec": st.duration_sec,
                "rpe": st.rpe,
                "completed_at": st.completed_at.isoformat() if st.completed_at else None,
            })

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ Exported {len(data['users'])} users, {len(data['routines'])} routines, "
              f"{len(data['sessions'])} sessions, {len(data['sets'])} sets to {filepath}")
    finally:
        db.close()


def import_data(filepath: str):
    db = SessionLocal()
    try:
        with open(filepath, "r") as f:
            data = json.load(f)

        added = {"users": 0, "routines": 0, "sessions": 0, "sets": 0}

        # Import users (skip existing by email)
        existing_emails = {u.email for u in db.query(User).all()}
        for u_data in data.get("users", []):
            if u_data["email"] not in existing_emails:
                user = User(
                    email=u_data["email"],
                    hashed_password=u_data["hashed_password"],
                    is_active=u_data.get("is_active", True),
                    weight=u_data.get("weight"),
                    height=u_data.get("height"),
                    age=u_data.get("age"),
                    priorities=u_data.get("priorities"),
                    settings=u_data.get("settings"),
                )
                db.add(user)
                db.flush()
                added["users"] += 1

        db.commit()

        # Build user ID mapping (old ID -> new ID) by email
        user_map = {}
        all_users = {u.email: u.id for u in db.query(User).all()}
        for u_data in data.get("users", []):
            user_map[u_data["id"]] = all_users.get(u_data["email"], u_data["id"])

        # Import routines (skip existing by ID)
        existing_routine_ids = {r.id for r in db.query(Routine).all()}
        routine_map = {}
        for r_data in data.get("routines", []):
            if r_data["id"] not in existing_routine_ids:
                routine = Routine(
                    user_id=user_map.get(r_data["user_id"], r_data["user_id"]),
                    name=r_data["name"],
                    description=r_data.get("description"),
                    is_favorite=r_data.get("is_favorite", False),
                    days=r_data.get("days", []),
                )
                db.add(routine)
                db.flush()
                routine_map[r_data["id"]] = routine.id
                added["routines"] += 1
            else:
                routine_map[r_data["id"]] = r_data["id"]

        db.commit()

        # Import sessions (skip existing by ID)
        existing_session_ids = {s.id for s in db.query(Session).all()}
        session_map = {}
        for s_data in data.get("sessions", []):
            if s_data["id"] not in existing_session_ids:
                session = Session(
                    user_id=user_map.get(s_data["user_id"], s_data["user_id"]),
                    routine_id=routine_map.get(s_data.get("routine_id"), s_data.get("routine_id")),
                    day_index=s_data.get("day_index"),
                    started_at=s_data.get("started_at"),
                    completed_at=s_data.get("completed_at"),
                    notes=s_data.get("notes"),
                    locked_exercises=s_data.get("locked_exercises", []),
                )
                db.add(session)
                db.flush()
                session_map[s_data["id"]] = session.id
                added["sessions"] += 1
            else:
                session_map[s_data["id"]] = s_data["id"]

        db.commit()

        # Import sets (skip existing by ID)
        existing_set_ids = {s.id for s in db.query(Set).all()}
        for st_data in data.get("sets", []):
            if st_data["id"] not in existing_set_ids:
                new_set = Set(
                    session_id=session_map.get(st_data["session_id"], st_data["session_id"]),
                    exercise_id=st_data["exercise_id"],
                    set_number=st_data["set_number"],
                    weight_kg=st_data.get("weight_kg"),
                    reps=st_data.get("reps"),
                    duration_sec=st_data.get("duration_sec"),
                    rpe=st_data.get("rpe"),
                    completed_at=st_data.get("completed_at"),
                )
                db.add(new_set)
                added["sets"] += 1

        db.commit()

        print(f"✅ Imported {added['users']} users, {added['routines']} routines, "
              f"{added['sessions']} sessions, {added['sets']} sets from {filepath}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m app.db_export_import [export|import] <filepath>")
        sys.exit(1)

    command = sys.argv[1]
    filepath = sys.argv[2]

    if command == "export":
        export_data(filepath)
    elif command == "import":
        import_data(filepath)
    else:
        print(f"Unknown command: {command}. Use 'export' or 'import'.")
        sys.exit(1)
