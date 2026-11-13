
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


TaskType = Literal["intellectual", "physical", "creative", "routine"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["planned", "done", "cancelled"]


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    type: TaskType
    duration_min: int = Field(gt=0)
    priority: TaskPriority = "medium"
    deadline: datetime | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    type: TaskType | None = None
    duration_min: int | None = Field(default=None, gt=0)
    priority: TaskPriority | None = None
    deadline: datetime | None = None
    status: TaskStatus | None = None

    @field_validator("title", "type", "duration_min", "priority", "status", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: TaskStatus
    created_at: datetime
