from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: str  # intellectual, physical, creative, routine
    duration_min: int
    priority: str = "medium"
    deadline: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    duration_min: Optional[int] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    user_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True