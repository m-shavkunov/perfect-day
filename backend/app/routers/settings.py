from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user_settings import UserSettings
from app.schemas.settings import UserSettingsUpdate, UserSettingsResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/settings", tags=["Настройки"])

@router.get("/", response_model=UserSettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings

@router.put("/", response_model=UserSettingsResponse)
def update_settings(
    settings_data: UserSettingsUpdate, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    
    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
    
    for key, value in settings_data.model_dump().items():
        setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    return settings