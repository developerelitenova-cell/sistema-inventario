from time_util import get_colombia_time
import pytest
from fastapi.testclient import TestClient
from models import User, Asset, AssetAssignment as Assignment, AssetStatusEnum, RoleEnum, AssignmentStatusEnum
from main import app
from datetime import datetime

@pytest.fixture
def db_asset(db_session):
    asset = Asset(
        unique_code="EQ-A001",
        description="Monitor Test",
        category="COMPUTADORES",
        status=AssetStatusEnum.AVAILABLE,
        module="test_module",
        qr_data="SOME_QR_DATA"
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset

@pytest.fixture
def admin_token(db_session, admin_user):
    from services.auth import create_token
    return create_token(db_session, admin_user)

@pytest.fixture
def normal_user_token(db_session, test_user):
    from services.auth import create_token
    return create_token(db_session, test_user)

def test_get_assignments(client: TestClient, admin_token, db_session, test_user, db_asset):
    assignment = Assignment(
        asset_id=db_asset.id,
        user_id=test_user.id,
        status=AssignmentStatusEnum.ACTIVE,
        expiration_date=get_colombia_time()
    )
    db_session.add(assignment)
    db_session.commit()

    response = client.get("/assignments/", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_create_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    response = client.post(
        "/assignments/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "asset_id": db_asset.id,
            "user_id": test_user.id,
            "notes": "Asignación inicial"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["status"] == "active"
    
    db_session.refresh(db_asset)
    assert db_asset.status == AssetStatusEnum.ASSIGNED

def test_revoke_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    assignment = Assignment(
        asset_id=db_asset.id,
        user_id=test_user.id,
        status=AssignmentStatusEnum.ACTIVE,
        expiration_date=get_colombia_time()
    )
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)

    response = client.post(
        f"/assignments/{assignment.id}/revoke",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "revoked"
    
    db_session.refresh(db_asset)
    assert db_asset.status == AssetStatusEnum.AVAILABLE

def test_get_assignments_invalid_status(client: TestClient, admin_token):
    response = client.get("/assignments/?status_filter=invalid", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 400
    assert "Estado" in response.json()["detail"]

def test_get_assignments_normal_user(client: TestClient, normal_user_token, db_session, test_user, db_asset):
    # Ensure normal user only gets their own
    assignment = Assignment(asset_id=db_asset.id, user_id=test_user.id, status=AssignmentStatusEnum.ACTIVE, expiration_date=get_colombia_time())
    db_session.add(assignment)
    db_session.commit()
    response = client.get("/assignments/", headers={"Authorization": f"Bearer {normal_user_token}"})
    assert response.status_code == 200

def test_create_assignment_asset_not_available(client: TestClient, admin_token, db_session, test_user, db_asset):
    db_asset.status = AssetStatusEnum.ASSIGNED
    db_session.commit()
    response = client.post(
        "/assignments/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"asset_id": db_asset.id, "user_id": test_user.id, "notes": "test"}
    )
    assert response.status_code == 400

def test_renew_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    assignment = Assignment(
        asset_id=db_asset.id,
        user_id=test_user.id,
        status=AssignmentStatusEnum.ACTIVE,
        expiration_date=get_colombia_time()
    )
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)

    response = client.post(
        f"/assignments/{assignment.id}/renew?duration_days=30",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    
def test_renew_invalid_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    assignment = Assignment(
        asset_id=db_asset.id,
        user_id=test_user.id,
        status=AssignmentStatusEnum.REVOKED,
        expiration_date=get_colombia_time()
    )
    db_session.add(assignment)
    db_session.commit()

    response = client.post(f"/assignments/{assignment.id}/renew", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 400

def test_revoke_invalid_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    assignment = Assignment(
        asset_id=db_asset.id,
        user_id=test_user.id,
        status=AssignmentStatusEnum.REVOKED,
        expiration_date=get_colombia_time()
    )
    db_session.add(assignment)
    db_session.commit()

    response = client.post(f"/assignments/{assignment.id}/revoke", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 400
