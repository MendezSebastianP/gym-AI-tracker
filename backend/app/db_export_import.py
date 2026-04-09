"""
Database Export / Import utility for Gym AI Tracker.

Usage:
  # Export all user data to a JSON file:
  docker compose exec api python -m app.db_export_import export /app/backup.json

  # Import user data from a JSON file (skips existing records by PK/email):
  docker compose exec api python -m app.db_export_import import /app/backup.json

This exports ONLY user-generated data (users, routines, sessions, sets).
System exercises are NOT exported — they are re-created by seed_data.py.
"""
from __future__ import annotations

import json
import sys
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.routine import Routine
from app.models.session import Session as SessionModel, Set as SetModel
from app.models.user import User

SessionFactory = Callable[[], Session]


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()

def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


@contextmanager
def _session_scope(session_factory: SessionFactory) -> Generator[Session, None, None]:
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

def export_data(filepath: str, session_factory: SessionFactory = SessionLocal) -> None:
    with _session_scope(session_factory) as db:
        users = db.query(User).order_by(User.id.asc()).all()
        routines = db.query(Routine).order_by(Routine.id.asc()).all()
        sessions = db.query(SessionModel).order_by(SessionModel.id.asc()).all()
        sets = db.query(SetModel).order_by(SetModel.id.asc()).all()

        data = {
            "schema_version": 2,
            "exported_at": _serialize_datetime(datetime.now(timezone.utc)),
            "users": [],
            "routines": [],
            "sessions": [],
            "sets": [],
        }

        for user in users:
            data["users"].append({
                "id": user.id,
                "email": user.email,
                "password_hash": user.password_hash,
                "is_active": user.is_active,
                "is_admin": user.is_admin,
                "is_demo": user.is_demo,
                "settings": user.settings,
                "weight": user.weight,
                "height": user.height,
                "age": user.age,
                "gender": user.gender,
                "priorities": user.priorities,
                "refresh_token_hash": user.refresh_token_hash,
                "refresh_token_expires_at": _serialize_datetime(user.refresh_token_expires_at),
                "level": user.level,
                "experience": user.experience,
                "currency": user.currency,
                "streak_reward_week": user.streak_reward_week,
                "joker_tokens": user.joker_tokens,
                "onboarding_progress": user.onboarding_progress,
            })

        for routine in routines:
            data["routines"].append({
                "id": routine.id,
                "user_id": routine.user_id,
                "name": routine.name,
                "description": routine.description,
                "is_favorite": routine.is_favorite,
                "archived_at": _serialize_datetime(routine.archived_at),
                "days": routine.days,
            })

        for session in sessions:
            data["sessions"].append({
                "id": session.id,
                "user_id": session.user_id,
                "routine_id": session.routine_id,
                "day_index": session.day_index,
                "started_at": _serialize_datetime(session.started_at),
                "completed_at": _serialize_datetime(session.completed_at),
                "bodyweight_kg": session.bodyweight_kg,
                "notes": session.notes,
                "duration_seconds": session.duration_seconds,
                "locked_exercises": session.locked_exercises,
                "streak_eligible_at": _serialize_datetime(session.streak_eligible_at),
                "effort_score": session.effort_score,
                "self_rated_effort": session.self_rated_effort,
            })

        for item in sets:
            data["sets"].append({
                "id": item.id,
                "session_id": item.session_id,
                "exercise_id": item.exercise_id,
                "set_number": item.set_number,
                "weight_kg": item.weight_kg,
                "reps": item.reps,
                "duration_sec": item.duration_sec,

                "distance_km": item.distance_km,
                "avg_pace": item.avg_pace,
                "incline": item.incline,
                "set_type": item.set_type,
                "to_failure": item.to_failure,
                "completed_at": _serialize_datetime(item.completed_at),
            })

        with open(filepath, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)

    print(
        f"✅ Exported {len(data['users'])} users, {len(data['routines'])} routines, "
        f"{len(data['sessions'])} sessions, {len(data['sets'])} sets to {filepath}"
    )

