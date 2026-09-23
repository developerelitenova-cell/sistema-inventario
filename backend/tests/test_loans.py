import pytest
from fastapi.testclient import TestClient
from models import User, Asset, Loan, LoanStatusEnum, AssetStatusEnum
from main import app
from datetime import datetime, timedelta

@pytest.fixture
def db_asset(db_session):
    asset = Asset(
        unique_code="EQ-0001",
        description="Laptop Test",
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
def normal_user_token(db_session, test_user):
    from services.auth import create_token
    return create_token(db_session, test_user)

@pytest.fixture
def admin_token(db_session, admin_user):
    from services.auth import create_token
    return create_token(db_session, admin_user)

def test_request_loan(client: TestClient, db_session, normal_user_token, db_asset):
    response = client.post(
        "/loans/request",
        headers={"Authorization": f"Bearer {normal_user_token}"},
        json={
            "asset_id": db_asset.id,
            "reason": "Necesito este equipo para un proyecto"
        }
    )
    
    assert response.status_code == 200, response.json()
    data = response.json()
    assert "id" in data
    assert data["status"] == "pending"

def test_approve_loan_admin(client: TestClient, db_session, admin_token, test_user, db_asset):
    # Crear una solicitud de préstamo primero
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.PENDING,
        reason="Para revisión",
        return_date=datetime.utcnow() + timedelta(days=7)
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    
    response = client.post(
        f"/loans/{loan.id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"approved": True}
    )
    
    assert response.status_code == 200, response.json()
    assert response.json()["status"] == "approved"
    
    # Verificar que el activo ahora está en estado reservado o prestado
    db_session.refresh(db_asset)
    assert db_asset.status == AssetStatusEnum.LOANED

def test_return_loan_damaged(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.CHECKED_OUT,
        security_authorization="AUTORIZADO_SALIDA"
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    
    response = client.post(
        f"/loans/{loan.id}/return",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"condition_status": "DAÑADO", "observations": "Pantalla rota"}
    )
    assert response.status_code == 200
    db_session.refresh(db_asset)
    assert db_asset.status == AssetStatusEnum.MAINTENANCE

def test_return_asset_directly(client: TestClient, admin_token, db_session, test_user, db_asset):
    # Setup loan for this asset
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.CHECKED_OUT)
    db_session.add(loan)
    db_session.commit()
    
    response = client.post(f"/assets/{db_asset.id}/return", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    
    db_session.refresh(db_asset)
    assert db_asset.status == AssetStatusEnum.AVAILABLE

def test_return_asset_no_loan_but_assignment(client: TestClient, admin_token, db_session, test_user, db_asset):
    from models import AssetAssignment, AssignmentStatusEnum
    assignment = AssetAssignment(asset_id=db_asset.id, user_id=test_user.id, status=AssignmentStatusEnum.ACTIVE, expiration_date=datetime.utcnow())
    db_session.add(assignment)
    db_session.commit()
    
    response = client.post(f"/assets/{db_asset.id}/return", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert "revocada" in response.json()["message"]
    
def test_checkout_loan_invalid_status(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.PENDING)
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    
    response = client.post(
        f"/loans/{loan.id}/checkout-security",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"security_signature_base64": "data:image/png;base64,iVBORw0K...", "borrowed_accessories": []}
    )
    assert response.status_code == 400

def test_approve_loan_normal_user_fails(client: TestClient, db_session, normal_user_token, test_user, db_asset):
    # Crear una solicitud de préstamo primero
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.PENDING,
        reason="Para revisión",
        return_date=datetime.utcnow() + timedelta(days=7)
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)
    
    response = client.post(
        f"/loans/{loan.id}/approve",
        headers={"Authorization": f"Bearer {normal_user_token}"},
        json={"approved": True}
    )
    
    # Debe ser Forbidden (403)
    assert response.status_code == 403

def test_get_loans(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.PENDING,
        reason="Para revisión",
    )
    db_session.add(loan)
    db_session.commit()

    response = client.get("/loans/", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_get_loan_by_id(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.PENDING,
        reason="Para revisión",
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)

    response = client.get(f"/loans/{loan.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert response.json()["id"] == loan.id

def test_create_direct_loan(client: TestClient, admin_token, db_asset, test_user):
    response = client.post(
        "/loans/direct",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "asset_id": db_asset.id,
            "borrower_id": test_user.id,
            "reason": "Direct loan test"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

def test_checkout_loan_security(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.APPROVED,
        reason="Para revisión",
        security_authorization="AUTORIZADO_SALIDA"
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)

    response = client.post(
        f"/loans/{loan.id}/checkout-security",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"security_signature_base64": "data:image/png;base64,iVBORw0KGgo..."}
    )
    assert response.status_code == 200, response.json()
    assert response.json()["status"] == "checked_out"

def test_return_loan(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(
        asset_id=db_asset.id,
        borrower_id=test_user.id,
        status=LoanStatusEnum.CHECKED_OUT,
        reason="Para revisión",
    )
    db_session.add(loan)
    db_session.commit()
    db_session.refresh(loan)

    response = client.post(
        f"/loans/{loan.id}/return",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"observations": "Devuelto OK"}
    )
    assert response.status_code == 200, response.json()
    assert response.json()["status"] == "returned"

def test_checkout_loan_biometrics_success(client: TestClient, admin_token, db_session, test_user, db_asset):
    from unittest.mock import patch
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.APPROVED, security_authorization="AUTORIZADO_SALIDA")
    db_session.add(loan)
    db_session.commit()

    files = {
        "face_image": ("face.jpg", b"fake", "image/jpeg"),
        "id_image": ("id.jpg", b"fake", "image/jpeg"),
    }
    
    with patch("routes.loans.biometrics.validate_face_and_id", return_value=True):
        response = client.post(
            f"/loans/{loan.id}/checkout", 
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
    
    assert response.status_code == 200
    assert response.json()["status"] == "checked_out"

def test_checkout_loan_biometrics_failure(client: TestClient, admin_token, db_session, test_user, db_asset):
    from unittest.mock import patch
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.APPROVED, security_authorization="AUTORIZADO_SALIDA")
    db_session.add(loan)
    db_session.commit()

    files = {
        "face_image": ("face.jpg", b"fake", "image/jpeg"),
        "id_image": ("id.jpg", b"fake", "image/jpeg"),
    }
    
    with patch("routes.loans.biometrics.validate_face_and_id", return_value=False):
        response = client.post(
            f"/loans/{loan.id}/checkout", 
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
    
    assert response.status_code == 401

def test_checkout_loan_security_invalid_auth(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.APPROVED, security_authorization="USO_INTERNO")
    db_session.add(loan)
    db_session.commit()

    response = client.post(
        f"/loans/{loan.id}/checkout-security", 
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"security_signature_base64": "fake_signature"}
    )
    
    assert response.status_code == 403

def test_get_loans_invalid_status(client: TestClient, admin_token):
    response = client.get("/loans/?status_filter=invalid_status", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 400

def test_get_loans_empleado(client: TestClient, normal_user_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.PENDING)
    db_session.add(loan)
    db_session.commit()
    response = client.get("/loans/", headers={"Authorization": f"Bearer {normal_user_token}"})
    assert response.status_code == 200

def test_get_loan_by_id_404(client: TestClient, admin_token):
    response = client.get("/loans/9999", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 404

def test_get_loan_by_id_empleado_403(client: TestClient, normal_user_token, db_session, admin_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=admin_user.id, status=LoanStatusEnum.PENDING)
    db_session.add(loan)
    db_session.commit()
    response = client.get(f"/loans/{loan.id}", headers={"Authorization": f"Bearer {normal_user_token}"})
    assert response.status_code == 403

def test_request_loan_unavailable(client: TestClient, normal_user_token, db_session, db_asset):
    db_asset.status = AssetStatusEnum.LOANED
    db_session.commit()
    response = client.post("/loans/request", headers={"Authorization": f"Bearer {normal_user_token}"}, json={"asset_id": db_asset.id, "reason": "Test"})
    assert response.status_code == 400

def test_create_direct_loan_unavailable(client: TestClient, admin_token, db_session, db_asset, test_user):
    db_asset.status = AssetStatusEnum.LOANED
    db_session.commit()
    response = client.post("/loans/direct", headers={"Authorization": f"Bearer {admin_token}"}, json={"asset_id": db_asset.id, "borrower_id": test_user.id, "reason": "Test", "requires_exit_pass": False})
    assert response.status_code == 400

def test_approve_loan_invalid_status(client: TestClient, admin_token, db_session, db_asset, test_user):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.APPROVED)
    db_session.add(loan)
    db_session.commit()
    response = client.post(f"/loans/{loan.id}/approve", headers={"Authorization": f"Bearer {admin_token}"}, json={"approved": True, "requires_exit_pass": False})
    assert response.status_code == 400

def test_checkout_loan_not_approved(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.PENDING)
    db_session.add(loan)
    db_session.commit()
    files = {"face_image": ("face.jpg", b"fake", "image/jpeg"), "id_image": ("id.jpg", b"fake", "image/jpeg")}
    response = client.post(f"/loans/{loan.id}/checkout", headers={"Authorization": f"Bearer {admin_token}"}, files=files)
    assert response.status_code == 400

def test_checkout_loan_security_already_checked_out(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.CHECKED_OUT, security_authorization="AUTORIZADO_SALIDA")
    db_session.add(loan)
    db_session.commit()
    response = client.post(f"/loans/{loan.id}/checkout-security", headers={"Authorization": f"Bearer {admin_token}"}, json={"security_signature_base64": "fake"})
    assert response.status_code == 400
    
def test_return_loan_not_checked_out(client: TestClient, admin_token, db_session, test_user, db_asset):
    loan = Loan(asset_id=db_asset.id, borrower_id=test_user.id, status=LoanStatusEnum.PENDING)
    db_session.add(loan)
    db_session.commit()
    response = client.post(f"/loans/{loan.id}/return", headers={"Authorization": f"Bearer {admin_token}"}, json={"observations": "Devuelto OK"})
    assert response.status_code == 400

def test_return_asset_no_loan_no_assignment(client: TestClient, admin_token, db_session, db_asset):
    # Test forced return when stuck in LOANED
    db_asset.status = AssetStatusEnum.LOANED
    db_session.commit()
    response = client.post(f"/assets/{db_asset.id}/return", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert "forzosamente" in response.json()["message"]

    # Test error when asset is already AVAILABLE
    db_asset.status = AssetStatusEnum.AVAILABLE
    db_session.commit()
    response2 = client.post(f"/assets/{db_asset.id}/return", headers={"Authorization": f"Bearer {admin_token}"})
    assert response2.status_code == 400
