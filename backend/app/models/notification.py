
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    schedule_item_id = Column(
        Integer,
        ForeignKey("schedule_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    status = Column(
        String,
        nullable=False,
        default="pending"
    )

    attempts = Column(
        Integer,
        nullable=False,
        default=0
    )

    last_error = Column(Text, nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )