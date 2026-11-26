
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator
)


TaskType = Literal["intellectual", "physical", "creative", "routine"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["planned", "done", "cancelled"]


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    type: TaskType
    duration_min: int = Field(gt=0, le=1440)
    priority: TaskPriority = "medium"
    deadline: datetime | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value):
        if not value.strip():
            raise ValueError("Title cannot contain only spaces")
        return value


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    type: TaskType | None = None
    duration_min: int | None = Field(default=None, gt=0, le=1440)
    priority: TaskPriority | None = None
    deadline: datetime | None = None
    status: TaskStatus | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Title cannot contain only spaces")
        return value

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
