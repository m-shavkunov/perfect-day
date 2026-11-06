
from datetime import date

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.biorhythm_cache import BiorhythmCache
from app.schemas.biorhythm import (
    BiorhythmResponse,
    BiorhythmPeriodResponse,
    CriticalDaysResponse
)
from app.services.biorhythm import (
    calculate_biorhythms,
    calculate_biorhythm_period,
    find_critical_days
)


router = APIRouter(prefix="/biorhythms", tags=["Биоритмы"])


@router.get("/", response_model=BiorhythmResponse)
def get_biorhythms(
    target_date: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    calculation_date = target_date or date.today()

    cached = db.query(BiorhythmCache).filter(
        BiorhythmCache.user_id == current_user.id,
        BiorhythmCache.date == calculation_date
    ).first()

    if cached:
        return {
            "physical": cached.physical,
            "emotional": cached.emotional,
            "intellectual": cached.intellectual
        }

    result = calculate_biorhythms(
        current_user.birth_date,
        calculation_date
    )

    cache_entry = BiorhythmCache(
        user_id=current_user.id,
        date=calculation_date,
        physical=result["physical"],
        emotional=result["emotional"],
        intellectual=result["intellectual"]
    )

    db.add(cache_entry)
    db.commit()

    return result


@router.get("/period", response_model=BiorhythmPeriodResponse)
def get_biorhythm_period(
    start_date: date,
    end_date: date,
    current_user: User = Depends(get_current_user)
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must be before or equal to end date"
        )

    results = calculate_biorhythm_period(
        current_user.birth_date,
        start_date,
        end_date
    )

    return {"items": results}


@router.get("/critical-days", response_model=CriticalDaysResponse)
def get_critical_days(
    start_date: date,
    end_date: date,
    current_user: User = Depends(get_current_user)
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must be before or equal to end date"
        )

    results = find_critical_days(
        current_user.birth_date,
        start_date,
        end_date
    )

    return {"items": results}