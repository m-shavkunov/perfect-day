
from datetime import date, time, datetime, timedelta

from app.services.recommendation import generate_recommendation


WORK_START = time(9, 0)
WORK_END = time(18, 0)

LUNCH_START = time(13, 0)
LUNCH_END = time(14, 0)

BREAK_DURATION = 10
WORK_BEFORE_BREAK = 50

PRIORITY_ORDER = {
    "high": 0,
    "medium": 1,
    "low": 2
}


def _get_recommendation_score(task, birth_date, target_date, chronotype):
    recommendation = generate_recommendation(
        task_type=task.type,
        birth_date=birth_date,
        target_date=target_date,
        chronotype=chronotype
    )

    return recommendation.get("activity_value") or 0


def _get_deadline_key(deadline):
    if deadline is None:
        return date.max, time.max

    if isinstance(deadline, datetime):
        return deadline.date(), deadline.time().replace(tzinfo=None)

    if isinstance(deadline, date):
        return deadline, time.max

    return date.max, time.max


def _get_task_sort_key(task, birth_date, target_date, chronotype):
    priority = PRIORITY_ORDER.get(task.priority, 3)

    deadline_date, deadline_time = _get_deadline_key(task.deadline)

    recommendation_score = _get_recommendation_score(
        task,
        birth_date,
        target_date,
        chronotype
    )

    return (
        priority,
        deadline_date,
        deadline_time,
        -recommendation_score
    )


def _add_break(items, current_time, day_end, lunch_start, lunch_end):
    if lunch_start <= current_time < lunch_end:
        current_time = lunch_end

    break_end = current_time + timedelta(minutes=BREAK_DURATION)

    if current_time < lunch_start and break_end > lunch_start:
        current_time = lunch_end
        break_end = current_time + timedelta(minutes=BREAK_DURATION)

    if break_end > day_end:
        return current_time

    items.append({
        "task_id": None,
        "item_type": "break",
        "start_time": current_time.time(),
        "end_time": break_end.time()
    })

    return break_end


def generate_schedule(tasks, target_date, birth_date, chronotype):
    tasks = sorted(
        tasks,
        key=lambda task: _get_task_sort_key(
            task,
            birth_date,
            target_date,
            chronotype
        )
    )

    day_start = datetime.combine(target_date, WORK_START)
    day_end = datetime.combine(target_date, WORK_END)

    lunch_start = datetime.combine(target_date, LUNCH_START)
    lunch_end = datetime.combine(target_date, LUNCH_END)

    current_time = day_start
    accumulated_work = 0

    items = []
    unscheduled_task_ids = []

    for task in tasks:
        duration = timedelta(minutes=task.duration_min)

        if lunch_start <= current_time < lunch_end:
            current_time = lunch_end

        if current_time < lunch_start:
            if current_time + duration > lunch_start:
                current_time = lunch_end

        if current_time + duration > day_end:
            unscheduled_task_ids.append(task.id)
            continue

        task_end = current_time + duration

        items.append({
            "task_id": task.id,
            "item_type": "task",
            "start_time": current_time.time(),
            "end_time": task_end.time()
        })

        current_time = task_end
        accumulated_work += task.duration_min

        if accumulated_work >= WORK_BEFORE_BREAK:
            current_time = _add_break(
                items,
                current_time,
                day_end,
                lunch_start,
                lunch_end
            )

            accumulated_work = 0

    return {
        "items": items,
        "unscheduled_task_ids": unscheduled_task_ids
    }
