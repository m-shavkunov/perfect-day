from datetime import date
from app.models.user import User
from app.core.security import hash_password, create_access_token

def get_auth_headers(db):
    user = User(
        email="test_task_user@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2000, 1, 1), 
        chronotype="lark"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def test_create_task(client, db):
    headers = get_auth_headers(db)
    response = client.post(
        "/tasks/",
        json={"title": "Тестовая задача", "type": "intellectual", "duration_min": 60},
        headers=headers
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Тестовая задача"


def test_get_tasks(client, db):
    headers = get_auth_headers(db)
    response = client.get("/tasks/", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_delete_task(client, db):
    headers = get_auth_headers(db)
    
    create_res = client.post(
        "/tasks/", 
        json={"title": "Удалить меня", "type": "routine", "duration_min": 30}, 
        headers=headers
    )
    task_id = create_res.json()["id"]
    
    
    del_res = client.delete(f"/tasks/{task_id}", headers=headers)
    assert del_res.status_code == 204



def test_create_task_invalid_type(client, db):
    headers = get_auth_headers(db)
    response = client.post(
        "/tasks/",
        json={
            "title": "Неверный тип",
            "type": "unknown",
            "duration_min": 30
        },
        headers=headers
    )
    assert response.status_code == 422


def test_create_task_invalid_duration(client, db):
    headers = get_auth_headers(db)
    response = client.post(
        "/tasks/",
        json={
            "title": "Неверная длительность",
            "type": "routine",
            "duration_min": 0
        },
        headers=headers
    )
    assert response.status_code == 422


def test_create_task_invalid_priority(client, db):
    headers = get_auth_headers(db)
    response = client.post(
        "/tasks/",
        json={
            "title": "Неверный приоритет",
            "type": "routine",
            "duration_min": 30,
            "priority": "urgent"
        },
        headers=headers
    )
    assert response.status_code == 422


def test_update_task_rejects_null_title(client, db):
    headers = get_auth_headers(db)
    create_response = client.post(
        "/tasks/",
        json={
            "title": "Исходная задача",
            "type": "routine",
            "duration_min": 30
        },
        headers=headers
    )

    task_id = create_response.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"title": None},
        headers=headers
    )

    assert response.status_code == 422

def test_get_task(client, db):
    headers = get_auth_headers(db)
    create_response = client.post(
        "/tasks/",
        json={
            "title": "Моя задача",
            "type": "routine",
            "duration_min": 30
        },
        headers=headers
    )
    task_id = create_response.json()["id"]

    response = client.get(f"/tasks/{task_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["title"] == "Моя задача"


def test_update_task(client, db):
    headers = get_auth_headers(db)
    create_response = client.post(
        "/tasks/",
        json={
            "title": "Старая задача",
            "type": "routine",
            "duration_min": 30
        },
        headers=headers
    )
    task_id = create_response.json()["id"]

    response = client.put(
        f"/tasks/{task_id}",
        json={"title": "Обновленная задача"},
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Обновленная задача"


def test_user_cannot_access_another_users_task(client, db):
    headers = get_auth_headers(db)
    create_response = client.post(
        "/tasks/",
        json={
            "title": "Чужая задача",
            "type": "routine",
            "duration_min": 30
        },
        headers=headers
    )
    task_id = create_response.json()["id"]

    another_user = User(
        email="another_task_user@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )
    db.add(another_user)
    db.commit()
    db.refresh(another_user)

    another_token = create_access_token(another_user.id)
    another_headers = {"Authorization": f"Bearer {another_token}"}

    response = client.get(f"/tasks/{task_id}", headers=another_headers)

    assert response.status_code == 404