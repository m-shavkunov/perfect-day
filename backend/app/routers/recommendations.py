from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.task import Task
from app.core.security import get_current_user
from app.services.recommendation import generate_recommendation
from app.schemas.recommendation import RecommendationResponse


router = APIRouter(
    prefix="/recommendations",
    tags=["Рекомендации"]
)


@router.get("/", response_model=RecommendationResponse)
def get_recommendations(
    target_date: date = Query(default_factory=date.today),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status == "planned"
        )
        .all()
    )

    recommendations = []

    for task in tasks:
        result = generate_recommendation(
            task_type=task.type,
            birth_date=current_user.birth_date,
            target_date=target_date,
            chronotype=current_user.chronotype
        )

        recommendations.append({
            "task_id": task.id,
            "title": task.title,
            "task_type": task.type,
            "recommendation": result["recommendation"],
            "reason": result["reason"],
            "activity_value": result.get("activity_value")
        })

    return {
        "date": target_date,
        "items": recommendations
    }