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