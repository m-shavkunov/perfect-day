from datetime import date

from app.models.user import User
from app.models.task import Task
from app.core.security import create_access_token


def test_get_recommendations(client, db):
    user = User(
        email="recommendations@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    task = Task(
        user_id=user.id,
        title="Подготовить отчёт",
        type="intellectual",
        duration_min=60,
        priority="high",
        status="planned"
    )

    db.add(task)
    db.commit()

    token = create_access_token(user.id)

    response = client.get(
        "/recommendations/",
        params={"target_date": "2026-11-07"},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    data = response.json()

    assert data["date"] == "2026-11-07"
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Подготовить отчёт"
    assert data["items"][0]["task_type"] == "intellectual"
    assert data["items"][0]["recommendation"] == "Подходящее время для выполнения задачи"


def test_get_recommendations_without_token(client):
    response = client.get(
        "/recommendations/",
        params={"target_date": "2026-11-07"}
    )

    assert response.status_code in (401, 403)


def test_recommendations_only_own_planned_tasks(client, db):
    user = User(
        email="owner@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )

    another_user = User(
        email="another@example.com",
        password_hash="test_hash",
        birth_date=date(1999, 5, 10),
        chronotype="owl"
    )

    db.add_all([user, another_user])
    db.commit()
    db.refresh(user)
    db.refresh(another_user)

    tasks = [
        Task(
            user_id=user.id,
            title="Моя задача",
            type="intellectual",
            duration_min=60,
            status="planned"
        ),
        Task(
            user_id=user.id,
            title="Выполненная задача",
            type="physical",
            duration_min=30,
            status="done"
        ),
        Task(
            user_id=another_user.id,
            title="Чужая задача",
            type="creative",
            duration_min=45,
            status="planned"
        )
    ]

    db.add_all(tasks)
    db.commit()

    token = create_access_token(user.id)

    response = client.get(
        "/recommendations/",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Моя задача"


def test_recommendations_empty_list(client, db):
    user = User(
        email="empty@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        chronotype="owl"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/recommendations/",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["items"] == []
