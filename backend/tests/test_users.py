
from datetime import date, datetime, timedelta, timezone

import jwt

from app.models.user import User
from app.core.security import (
    create_access_token,
    SECRET_KEY,
    ALGORITHM
)


def create_test_user(db):
    user = User(
        email="profile@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="owl"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def test_get_profile(client, db):
    user = create_test_user(db)
    token = create_access_token(user.id)

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "profile@example.com"
    assert response.json()["chronotype"] == "owl"


def test_update_profile(client, db):
    user = create_test_user(db)
    token = create_access_token(user.id)

    response = client.put(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "birth_date": "2004-08-20",
            "chronotype": "lark"
        }
    )

    assert response.status_code == 200
    assert response.json()["chronotype"] == "lark"


def test_get_profile_without_token(client):
    response = client.get("/users/me")

    assert response.status_code in (401, 403)


def test_user_cannot_change_another_users_profile(client, db):
    user1 = create_test_user(db)
    token1 = create_access_token(user1.id)

    user2 = User(
        email="another_profile@example.com",
        password_hash="test_hash",
        birth_date=date(2001, 1, 1),
        chronotype="lark"
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)

    token2 = create_access_token(user2.id)

    response = client.put(
        "/users/me",
        headers={"Authorization": f"Bearer {token1}"},
        json={
            "birth_date": "2000-05-15",
            "chronotype": "owl"
        }
    )

    assert response.status_code == 200

    other_profile = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token2}"}
    )

    assert other_profile.status_code == 200
    assert other_profile.json()["birth_date"] == "2001-01-01"
    assert other_profile.json()["chronotype"] == "lark"


def test_get_profile_with_invalid_token(client):
    response = client.get(
        "/users/me",
        headers={"Authorization": "Bearer invalid.token.value"}
    )

    assert response.status_code == 401


def test_get_profile_with_expired_token(client):
    payload = {
        "sub": "1",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_get_profile_with_nonexistent_user(client):
    token = create_access_token(999999)

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_get_profile_with_missing_sub(client):
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401


def test_get_profile_with_wrong_signature(client):
    payload = {
        "sub": "1",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    token = jwt.encode(
        payload,
        "wrong-secret-key-for-jwt-test-32-bytes",
        algorithm=ALGORITHM
    )

    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 401



def test_update_profile_with_future_birth_date(client, db):
    user = create_test_user(db)
    token = create_access_token(user.id)

    response = client.put(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "birth_date": "2099-01-01",
            "chronotype": "lark"
        }
    )

    assert response.status_code == 422
