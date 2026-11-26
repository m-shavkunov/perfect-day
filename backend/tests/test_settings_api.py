from datetime import date
from app.models.user import User
from app.core.security import hash_password, create_access_token

def get_auth_headers(db):
    user = User(
        email="test_settings_user@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2000, 1, 1),
        chronotype="lark"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}

def test_get_settings_default(client, db):
    headers = get_auth_headers(db)
    response = client.get("/settings/", headers=headers)
    assert response.status_code == 200
    assert response.json()["work_start"] == "09:00:00"  # Значение по умолчанию

def test_update_settings(client, db):
    headers = get_auth_headers(db)
    response = client.put(
        "/settings/",
        json={
            "work_start": "10:00:00",
            "work_end": "19:00:00",
            "lunch_start": "14:00:00",
            "lunch_end": "15:00:00",
            "break_duration_min": 15,
            "work_before_break_min": 45
        },
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["work_start"] == "10:00:00"
    assert response.json()["break_duration_min"] == 15

def test_invalid_settings(client, db):
    headers = get_auth_headers(db)
    # Пытаемся поставить конец рабочего дня раньше начала
    response = client.put(
        "/settings/",
        json={
            "work_start": "18:00:00",
            "work_end": "09:00:00",
            "lunch_start": "13:00:00",
            "lunch_end": "14:00:00",
            "break_duration_min": 10,
            "work_before_break_min": 50
        },
        headers=headers
    )
    assert response.status_code == 422  # Ошибка валидации Pydantic


def test_settings_require_auth(client):
    response = client.get("/settings/")
    assert response.status_code == 401


def test_invalid_break_duration(client, db):
    headers = get_auth_headers(db)
    response = client.put(
        "/settings/",
        json={
            "work_start": "09:00:00",
            "work_end": "18:00:00",
            "lunch_start": "13:00:00",
            "lunch_end": "14:00:00",
            "break_duration_min": 0,
            "work_before_break_min": 50
        },
        headers=headers
    )
    assert response.status_code == 422


def test_invalid_lunch_time(client, db):
    headers = get_auth_headers(db)
    response = client.put(
        "/settings/",
        json={
            "work_start": "09:00:00",
            "work_end": "18:00:00",
            "lunch_start": "08:00:00",
            "lunch_end": "09:00:00",
            "break_duration_min": 10,
            "work_before_break_min": 50
        },
        headers=headers
    )
    assert response.status_code == 422


def test_settings_user_isolation(client, db):
    headers1 = get_auth_headers(db)

    response1 = client.put(
        "/settings/",
        json={
            "work_start": "10:00:00",
            "work_end": "19:00:00",
            "lunch_start": "14:00:00",
            "lunch_end": "15:00:00",
            "break_duration_min": 15,
            "work_before_break_min": 45
        },
        headers=headers1
    )
    assert response1.status_code == 200

    user2 = User(
        email="another_settings_user@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2001, 1, 1),
        chronotype="owl"
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)

    token2 = create_access_token(user2.id)
    headers2 = {"Authorization": f"Bearer {token2}"}

    response = client.get("/settings/", headers=headers2)

    assert response.status_code == 200
    assert response.json()["work_start"] == "09:00:00"


def test_settings_update_does_not_affect_another_user(client, db):
    headers1 = get_auth_headers(db)

    client.put(
        "/settings/",
        json={
            "work_start": "10:00:00",
            "work_end": "19:00:00",
            "lunch_start": "14:00:00",
            "lunch_end": "15:00:00",
            "break_duration_min": 15,
            "work_before_break_min": 45
        },
        headers=headers1
    )

    user2 = User(
        email="settings_isolation_update@example.com",
        password_hash=hash_password("password123"),
        birth_date=date(2001, 1, 1),
        chronotype="owl"
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)

    token2 = create_access_token(user2.id)
    headers2 = {"Authorization": f"Bearer {token2}"}

    response = client.put(
        "/settings/",
        json={
            "work_start": "08:00:00",
            "work_end": "17:00:00",
            "lunch_start": "12:00:00",
            "lunch_end": "13:00:00",
            "break_duration_min": 5,
            "work_before_break_min": 30
        },
        headers=headers2
    )

    assert response.status_code == 200

    response1 = client.get("/settings/", headers=headers1)

    assert response1.status_code == 200
    assert response1.json()["work_start"] == "10:00:00"
    assert response1.json()["break_duration_min"] == 15


def test_break_duration_too_large(client, db):
    headers = get_auth_headers(db)
    response = client.put(
        "/settings/",
        json={
            "work_start": "09:00:00",
            "work_end": "18:00:00",
            "lunch_start": "13:00:00",
            "lunch_end": "14:00:00",
            "break_duration_min": 121,
            "work_before_break_min": 50
        },
        headers=headers
    )
    assert response.status_code == 422


def test_work_before_break_too_large(client, db):
    headers = get_auth_headers(db)
    response = client.put(
        "/settings/",
        json={
            "work_start": "09:00:00",
            "work_end": "18:00:00",
            "lunch_start": "13:00:00",
            "lunch_end": "14:00:00",
            "break_duration_min": 10,
            "work_before_break_min": 241
        },
        headers=headers
    )
    assert response.status_code == 422
