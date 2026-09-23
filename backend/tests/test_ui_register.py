import pytest
from fastapi.testclient import TestClient
from models import Asset, AssetStatusEnum
from services.auth import create_access_token

@pytest.fixture
def admin_token(admin_user):
    return create_access_token(data={"sub": admin_user.username})

@pytest.fixture
def db_asset(db_session, admin_user):
    asset = Asset(
        unique_code="EN-0001",
        module="test_module",
        status=AssetStatusEnum.PENDING_REGISTRATION
    )
    db_session.add(asset)
    db_session.commit()
    return asset

def test_ui_register_update(client: TestClient, admin_token, db_session, db_asset):
    # Setup pending registration asset
    db_asset.status = AssetStatusEnum.PENDING_REGISTRATION
    db_asset.description = None
    db_asset.brand_model = None
    db_asset.module = "test_module"
    db_session.commit()

    # Simulate UI payload
    payload = {
        "description": "Test UI description",
        "brand_model": "Test Brand",
        "status": "available",
        "module": "test_module",
        "inventory_type": "activos"
    }

    response = client.put(f"/assets/{db_asset.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200, response.text
    
    data = response.json()
    assert data["status"] == "available"
