
from datetime import date, time, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.models.task import Task
from app.models.schedule import Schedule
from app.models.schedule_item import ScheduleItem
from app.schemas.schedule import (
    ScheduleItemResponse,
    ScheduleResponse,
    ScheduleGenerateResponse,
    ScheduleUpdate
)
from app.services.planner import generate_schedule


router = APIRouter(prefix="/schedules", tags=["Schedules"])


WORK_START = time(9, 0)
WORK_END = time(18, 0)
LUNCH_START = time(13, 0)
LUNCH_END = time(14, 0)

BREAK_DURATION = 10


def build_schedule_response(schedule, db):
    items = (
        db.query(ScheduleItem)
        .filter(ScheduleItem.schedule_id == schedule.id)
        .order_by(ScheduleItem.start_time)
        .all()
    )

    return {
        "id": schedule.id,
        "user_id": schedule.user_id,
        "date": schedule.date,
        "created_at": schedule.created_at,
        "items": items
    }


def validate_schedule_items(items):
    sorted_items = sorted(items, key=lambda item: item.start_time)

    previous_end = None
    seen_task_ids = set()

    for item in sorted_items:
        if item.start_time < WORK_START or item.end_time > WORK_END:
            raise HTTPException(
                status_code=422,
                detail="Schedule item must be within working hours"
            )

        if item.start_time < LUNCH_END and item.end_time > LUNCH_START:
            raise HTTPException(
                status_code=422,
                detail="Schedule item cannot overlap lunch"
            )

        if previous_end is not None and item.start_time < previous_end:
            raise HTTPException(
                status_code=422,
                detail="Schedule items cannot overlap"
            )

        if item.item_type == "task":
            if item.task_id in seen_task_ids:
                raise HTTPException(
                    status_code=422,
                    detail="Task cannot appear more than once"
                )
            seen_task_ids.add(item.task_id)

        elif item.item_type == "break":
            duration = (
                datetime.combine(date.min, item.end_time)
                - datetime.combine(date.min, item.start_time)
            )

            if duration.total_seconds() != BREAK_DURATION * 60:
                raise HTTPException(
                    status_code=422,
                    detail="Break must be exactly 10 minutes"
                )

        previous_end = item.end_time


def get_owned_schedule(schedule_id, db, current_user):
    schedule = (
        db.query(Schedule)
        .filter(
            Schedule.id == schedule_id,
            Schedule.user_id == current_user.id
        )
        .first()
    )

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    return schedule


@router.post("/generate", response_model=ScheduleGenerateResponse)
def create_schedule(
    target_date: date,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status == "planned"
        )
        .all()
    )

    result = generate_schedule(
        tasks,
        target_date,
        current_user.birth_date,
        current_user.chronotype
    )

    schedule = (
        db.query(Schedule)
        .filter(
            Schedule.user_id == current_user.id,
            Schedule.date == target_date
        )
        .first()
    )

    if schedule:
        db.query(ScheduleItem).filter(
            ScheduleItem.schedule_id == schedule.id
        ).delete()
    else:
        schedule = Schedule(
            user_id=current_user.id,
            date=target_date
        )
        db.add(schedule)
        db.flush()

    for item in result["items"]:
        db.add(
            ScheduleItem(
                schedule_id=schedule.id,
                **item
            )
        )

    db.commit()
    db.refresh(schedule)

    return {
        "schedule": build_schedule_response(schedule, db),
        "unscheduled_task_ids": result["unscheduled_task_ids"]
    }


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    schedule = get_owned_schedule(schedule_id, db, current_user)
    return build_schedule_response(schedule, db)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    schedule = get_owned_schedule(schedule_id, db, current_user)

    validate_schedule_items(schedule_data.items)

    task_ids = [
        item.task_id
        for item in schedule_data.items
        if item.item_type == "task"
    ]

    if task_ids:
        tasks = (
            db.query(Task)
            .filter(
                Task.id.in_(task_ids),
                Task.user_id == current_user.id
            )
            .all()
        )

        tasks_by_id = {task.id: task for task in tasks}

        if set(tasks_by_id) != set(task_ids):
            raise HTTPException(
                status_code=404,
                detail="One or more tasks not found"
            )

        for item in schedule_data.items:
            if item.item_type != "task":
                continue

            task = tasks_by_id[item.task_id]

            if task.status != "planned":
                raise HTTPException(
                    status_code=422,
                    detail="Only planned tasks can be added to schedule"
                )

            duration = (
                datetime.combine(date.min, item.end_time)
                - datetime.combine(date.min, item.start_time)
            )

            if duration.total_seconds() != task.duration_min * 60:
                raise HTTPException(
                    status_code=422,
                    detail="Schedule item duration must match task duration"
                )

    db.query(ScheduleItem).filter(
        ScheduleItem.schedule_id == schedule.id
    ).delete()

    for item in schedule_data.items:
        db.add(
            ScheduleItem(
                schedule_id=schedule.id,
                **item.model_dump()
            )
        )

    db.commit()
    db.refresh(schedule)

    return build_schedule_response(schedule, db)
