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