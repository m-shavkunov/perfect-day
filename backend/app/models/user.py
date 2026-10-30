from sqlalchemy import Column, Integer, String, Date, DateTime
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)
    chronotype = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())