def import_data(filepath: str, session_factory: SessionFactory = SessionLocal) -> None:
    with open(filepath, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    with _session_scope(session_factory) as db:
        added = {"users": 0, "routines": 0, "sessions": 0, "sets": 0}

        existing_emails = {user.email for user in db.query(User).all()}
        for user_data in data.get("users", []):
            if user_data["email"] in existing_emails:
                continue

            user = User(
                email=user_data["email"],
                password_hash=user_data["password_hash"],
                is_active=user_data.get("is_active", True),
                is_admin=user_data.get("is_admin", False),
                is_demo=user_data.get("is_demo", False),
                settings=user_data.get("settings") or {},
                weight=user_data.get("weight"),
                height=user_data.get("height"),
                age=user_data.get("age"),
                gender=user_data.get("gender"),
                priorities=user_data.get("priorities") or {},
                refresh_token_hash=user_data.get("refresh_token_hash"),
                refresh_token_expires_at=_parse_datetime(user_data.get("refresh_token_expires_at")),
                level=user_data.get("level", 1),
                experience=user_data.get("experience", 0),
                currency=user_data.get("currency", 100),
                streak_reward_week=user_data.get("streak_reward_week"),
                joker_tokens=user_data.get("joker_tokens", 0),
                onboarding_progress=user_data.get("onboarding_progress") or {},
            )
            db.add(user)
            db.flush()
            existing_emails.add(user.email)
            added["users"] += 1

        db.commit()

        user_map: dict[int, int] = {}
        all_users = {user.email: user.id for user in db.query(User).all()}
        for user_data in data.get("users", []):
            user_map[user_data["id"]] = all_users[user_data["email"]]

        existing_routine_ids = {routine_id for (routine_id,) in db.query(Routine.id).all()}
        routine_map: dict[int, int] = {}
        for routine_data in data.get("routines", []):
            if routine_data["id"] not in existing_routine_ids:
                routine = Routine(
                    user_id=user_map.get(routine_data["user_id"], routine_data["user_id"]),
                    name=routine_data["name"],
                    description=routine_data.get("description"),
                    is_favorite=routine_data.get("is_favorite", False),
                    archived_at=_parse_datetime(routine_data.get("archived_at")),
                    days=routine_data.get("days") or [],
                )
                db.add(routine)
                db.flush()
                routine_map[routine_data["id"]] = routine.id
                added["routines"] += 1
            else:
                routine_map[routine_data["id"]] = routine_data["id"]

        db.commit()

        existing_session_ids = {session_id for (session_id,) in db.query(SessionModel.id).all()}
        session_map: dict[int, int] = {}
        for session_data in data.get("sessions", []):
            if session_data["id"] not in existing_session_ids:
                session = SessionModel(
                    user_id=user_map.get(session_data["user_id"], session_data["user_id"]),
                    routine_id=routine_map.get(session_data.get("routine_id"), session_data.get("routine_id")),
                    day_index=session_data.get("day_index"),
                    started_at=_parse_datetime(session_data.get("started_at")),
                    completed_at=_parse_datetime(session_data.get("completed_at")),
                    bodyweight_kg=session_data.get("bodyweight_kg"),
                    notes=session_data.get("notes"),
                    duration_seconds=session_data.get("duration_seconds"),
                    locked_exercises=session_data.get("locked_exercises") or [],
                    streak_eligible_at=_parse_datetime(session_data.get("streak_eligible_at")),
                    effort_score=session_data.get("effort_score"),
                    self_rated_effort=session_data.get("self_rated_effort"),
                )
                db.add(session)
                db.flush()
                session_map[session_data["id"]] = session.id
                added["sessions"] += 1
            else:
                session_map[session_data["id"]] = session_data["id"]

        db.commit()

        existing_set_ids = {set_id for (set_id,) in db.query(SetModel.id).all()}
        for item_data in data.get("sets", []):
            if item_data["id"] in existing_set_ids:
                continue

            new_set = SetModel(
                session_id=session_map.get(item_data["session_id"], item_data["session_id"]),
                exercise_id=item_data["exercise_id"],
                set_number=item_data["set_number"],
                weight_kg=item_data.get("weight_kg"),
                reps=item_data.get("reps"),
                duration_sec=item_data.get("duration_sec"),

                distance_km=item_data.get("distance_km"),
                avg_pace=item_data.get("avg_pace"),
                incline=item_data.get("incline"),
                set_type=item_data.get("set_type") or "normal",
                to_failure=item_data.get("to_failure", False),
                completed_at=_parse_datetime(item_data.get("completed_at")),
            )
            db.add(new_set)
            added["sets"] += 1

        db.commit()

    print(
        f"✅ Imported {added['users']} users, {added['routines']} routines, "
        f"{added['sessions']} sessions, {added['sets']} sets from {filepath}"
    )


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
