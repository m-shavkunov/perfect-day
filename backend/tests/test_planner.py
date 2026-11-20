
from datetime import date, time
from types import SimpleNamespace

from app.services.planner import generate_schedule


BIRTH_DATE = date(2005, 1, 1)
TARGET_DATE = date(2026, 11, 14)


def make_task(task_id, duration, priority="high", task_type="intellectual"):
    return SimpleNamespace(
        id=task_id,
        title=f"Задача {task_id}",
        duration_min=duration,
        priority=priority,
        type=task_type,
        deadline=None
    )


def generate(tasks):
    return generate_schedule(
        tasks,
        TARGET_DATE,
        BIRTH_DATE,
        "lark"
    )


def test_long_task_gets_one_break():
    result = generate([make_task(1, 120)])

    assert result["items"] == [
        {
            "task_id": 1,
            "item_type": "task",
            "start_time": time(9, 0),
            "end_time": time(11, 0)
        },
        {
            "task_id": None,
            "item_type": "break",
            "start_time": time(11, 0),
            "end_time": time(11, 10)
        }
    ]


def test_task_that_does_not_fit_before_lunch_moves_after_lunch():
    result = generate([
        make_task(1, 150),
        make_task(2, 120)
    ])

    second_task = next(
        item for item in result["items"]
        if item["task_id"] == 2
    )

    assert second_task["start_time"] == time(14, 0)
    assert second_task["end_time"] == time(16, 0)


def test_task_that_does_not_fit_in_working_day_is_unscheduled():
    result = generate([make_task(1, 550)])

    assert result["items"] == []
    assert result["unscheduled_task_ids"] == [1]


def test_break_does_not_overlap_lunch():
    result = generate([make_task(1, 240)])

    assert result["items"] == [
        {
            "task_id": 1,
            "item_type": "task",
            "start_time": time(9, 0),
            "end_time": time(13, 0)
        },
        {
            "task_id": None,
            "item_type": "break",
            "start_time": time(14, 0),
            "end_time": time(14, 10)
        }
    ]


def test_break_can_end_at_lunch_start():
    result = generate([make_task(1, 230)])

    break_item = next(
        item for item in result["items"]
        if item["item_type"] == "break"
    )

    assert break_item["start_time"] == time(12, 50)
    assert break_item["end_time"] == time(13, 0)


def test_break_does_not_go_beyond_working_day():
    result = generate([make_task(1, 540)])

    assert result["items"] == []
    assert result["unscheduled_task_ids"] == [1]
