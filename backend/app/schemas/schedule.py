
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


ItemType = Literal["task", "break"]


class ScheduleItemInput(BaseModel):
    task_id: int | None = None
    item_type: ItemType
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_item(self):
        if self.end_time <= self.start_time:
            raise ValueError("End time must be later than start time")

        if self.item_type == "task" and self.task_id is None:
            raise ValueError("Task item must have task_id")

        if self.item_type == "break" and self.task_id is not None:
            raise ValueError("Break item cannot have task_id")

        return self


class ScheduleItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_id: int
    task_id: int | None
    item_type: ItemType
    start_time: time
    end_time: time


class ScheduleResponse(BaseModel):
    id: int
    user_id: int
    date: date
    created_at: datetime
    items: list[ScheduleItemResponse]


class ScheduleGenerateResponse(BaseModel):
    schedule: ScheduleResponse
    unscheduled_task_ids: list[int]


class ScheduleUpdate(BaseModel):
    items: list[ScheduleItemInput]
