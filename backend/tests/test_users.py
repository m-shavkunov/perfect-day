from datetime import date

from app.models.user import User
from app.core.security import create_access_token


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