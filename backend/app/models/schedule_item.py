from sqlalchemy import Column, Integer, Time, ForeignKey, String, CheckConstraint

from app.database import Base


class ScheduleItem(Base):
    __tablename__ = "schedule_items"

    __table_args__ = (
        CheckConstraint(
            "(item_type = 'task' AND task_id IS NOT NULL) OR "
            "(item_type = 'break' AND task_id IS NULL)",
            name="ck_schedule_items_type_task"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    item_type = Column(String, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)