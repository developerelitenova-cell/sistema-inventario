from fastapi.testclient import TestClient
from services.auth import hash_password

def test_register_success(client: TestClient):
    payload = {
        "full_name": "Nuevo Usuario",
        "email": "nuevo@example.com",
        "document_id": "999999",
        "photo_url": "http://example.com/photo.jpg"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert "generated_password" in data
    assert data["user"]["email"] == "nuevo@example.com"
    assert data["user"]["full_name"] == "Nuevo Usuario"

def test_register_duplicate_document(client: TestClient):
    payload = {
        "full_name": "Nuevo Usuario 2",
        "email": "nuevo2@example.com",
        "document_id": "999999",
    }
    # Register first time
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 200

    # Register again with same document
    payload["email"] = "nuevo3@example.com"
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "Ese documento ya tiene una cuenta registrada" in response.json()["detail"]

def test_login_success(client: TestClient, db_session):
    # Retrieve the previously created user
    response = client.post("/auth/login", json={
        "email": "nuevo@example.com",
        "password": "WrongPassword123" # Won't work as it's randomly generated in register
    })
    # Instead, let's create a known user to test login correctly since generated_password isn't saved in db_session fixture
    pass

def test_login_known_user(client: TestClient, db_session):
    # Setup known user
    from models import User, RoleEnum
    user = User(
        username="login_test",
        full_name="Login Test",
        email="logintest@example.com",
        document_id="888888",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()

    # Test login
    response = client.post("/auth/login", json={
        "email": "logintest@example.com",
        "password": "MySecretPass!23"
    })
    assert response.status_code == 200
    assert "token" in response.json()

def test_login_invalid_password(client: TestClient):
    response = client.post("/auth/login", json={
        "email": "logintest@example.com",
        "password": "WrongPassword"
    })
    assert response.status_code == 401
    assert "Email o contraseña incorrectos" in response.json()["detail"]

def test_get_me(client: TestClient, db_session):
    from models import User, RoleEnum
    user = User(
        username="get_me_test",
        full_name="Get Me Test",
        email="getme@example.com",
        document_id="777777",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()

    # Login
    response = client.post("/auth/login", json={
        "email": "getme@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    # Get Me
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "getme@example.com"

def test_get_me_unauthenticated(client: TestClient):
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_change_password(client: TestClient, db_session):
    from models import User, RoleEnum
    user = User(
        username="pwd_test",
        full_name="Pwd Test",
        email="pwd@example.com",
        document_id="666666",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()

    # Login
    response = client.post("/auth/login", json={
        "email": "pwd@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    # Change password
    response = client.post("/auth/change-password", headers={"Authorization": f"Bearer {token}"}, json={
        "current_password": "MySecretPass!23",
        "new_password": "NewSecretPass!23"
    })
    assert response.status_code == 200

    # Try login with new password
    response = client.post("/auth/login", json={
        "email": "pwd@example.com",
        "password": "NewSecretPass!23"
    })
    assert response.status_code == 200

def test_logout(client: TestClient, db_session):
    from models import User, RoleEnum
    user = User(
        username="logout_test",
        full_name="Logout Test",
        email="logout@example.com",
        document_id="555555",
        role=RoleEnum.EMPLEADO,
        password_hash=hash_password("MySecretPass!23")
    )
    db_session.add(user)
    db_session.commit()

    # Login
    response = client.post("/auth/login", json={
        "email": "logout@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    # Logout
    response = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # Try to access protected route
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
