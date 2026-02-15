from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    settings: Optional[Dict[str, Any]] = None
    weight: Optional[int] = None
    height: Optional[int] = None
    age: Optional[int] = None
    priorities: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    weight: Optional[int] = None
    height: Optional[int] = None
    age: Optional[int] = None
    priorities: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None

# Exercise
class ExerciseBase(BaseModel):
    name: str
    description: Optional[str] = None
    muscle: Optional[str] = None
    muscle_group: Optional[str] = None
    equipment: Optional[str] = None
    type: Optional[str] = None
    is_bodyweight: bool = False
    default_weight_kg: Optional[float] = None
    name_translations: Optional[Dict[str, str]] = None

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: int
    source: str
    user_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

# Set
class SetBase(BaseModel):
    set_number: int
    weight_kg: Optional[float] = None
    reps: Optional[int] = None
    duration_sec: Optional[int] = None
    rpe: Optional[float] = None
    completed_at: Optional[datetime] = None

class SetCreate(SetBase):
    exercise_id: int

class SetUpdate(SetBase):
    exercise_id: Optional[int] = None
    set_number: Optional[int] = None

class SetResponse(SetBase):
    id: int
    session_id: int
    exercise_id: int
    completed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# Session
class SessionBase(BaseModel):
    notes: Optional[str] = None

class SessionCreate(SessionBase):
    routine_id: Optional[int] = None
    day_index: Optional[int] = None
    started_at: Optional[datetime] = None

class SessionUpdate(SessionBase):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class SessionResponse(SessionBase):
    id: int
    user_id: int
    routine_id: Optional[int] = None
    day_index: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    sets: List[SetResponse] = []
    model_config = ConfigDict(from_attributes=True)

# Routine day structure
class RoutineDayExercise(BaseModel):
    exercise_id: int
    sets: int
    reps: str
    rest: int
    notes: Optional[str] = None

class RoutineDay(BaseModel):
    day_name: str
    exercises: List[RoutineDayExercise]

# Routine
class RoutineBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_favorite: bool = False
    days: List[Dict[str, Any]] = [] # Flexible for now, or use RoutineDay

class RoutineCreate(RoutineBase):
    pass

class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    days: Optional[List[Dict[str, Any]]] = None

class RoutineResponse(RoutineBase):
    id: int
    user_id: int
    model_config = ConfigDict(from_attributes=True)

# Sync
class SyncEventCreate(BaseModel):
    event_type: str
    payload: Dict[str, Any]
    client_timestamp: datetime
