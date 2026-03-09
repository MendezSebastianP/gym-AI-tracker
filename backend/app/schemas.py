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
    gender: Optional[str] = None
    priorities: Optional[Dict[str, Any]] = None
    level: int = 1
    experience: int = 0
    currency: int = 0
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    weight: Optional[int] = None
    height: Optional[int] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    priorities: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None

# Exercise
class ExerciseBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    muscle: Optional[str] = Field(None, max_length=50)
    secondary_muscle: Optional[str] = Field(None, max_length=50)
    muscle_group: Optional[str] = Field(None, max_length=50)
    equipment: Optional[str] = Field(None, max_length=50)
    type: Optional[str] = Field(None, max_length=50)
    is_bodyweight: bool = False
    default_weight_kg: Optional[float] = None
    name_translations: Optional[Dict[str, str]] = None

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: int
    source: str
    user_id: Optional[int] = None
    difficulty_factor: float = 1.0
    bw_ratio: Optional[float] = None
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
    session_id: int
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
    notes: Optional[str] = Field(None, max_length=2000)
    locked_exercises: Optional[List[int]] = []

class SessionCreate(SessionBase):
    routine_id: Optional[int] = None
    day_index: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

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
    reps: str = Field(max_length=20)
    rest: int
    notes: Optional[str] = Field(None, max_length=500)

class RoutineDay(BaseModel):
    day_name: str = Field(max_length=50)
    exercises: List[RoutineDayExercise]

# Routine
class RoutineBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_favorite: bool = False
    days: List[Dict[str, Any]] = []  # Flexible for now, or use RoutineDay

class RoutineCreate(RoutineBase):
    pass

class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    days: Optional[List[Dict[str, Any]]] = None
    is_favorite: Optional[bool] = None
    archived_at: Optional[datetime] = None

class RoutineResponse(RoutineBase):
    id: int
    user_id: int
    archived_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# Sync
class SyncEventCreate(BaseModel):
    event_type: str = Field(max_length=50)
    payload: Dict[str, Any]
    client_timestamp: datetime
