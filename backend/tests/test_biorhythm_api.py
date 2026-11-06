
from datetime import date

from app.models.user import User
from app.models.biorhythm_cache import BiorhythmCache
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


def test_biorhythms_cache(client, db):
    user = User(
        email="cache@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    headers = {"Authorization": f"Bearer {token}"}
    params = {"target_date": "2004-09-12"}

    first_response = client.get(
        "/biorhythms/",
        params=params,
        headers=headers
    )

    second_response = client.get(
        "/biorhythms/",
        params=params,
        headers=headers
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json() == second_response.json()

    cache_entries = db.query(BiorhythmCache).filter(
        BiorhythmCache.user_id == user.id,
        BiorhythmCache.date == date(2004, 9, 12)
    ).all()

    assert len(cache_entries) == 1


def test_get_biorhythm_period(client, db):
    user = User(
        email="period@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/biorhythms/period",
        params={
            "start_date": "2004-09-12",
            "end_date": "2004-09-14"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data["items"]) == 3
    assert data["items"][0]["date"] == "2004-09-12"
    assert data["items"][1]["date"] == "2004-09-13"
    assert data["items"][2]["date"] == "2004-09-14"

    assert data["items"][0]["physical"] == 0.0


def test_get_biorhythm_period_invalid_dates(client, db):
    user = User(
        email="invalid_period@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/biorhythms/period",
        params={
            "start_date": "2004-09-14",
            "end_date": "2004-09-12"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 400


def test_get_biorhythm_period_without_token(client):
    response = client.get(
        "/biorhythms/period",
        params={
            "start_date": "2004-09-12",
            "end_date": "2004-09-14"
        }
    )

    assert response.status_code in (401, 403)


def test_get_critical_days(client, db):
    user = User(
        email="critical@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/biorhythms/critical-days",
        params={
            "start_date": "2004-09-03",
            "end_date": "2004-09-22"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data["items"]) == 5

    critical_days = {
        (
            item["date"],
            item["biorhythm"],
            item["direction"]
        )
        for item in data["items"]
    }

    assert (
        "2004-09-03",
        "emotional",
        "positive_to_negative"
    ) in critical_days

    assert (
        "2004-09-12",
        "physical",
        "negative_to_positive"
    ) in critical_days

    assert (
        "2004-09-17",
        "emotional",
        "negative_to_positive"
    ) in critical_days

    assert (
        "2004-09-22",
        "intellectual",
        "negative_to_positive"
    ) in critical_days


def test_get_critical_days_invalid_dates(client, db):
    user = User(
        email="invalid_critical@example.com",
        password_hash="test_hash",
        birth_date=date(2004, 8, 20),
        chronotype="lark"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)

    response = client.get(
        "/biorhythms/critical-days",
        params={
            "start_date": "2004-09-22",
            "end_date": "2004-09-03"
        },
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 400


def test_get_critical_days_without_token(client):
    response = client.get(
        "/biorhythms/critical-days",
        params={
            "start_date": "2004-09-03",
            "end_date": "2004-09-22"
        }
    )

    assert response.status_code in (401, 403)