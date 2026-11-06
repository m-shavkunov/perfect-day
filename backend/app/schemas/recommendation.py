from datetime import date
from pydantic import BaseModel


class RecommendationItem(BaseModel):
    task_id: int
    title: str
    task_type: str
    recommendation: str
    reason: str
    activity_value: float | None = None


class RecommendationResponse(BaseModel):
    date: date
    items: list[RecommendationItem]