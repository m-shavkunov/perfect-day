from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String, nullable=False)
    duration_min = Column(Integer, nullable=False)
    priority = Column(String, nullable=False, default="medium")
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="planned")
    created_at = Column(DateTime(timezone=True), server_default=func.now())