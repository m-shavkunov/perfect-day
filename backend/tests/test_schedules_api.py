
from datetime import date, time

from app.models.user_settings import UserSettings

from app.models.user import User
from app.models.task import Task
from app.core.security import hash_password, create_access_token


TARGET_DATE = date(2026, 11, 14)


def create_user(db, email="schedule_user@example.com"):
    user = User(
        email=email,
        password_hash=hash_password("password123"),
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return user, {"Authorization": f"Bearer {token}"}


def create_task(db, user_id, duration=60, status="planned"):
    task = Task(
        user_id=user_id,
        title="Test task",
        type="intellectual",
        duration_min=duration,
        priority="high",
        status=status
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def create_schedule(client, headers):
    response = client.post(
        f"/schedules/generate?target_date={TARGET_DATE}",
        headers=headers
    )
    assert response.status_code == 200
    return response.json()["schedule"]["id"]


def test_generate_schedule(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)

    response = client.post(
        f"/schedules/generate?target_date={TARGET_DATE}",
        headers=headers
    )

    assert response.status_code == 200

    data = response.json()
    items = data["schedule"]["items"]

    assert data["schedule"]["date"] == str(TARGET_DATE)
    assert len(items) == 2
    assert items[0]["item_type"] == "task"
    assert items[1]["item_type"] == "break"
    assert data["unscheduled_task_ids"] == []


def test_get_schedule(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.get(
        f"/schedules/{schedule_id}",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == schedule_id
    assert len(response.json()["items"]) == 2


def test_update_schedule(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["start_time"] == "10:00:00"


def test_user_cannot_access_another_users_schedule(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    _, another_headers = create_user(
        db,
        email="another_schedule_user@example.com"
    )

    response = client.get(
        f"/schedules/{schedule_id}",
        headers=another_headers
    )

    assert response.status_code == 404


def test_update_schedule_rejects_lunch_overlap(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "12:30:00",
                    "end_time": "13:30:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_overlapping_items(client, db):
    user, headers = create_user(db)
    first_task = create_task(db, user.id)
    second_task = create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": first_task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                },
                {
                    "task_id": second_task.id,
                    "item_type": "task",
                    "start_time": "10:30:00",
                    "end_time": "11:30:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_wrong_task_duration(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id, duration=60)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "10:30:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_wrong_break_duration(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id, duration=60)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                },
                {
                    "task_id": None,
                    "item_type": "break",
                    "start_time": "11:00:00",
                    "end_time": "11:15:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_completed_task(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id, status="done")

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_uses_user_settings(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id, duration=60)

    settings = UserSettings(
        user_id=user.id,
        work_start=time(10, 0),
        work_end=time(19, 0),
        lunch_start=time(14, 0),
        lunch_end=time(15, 0),
        break_duration_min=15,
        work_before_break_min=45
    )
    db.add(settings)
    db.commit()

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                },
                {
                    "task_id": None,
                    "item_type": "break",
                    "start_time": "11:00:00",
                    "end_time": "11:15:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 200

    items = response.json()["items"]
    assert items[0]["start_time"] == "10:00:00"
    assert items[1]["end_time"] == "11:15:00"



def test_user_cannot_update_another_users_schedule(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    _, another_headers = create_user(
        db,
        email="another_update_schedule@example.com"
    )

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=another_headers
    )

    assert response.status_code == 404



def test_user_cannot_add_another_users_task_to_schedule(client, db):
    user, headers = create_user(db)
    schedule_id = create_schedule(client, headers)

    another_user, _ = create_user(
        db,
        email="another_task_owner@example.com"
    )
    another_task = create_task(db, another_user.id)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": another_task.id,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 404



def test_update_schedule_rejects_empty_items(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={"items": []},
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_invalid_task_id(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)

    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": -1,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422



def test_update_schedule_rejects_invalid_time_order(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id)
    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "task",
                    "start_time": "11:00:00",
                    "end_time": "10:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_task_without_id(client, db):
    user, headers = create_user(db)
    create_task(db, user.id)
    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": None,
                    "item_type": "task",
                    "start_time": "10:00:00",
                    "end_time": "11:00:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422


def test_update_schedule_rejects_break_with_task_id(client, db):
    user, headers = create_user(db)
    task = create_task(db, user.id)
    schedule_id = create_schedule(client, headers)

    response = client.put(
        f"/schedules/{schedule_id}",
        json={
            "items": [
                {
                    "task_id": task.id,
                    "item_type": "break",
                    "start_time": "10:00:00",
                    "end_time": "10:10:00"
                }
            ]
        },
        headers=headers
    )

    assert response.status_code == 422
