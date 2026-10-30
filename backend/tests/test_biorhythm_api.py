from datetime import date

from app.models.user import User
from app.core.security import create_access_token


def test_get_biorhythms(client, db):
    user = User(
        email="biorhythm@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/biorhythms/",
        params={"target_date": "2004-09-12"},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    data = response.json()

    assert set(data.keys()) == {
        "physical",
        "emotional",
        "intellectual"
    }

    assert data["physical"] == 0.0


def test_get_biorhythms_without_token(client):
    response = client.get(
        "/biorhythms/",
        params={"target_date": "2004-09-12"}
    )

    assert response.status_code in (401, 403)