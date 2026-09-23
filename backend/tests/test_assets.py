from fastapi.testclient import TestClient
from models import RoleEnum, AssetStatusEnum

def test_batch_generate_success(client: TestClient, admin_user):
    # Log in as admin
    response = client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    payload = {
        "module": "test_module",
        "prefix": "EQ",
        "quantity": 3,
        "start_number": 1
    }
    response = client.post(
        "/assets/batch-generate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 3
    assert assets[0]["unique_code"] == "EQ-0001"
    assert assets[1]["unique_code"] == "EQ-0002"
    assert assets[2]["unique_code"] == "EQ-0003"
    for a in assets:
        assert a["status"] == AssetStatusEnum.PENDING_REGISTRATION.value

def test_batch_generate_forbidden(client: TestClient, test_user):
    # test_user is EMPLEADO, should not be allowed
    response = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    payload = {
        "module": "test_module",
        "prefix": "EQ",
        "quantity": 1
    }
    response = client.post(
        "/assets/batch-generate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403

def test_get_asset_by_code_and_update(client: TestClient, admin_user):
    response = client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]
    
    # Batch generate one asset
    client.post("/assets/batch-generate", json={
        "module": "test_module",
        "prefix": "ABC",
        "quantity": 1,
        "start_number": 1
    }, headers={"Authorization": f"Bearer {token}"})

    # Get asset by code
    response = client.get("/assets/by-code/ABC-0001", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    asset_id = response.json()["id"]

    # Update asset
    update_payload = {
        "description": "Nueva Descripción",
        "brand_model": "Marca X",
        "status": AssetStatusEnum.AVAILABLE.value,
        "module": "test_module"
    }
    response = client.put(f"/assets/{asset_id}", json=update_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    updated = response.json()
    assert updated["description"] == "Nueva Descripción"
    assert updated["status"] == AssetStatusEnum.AVAILABLE.value

def test_get_asset_by_code_not_found(client: TestClient, admin_user):
    response = client.post("/auth/login", json={
        "email": "admin@example.com",
        "password": "MySecretPass!23"
    })
    token = response.json()["token"]

    response = client.get("/assets/by-code/UNKNOWN-123", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
