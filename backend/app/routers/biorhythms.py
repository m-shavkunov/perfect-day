from datetime import date

from fastapi import APIRouter, Depends, Query
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.biorhythm import BiorhythmResponse
from app.services.biorhythm import calculate_biorhythms


router = APIRouter(prefix="/biorhythms", tags=["Биоритмы"])


@router.get("/", response_model=BiorhythmResponse)
def get_biorhythms(
    target_date: date = Query(default=None),
    current_user: User = Depends(get_current_user)
):
    calculation_date = target_date or date.today()

    return calculate_biorhythms(
        current_user.birth_date,
        calculation_date
    )