from datetime import date

from pydantic import BaseModel


class BiorhythmResponse(BaseModel):
    physical: float
    emotional: float
    intellectual: float


class BiorhythmPeriodItem(BaseModel):
    date: date
    physical: float
    emotional: float
    intellectual: float


class BiorhythmPeriodResponse(BaseModel):
    items: list[BiorhythmPeriodItem]


class CriticalDayItem(BaseModel):
    date: date
    biorhythm: str
    direction: str


class CriticalDaysResponse(BaseModel):
    items: list[CriticalDayItem]