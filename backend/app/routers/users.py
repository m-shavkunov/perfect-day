
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.biorhythm_cache import BiorhythmCache
from app.schemas.user import UserResponse, UserUpdate
from app.core.security import get_current_user

router = APIRouter(prefix="/users", tags=["Пользователи"])


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.birth_date != user_data.birth_date:
        db.query(BiorhythmCache).filter(
            BiorhythmCache.user_id == current_user.id
        ).delete()

    current_user.birth_date = user_data.birth_date
    current_user.chronotype = user_data.chronotype

    db.commit()
    db.refresh(current_user)

    return current_user
