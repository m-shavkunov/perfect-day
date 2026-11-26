def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "password": "Test12345!",
            "birth_date": "2004-08-20",
            "chronotype": "lark"
        }
    )

    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"


def test_register_duplicate_email(client):
    user_data = {
        "email": "duplicate@example.com",
        "password": "Test12345!",
        "birth_date": "2004-08-20",
        "chronotype": "lark"
    }

    client.post("/auth/register", json=user_data)
    response = client.post("/auth/register", json=user_data)

    assert response.status_code == 400


def test_login_user(client):
    client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "password": "Test12345!",
            "birth_date": "2004-08-20",
            "chronotype": "lark"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "Test12345!"
        }
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    client.post(
        "/auth/register",
        json={
            "email": "wrong@example.com",
            "password": "Test12345!",
            "birth_date": "2004-08-20",
            "chronotype": "lark"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "wrong@example.com",
            "password": "Wrong12345!"
        }
    )

    assert response.status_code == 401



def test_register_user_with_dove_chronotype(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "dove@example.com",
            "password": "Test12345!",
            "birth_date": "2004-08-20",
            "chronotype": "dove"
        }
    )

    assert response.status_code == 201


def test_register_user_with_invalid_chronotype(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "invalid_chronotype@example.com",
            "password": "Test12345!",
            "birth_date": "2004-08-20",
            "chronotype": "unknown"
        }
    )

    assert response.status_code == 422


def test_register_user_with_future_birth_date(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "future@example.com",
            "password": "Test12345!",
            "birth_date": "2099-01-01",
            "chronotype": "lark"
        }
    )

    assert response.status_code == 422


def test_register_user_with_too_long_password(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "long_password@example.com",
            "password": "A" * 129,
            "birth_date": "2004-08-20",
            "chronotype": "lark"
        }
    )

    assert response.status_code == 422
