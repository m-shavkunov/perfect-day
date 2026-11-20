from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import time

class UserSettingsBase(BaseModel):
    work_start: time = Field(default=time(9, 0))
    work_end: time = Field(default=time(18, 0))
    lunch_start: time = Field(default=time(13, 0))
    lunch_end: time = Field(default=time(14, 0))
    break_duration_min: int = Field(default=10, gt=0)
    work_before_break_min: int = Field(default=50, gt=0)

    @model_validator(mode="after")
    def check_times(self):
        if self.work_start >= self.work_end:
            raise ValueError("Начало рабочего дня должно быть раньше конца")
        if self.lunch_start >= self.lunch_end:
            raise ValueError("Начало обеда должно быть раньше конца")
        if self.lunch_start < self.work_start or self.lunch_end > self.work_end:
            raise ValueError("Обед должен находиться в пределах рабочего дня")
        return self

class UserSettingsUpdate(UserSettingsBase):
    pass

class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)
