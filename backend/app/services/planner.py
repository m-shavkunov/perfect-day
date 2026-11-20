
from datetime import date, time, datetime, timedelta

from app.services.biorhythm import calculate_biorhythms


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

ACTIVITY_BY_TASK_TYPE = {
    "intellectual": "intellectual",
    "physical": "physical",
    "creative": "emotional"
}


def _get_recommendation_score(task, biorhythms):
    activity_name = ACTIVITY_BY_TASK_TYPE.get(task.type)

    if activity_name is None:
        return 0

    return biorhythms.get(activity_name) or 0


def _get_deadline_key(deadline):
    if deadline is None:
        return date.max, time.max

    if isinstance(deadline, datetime):
        return deadline.date(), deadline.time().replace(tzinfo=None)

    if isinstance(deadline, date):
        return deadline, time.max

    return date.max, time.max


def _get_task_sort_key(task, biorhythms):
    priority = PRIORITY_ORDER.get(task.priority, 3)

    deadline_date, deadline_time = _get_deadline_key(task.deadline)

    recommendation_score = _get_recommendation_score(
        task,
        biorhythms
    )

    return (
        priority,
        deadline_date,
        deadline_time,
        -recommendation_score
    )


def _add_break(
    items,
    current_time,
    day_end,
    lunch_start,
    lunch_end,
    break_duration
):
    if lunch_start <= current_time < lunch_end:
        current_time = lunch_end

    break_end = current_time + timedelta(minutes=break_duration)

    if current_time < lunch_start and break_end > lunch_start:
        current_time = lunch_end
        break_end = current_time + timedelta(minutes=break_duration)

    if break_end > day_end:
        return current_time

    items.append({
        "task_id": None,
        "item_type": "break",
        "start_time": current_time.time(),
        "end_time": break_end.time()
    })

    return break_end


def generate_schedule(
    tasks,
    target_date,
    birth_date,
    chronotype,
    settings=None
):
    work_start = settings.work_start if settings else WORK_START
    work_end = settings.work_end if settings else WORK_END
    lunch_start_time = settings.lunch_start if settings else LUNCH_START
    lunch_end_time = settings.lunch_end if settings else LUNCH_END
    break_duration = settings.break_duration_min if settings else BREAK_DURATION
    work_before_break = (
        settings.work_before_break_min if settings else WORK_BEFORE_BREAK
    )

    biorhythms = calculate_biorhythms(
        birth_date,
        target_date
    )

    tasks = sorted(
        tasks,
        key=lambda task: _get_task_sort_key(
            task,
            biorhythms
        )
    )

    day_start = datetime.combine(target_date, work_start)
    day_end = datetime.combine(target_date, work_end)

    lunch_start = datetime.combine(target_date, lunch_start_time)
    lunch_end = datetime.combine(target_date, lunch_end_time)

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

        if accumulated_work >= work_before_break:
            current_time = _add_break(
                items,
                current_time,
                day_end,
                lunch_start,
                lunch_end,
                break_duration
            )

            accumulated_work = 0

    return {
        "items": items,
        "unscheduled_task_ids": unscheduled_task_ids
    }
