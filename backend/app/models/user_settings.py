from sqlalchemy import Column, Integer, Time, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import time

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    work_start = Column(Time, nullable=False, default=time(9, 0))
    work_end = Column(Time, nullable=False, default=time(18, 0))
    lunch_start = Column(Time, nullable=False, default=time(13, 0))
    lunch_end = Column(Time, nullable=False, default=time(14, 0))
    break_duration_min = Column(Integer, nullable=False, default=10)
    work_before_break_min = Column(Integer, nullable=False, default=50)

    user = relationship("User", back_populates="settings")